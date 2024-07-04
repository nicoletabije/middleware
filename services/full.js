const db = require("../db");
const express = require("express");
const router = express.Router();
const pgp = require("pg-promise")(/* Initialization Options */);

router.post("/", async (req, res) => {
  console.log(req.body);
  const patient = req.body.patient;
  const last_request = req.body.last_request;
  const doctor = req.body.doctor;
  var query = `
        WITH
        patient_id AS (
            SELECT
            pa.id as patient_id,
            1 AS equalizer,
            pa.patient_id AS person_id
            FROM
            patient pa
            LEFT JOIN person pe ON pa.patient_id = pe.id
            WHERE
            LOWER(pe.first_name) = LOWER($1)
            AND LOWER(pe.middle_name) = LOWER($2)
            AND LOWER(pe.last_name) = LOWER($3)
            AND pe.birthdate = $4
            AND pe.male = CAST($5 AS BOOLEAN)
            ORDER BY
            SIMILARITY (LOWER(pe.contact_number), LOWER($6)) DESC,
            SIMILARITY (LOWER(pe.postal_code), LOWER($7)) DESC,
            SIMILARITY (LOWER(pe.municipality), LOWER($8)) DESC,
            SIMILARITY (LOWER(pe.city), LOWER($9)) DESC,
            SIMILARITY (LOWER(pe.street_address), LOWER($10)) DESC
            LIMIT
            1
        ),
        doctor_id AS (
            SELECT
            1 as equalizer,
            id as doctor_id,
            doctor_id as license,
            person_id
            FROM
            doctor
            WHERE
            LOWER(doctor_id) != LOWER($11)
        ),
        encounter_id AS (
            SELECT
            id AS encounter_id,
            patient_id,
            doctor_id,
            encounter AS encounters
            FROM
            (SELECT id, patient, doctor, row_to_json(encounter) AS encounter, date_visited FROM encounter) e
            JOIN (
                SELECT
                patient_id,
                doctor_id
                FROM
                doctor_id d
                LEFT JOIN patient_id p ON p.equalizer = d.equalizer
            ) pd ON e.patient = pd.patient_id
            AND e.doctor = pd.doctor_id
            WHERE
            CAST(e.date_visited AS DATE) > CAST($12 AS DATE)
        ),
        allergies_data AS (
            SELECT
            JSON_AGG(
                json_build_object(
                'note',
                note,
                'category',
                type,
                'onset',
                onset_date,
                'severity',
                severity,
                'reaction',
                json_build_object(
                    'description',
                    description,
                    'substance',
                    substance
                )
                )
            ) AS allergies,
            CAST(created_at AS DATE) AS created_at,
            patient AS patient_variable
            FROM
            allergies
            WHERE
            CAST(created_at AS DATE) > CAST($12 AS DATE)
            GROUP BY
            patient,
            CAST(created_at AS DATE)
        ),
        careplan_data AS (
            SELECT
            JSON_AGG(
                json_build_object(
                type,
                description_description,
                'coding',
                json_build_object('code', code, 'system', system, 'start_date', start_date, 'end_date', end_date)
                )
            ) AS careplan,
            CAST(created_at AS DATE) AS created_at,
            patient AS patient_variable,
            doctor AS doctor_variable
            FROM
            careplan
            WHERE
            CAST(created_at AS DATE) > CAST($12 AS DATE)
            GROUP BY
            patient,
            doctor,
            CAST(created_at AS DATE)
        ),
        ros_data AS (
            SELECT
            JSON_AGG(
                JSON_BUILD_OBJECT(
                'coding',
                json_build_object('code', '8687-6', 'system', 'jttp://loinc.org'),
                'valueString',
                json_build_object(
                    'fever',
                    fever,
                    'weight_loss',
                    weight_loss,
                    'poor_appetite',
                    poor_appetite,
                    'fatigue',
                    fatigue,
                    'heart_palpitation',
                    heart_palpitation,
                    'shortness_of_breath',
                    shortness_of_breath,
                    'chest_pain',
                    chest_pain,
                    'nausea',
                    nausea,
                    'abdominal_pain',
                    abdominal_pain,
                    'vomiting',
                    vomiting,
                    'diarrhea',
                    diarrhea
                )
                )
            ) AS ros,
            encounter AS encounter_id,
            CAST(created_at AS DATE)
            FROM
            ros
            WHERE
            CAST(created_at AS DATE) > CAST($12 AS DATE)
            GROUP BY
            encounter,
            CAST(created_at AS DATE)
        ),
        medications_data AS (
            SELECT
            JSON_AGG(
                json_build_object(
                'form',
                json_build_object('text', form),
                'note',
                note,
                'status',
                CASE
                    WHEN end_date > CAST(NOW() AS DATE) THEN 'active'
                    ELSE 'inactive'
                END,
                'dispenseRequest',
                json_build_object(
                    'validityPeriod',
                    json_build_object('end', end_date, 'start', start_date),
                    'dispenseInterval',
                    dispense_interval
                ),
                'dosageInstruction',
                json_build_object(
                    'doseAndRate',
                    json_build_object(
                    'doesQuantity',
                    json_build_object('doseUnit', dose_and_unit)
                    )
                ),
                'medicationCodeableConcept',
                json_build_object(
                    'text',
                    medicine_name,
                    'coding',
                    json_build_object('display', medicine_name)
                )
                )
            ) AS medications,
            CAST(created_at AS DATE) AS created_at,
            patient AS patient_variable,
            doctor AS doctor_variable
            FROM
            medications
            WHERE
            CAST(created_at AS DATE) > CAST($12 AS DATE)
            GROUP BY
            patient,
            doctor,
            CAST(created_at AS DATE)
        ),
        observation_data AS (
            SELECT
            JSON_AGG(
                json_build_object(
                'type',
                type,
                'resource_type',
                resource_type,
                'value',
                value,
                'unit',
                unit,
                'coding',
                json_build_object('code', code, 'system', system)
                )
            ) AS observation,
            encounter_id,
            CAST(created_at AS DATE) AS created_at,
            patient AS patient_variable,
            doctor AS doctor_variable
            FROM
            observation
            WHERE
            CAST(created_at AS DATE) > CAST($12 AS DATE)
            GROUP BY
            encounter_id,
            CAST(created_at AS DATE),
            patient,
            doctor
        )
        SELECT medication, careplan, data FROM
        (
            SELECT 1 AS equalizer, json_agg(row_to_json(care_plan)) AS careplan FROM
            (
                SELECT
                    d_data.doctor, p_data.patient, cp.careplan
                FROM
                careplan_data cp
               INNER JOIN (SELECT doc.d_id, row_to_json(doc) AS doctor FROM (SELECT *, d.doctor_id as d_id FROM doctor_id d LEFT JOIN person p ON p.id = d.person_id) doc ) d_data ON cp.doctor_variable = d_data.d_id
                LEFT JOIN (SELECT pat.p_id, row_to_json(pat) AS patient FROM (SELECT *, pa.patient_id as p_id FROM patient_id pa LEFT JOIN person p ON pa.person_id = p.id) pat) p_data ON cp.patient_variable = p_data.p_id
            ) care_plan 
        ) agg_careplan
        LEFT JOIN(
            SELECT 1 AS equalizer, json_agg(row_to_json(medication_plan)) AS medication FROM
            (
                SELECT
                    d_data.doctor, p_data.patient, cp.medications
                FROM
                medications_data cp
               INNER JOIN (SELECT doc.d_id, row_to_json(doc) AS doctor FROM (SELECT *, d.doctor_id as d_id FROM doctor_id d LEFT JOIN person p ON p.id = d.person_id) doc ) d_data ON cp.doctor_variable = d_data.d_id
                LEFT JOIN (SELECT pat.p_id, row_to_json(pat) AS patient FROM (SELECT *, pa.patient_id as p_id FROM patient_id pa LEFT JOIN person p ON pa.person_id = p.id) pat) p_data ON cp.patient_variable = p_data.p_id
            ) medication_plan 
        ) agg_medication on agg_medication.equalizer = agg_careplan.equalizer
        LEFT JOIN (
            SELECT 1 AS equalizer, json_agg(row_to_json(data_to_object)) AS data 
            FROM
            (
                SELECT
                    pd.*, a.allergies, r.ros, o.observation, d_data.doctor, p_data.patient
                FROM
                encounter_id pd
                FULL OUTER JOIN allergies_data a ON pd.patient_id = a.patient_variable
                FULL OUTER JOIN ros_data r ON pd.encounter_id = r.encounter_id
                LEFT JOIN observation_data o ON pd.encounter_id = o.encounter_id
                AND pd.patient_id = o.patient_variable
                AND pd.doctor_id = o.doctor_variable
                LEFT JOIN (SELECT doc.d_id, row_to_json(doc) AS doctor FROM (SELECT *, d.doctor_id as d_id FROM doctor_id d LEFT JOIN person p ON p.id = d.person_id) doc ) d_data ON pd.doctor_id = d_data.d_id
                LEFT JOIN (SELECT pat.p_id, row_to_json(pat) AS patient FROM (SELECT *, pa.patient_id as p_id FROM patient_id pa LEFT JOIN person p ON pa.person_id = p.id) pat) p_data ON pd.patient_id = p_data.p_id
            ) data_to_object
        )agg_data ON agg_careplan.equalizer = agg_data.equalizer
    `;

  var params = [
    patient.name.given,
    patient.name.middle,
    patient.name.family,
    patient.birthDate,
    patient.gender.toLowerCase() == "male" ? 1 : 0,
    patient.telecom,
    patient.address.postalCode,
    patient.address.state,
    patient.address.city,
    patient.address.line,
    doctor.qualification.id,
    last_request,
  ];

  var result = await db.query(query, params);

  res.json(result.rows);
});

module.exports = router;
