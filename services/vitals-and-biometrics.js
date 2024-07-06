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
  const vitalsAndBiometrics = {
    vitals: req.body.vitals,
    biometrics: req.body.biometrics,
  };

  var resource_type = [];
  var type = [];
  var value = [];
  var unit = [];

  Object.keys(vitalsAndBiometrics).map((rt) => {
    Object.keys(vitalsAndBiometrics[rt]).map((t) => {
      resource_type.push(rt);
      type.push(t);
      value.push(vitalsAndBiometrics[rt][t].value);
      unit.push(vitalsAndBiometrics[rt][t].unit);
    });
  });

  var rt = arrayToStringWithQuotes(resource_type);
  var t = arrayToStringWithQuotes(type);
  var val = arrayToStringWithQuotes(value);
  var un = arrayToStringWithQuotes(unit);

  var query = `WITH patient_id AS (
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
            SELECT id, patient_id, doctor_id FROM
            (
                SELECT patient_id, doctor_id
                FROM doctor_id d LEFT JOIN patient_id p ON p.equalizer = d.equalizer
            ) pd LEFT JOIN encounter e ON e.patient = pd.patient_id AND e.doctor = pd.doctor_id
             WHERE CAST(e. date_visited AT TIME ZONE 'UTC' AT TIME ZONE '+16:00' AS DATE) = CAST($12 AS DATE) 
        )INSERT INTO observation (patient, doctor, encounter_id, resource_type, type, value, unit)
        SELECT patient_id, doctor_id, id, resource_type, type, value, unit
        FROM (SELECT * FROM encounter_id) en CROSS JOIN (
            SELECT unnest(${rt}) AS resource_type, unnest(${t}) AS type, unnest(${val}) AS value, unnest(${un}) AS unit
        ) di
         returning id
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
  ];

  console.log(pgp.as.format(query, params));
  var result = await db.query(query, params);
  res.json(result.rows);
});

function arrayToStringWithQuotes(arr) {
  // Map each element of the array to a string representation with single quotes
  const quotedArray = arr.map((num) => `'${num}'`);

  // Join the elements with commas to form the final string
  const result = `[${quotedArray.join(", ")}]`;

  return "ARRAY" + result;
}
module.exports = router;
