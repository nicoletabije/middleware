const db = require("../db");
const express = require("express");
const router = express.Router();
const pgp = require("pg-promise")(/* Initialization Options */);

const { getPatientId } = require("../utils/patient.utils");
router.post("/", async (req, res) => {
  var patient = req.body.patient;
  getPatientId(patient);
  var doctor = req.body.doctor;
  var encounter = req.body.encounter;

  var query = `
          WITH patient_id AS (
            SELECT 1 as equalizer, pa.id as patient_id 
            FROM patient pa
            LEFT JOIN person pe
            ON pa.patient_id = pe.id
            WHERE LOWER(pe.first_name) = LOWER($1)
            AND LOWER(pe.middle_name) = LOWER($2) OR $2 IS NULL
            AND LOWER(pe.last_name) = LOWER($3)
            AND pe.birthdate = $4
            AND pe.male = CAST($5 AS BOOLEAN)
            ORDER BY SIMILARITY(LOWER(pe.contact_number), LOWER($6)) DESC
            , SIMILARITY(LOWER(pe.postal_code), LOWER($7)) DESC
            , SIMILARITY(LOWER(pe.municipality), LOWER($8)) DESC
            , SIMILARITY(LOWER(pe.city), LOWER($9)) DESC
            , SIMILARITY(LOWER(pe.street_address), LOWER($10)) DESC
            LIMIT 1
        ), doctor_id AS (
            SELECT 1 as equalizer, id as doctor_id
            FROM doctor
            WHERE LOWER(doctor_id) = LOWER($11) 
        )
        SELECT id FROM
        (
            SELECT *
                , 1 AS equalizer 
            FROM encounter 
            WHERE DATE(date_visited AT TIME ZONE 'UTC' AT TIME ZONE '+16:00') = DATE($12)
        ) dv LEFT JOIN (
            SELECT 
                1 AS equalizer
                , patient_id
                , doctor_id 
            FROM patient_id p 
            LEFT JOIN doctor_id d 
            ON p.equalizer = d.equalizer
        ) pd 
        ON dv.equalizer = pd.equalizer
        WHERE pd.patient_id = dv.patient AND pd.doctor_id = dv.doctor
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
    encounter.date_visited ?? "",
  ];

  var result = await db.query(query, params);

  if (result.rows.length == 0) {
    query = `
            WITH patient_id AS (
                SELECT 1 as equalizer, pa.id as patient_id 
                FROM patient pa
                LEFT JOIN person pe
                ON pa.patient_id = pe.id
                WHERE LOWER(pe.first_name) = LOWER($1)
                AND LOWER(pe.middle_name) = LOWER($2) OR $2 IS NULL
                AND LOWER(pe.last_name) = LOWER($3)
                AND pe.birthdate = $4
                AND pe.male = CAST($5 AS BOOLEAN)
                ORDER BY SIMILARITY(LOWER(pe.contact_number), LOWER($6)) DESC
                , SIMILARITY(LOWER(pe.postal_code), LOWER($7)) DESC
                , SIMILARITY(LOWER(pe.municipality), LOWER($8)) DESC
                , SIMILARITY(LOWER(pe.city), LOWER($9)) DESC
                , SIMILARITY(LOWER(pe.street_address), LOWER($10)) DESC
                LIMIT 1
            ), doctor_id AS (
                SELECT 1 as equalizer, id as doctor_id
                FROM doctor
                WHERE LOWER(doctor_id) = LOWER($11) 
            )
            INSERT INTO encounter(doctor, patient, date_visited, diagnosis, code, system, signs_and_symptoms)
            SELECT doctor_id, patient_id, $12, $13, $14, $15, $16
            FROM patient_id p LEFT JOIN doctor_id d ON p.equalizer = d.equalizer
            RETURNING id
        `;
    params = [
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
      encounter.date_visited ?? "",
      encounter.diagnosis ?? "",
      encounter.code ?? "",
      encounter.system ?? "",
      encounter.signs_and_symptoms ?? "",
    ];

    result = await db.query(query, params);
  }

  res.json({ id: result.rows[0]?.id ?? [] });
});

module.exports = router;
