const db = require("../db");
const express = require("express");
const router = express.Router();
const pgp = require("pg-promise")(/* Initialization Options */);

const { getPatientId } = require("../utils/patient.utils");
router.post("/", async (req, res) => {
  const patient = req.body.patient;
  getPatientId(patient);
  const doctor = req.body.doctor;
  const medication = req.body.medication;
  var query = `
        WITH patient_id AS (
            SELECT pa.id as patient_id,
                1 AS equalizer 
            FROM patient pa
            LEFT JOIN person pe
            ON pa.patient_id = pe.id
            WHERE LOWER(pe.first_name) = LOWER($1)
            AND LOWER(pe.middle_name) = LOWER($2) or $2 IS NULL
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
        ) INSERT INTO medications(form, note, start_date, end_date, dispense_interval, dose_and_unit, medicine_name, patient, doctor)
            SELECT $12, $13, CAST(SUBSTRING($14,0,11) AS DATE), CAST(SUBSTRING($15,0,11) AS DATE), $16, $17, $18, patient_id, doctor_id FROM
            patient_id p LEFT JOIN doctor_id d ON p.equalizer = d.equalizer
        RETURNING id
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
    medication.form,
    medication.note,
    medication.start_date,
    medication.end_date,
    medication.dispense_interval,
    medication.dose,
    medication.medicine_name,
  ];

  console.log(pgp.as.format(query, params));
  var result = await db.query(query, params);

  res.json(result.rows[0]?.id ?? []);
});

module.exports = router;
