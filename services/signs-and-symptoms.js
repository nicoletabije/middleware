const db = require("../db");
const express = require("express");
const router = express.Router();
const pgp = require("pg-promise")(/* Initialization Options */);

const { getPatientId } = require("../utils/patient.utils");
router.post("/", async (req, res) => {
  const patient = req.body.patient;
  getPatientId(patient);
  const encounter = req.body.encounter;
  const doctor = req.body.doctor;
  const ros = req.body.ros;
  var query = `
        WITH patient_id AS (
            SELECT pa.id as patient_id,
                1 AS equalizer 
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
        ), encounter_id AS (
            SELECT id FROM
            (
                SELECT patient_id, doctor_id
                FROM doctor_id d LEFT JOIN patient_id p ON p.equalizer = d.equalizer
            ) pd LEFT JOIN encounter e ON e.patient = pd.patient_id AND e.doctor = pd.doctor_id
             WHERE CAST(e. date_visited AT TIME ZONE 'UTC' AT TIME ZONE '+16:00' AS DATE) = CAST($12 AS DATE) 
        ) INSERT INTO ros(encounter, fever, weight_loss, poor_appetite, fatigue, heart_palpitation, shortness_of_breath, chest_pain, nausea, abdominal_pain, vomiting, diarrhea)
         SELECT id, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23 
         FROM encounter_id
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
    encounter.date_visited,
    ros.fever,
    ros.weight_loss,
    ros.poor_appetite,
    ros.fatigue,
    ros.heart_palpitation,
    ros.shortness_of_breath,
    ros.chest_pain,
    ros.nausea,
    ros.abdominal_pain,
    ros.vomiting,
    ros.diarrhea,
  ];
  console.log(pgp.as.format(query, params));

  var result = await db.query(query, params);
  res.json(result.rows[0]?.id);
});

module.exports = router;
