const db = require("../db");
const express = require("express");
const router = express.Router();
const pgp = require("pg-promise")(/* Initialization Options */);

router.post("/", async (req, res) => {
  const patient = req.body.patient;
  const allergy = req.body.allergy;

  var query = `
        WITH patient_id AS (
            SELECT pa.id as patient_id 
            FROM patient pa
            LEFT JOIN person pe
            ON pa.patient_id = pe.id
            WHERE LOWER(pe.first_name) = LOWER($1)
            AND LOWER(pe.middle_name) = LOWER($2)
            AND LOWER(pe.last_name) = LOWER($3)
            AND pe.birthdate = $4
            AND pe.male = CAST($5 AS BOOLEAN)
            ORDER BY SIMILARITY(LOWER(pe.contact_number), LOWER($6)) DESC
            , SIMILARITY(LOWER(pe.postal_code), LOWER($7)) DESC
            , SIMILARITY(LOWER(pe.municipality), LOWER($8)) DESC
            , SIMILARITY(LOWER(pe.city), LOWER($9)) DESC
            , SIMILARITY(LOWER(pe.street_address), LOWER($10)) DESC
            LIMIT 1
        )INSERT 
        INTO allergies(note, type, onset_date, substance, description, severity, patient)
        SELECT $11, $12, CAST(SUBSTRING($13, 0, 11) AS DATE), $14, $15, $16, patient_id
        FROM patient_id
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
    "",
    allergy.category,
    allergy.onset,
    allergy.type,
    allergy.type,
    allergy.severity,
  ];

  var result = await db.query(query, params);
  //   var result = await pgp.as.format(query, params);
  res.json(result.rows[0]?.id ?? null);
});

module.exports = router;
