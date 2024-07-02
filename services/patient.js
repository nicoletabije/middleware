const db = require("../db");
const express = require("express");
const router = express.Router();
const pgp = require("pg-promise")(/* Initialization Options */);

router.post("/", async (req, res) => {
  const patient = req.body.patient;
  console.log(req.body);
  var query = `
    SELECT 
      person.id
    FROM person
    WHERE LOWER(person.first_name) = LOWER($1)
      AND LOWER(person.middle_name) = LOWER($2)
      AND LOWER(person.last_name) = LOWER($3)
      AND person.birthdate = $4
      AND person.male = $5
    ORDER BY SIMILARITY(LOWER(person.contact_number), LOWER($6)) DESC
      , SIMILARITY(LOWER(person.postal_code), LOWER($7)) DESC
      , SIMILARITY(LOWER(person.municipality), LOWER($8)) DESC
      , SIMILARITY(LOWER(person.city), LOWER($9)) DESC
      , SIMILARITY(LOWER(person.street_address), LOWER($10)) DESC
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
  ];
  var result = await db.query(query, params);

  if (result.rows.length == 0) {
    query = `
      INSERT INTO person(
        first_name
        , middle_name
        , last_name
        , street_address
        , city
        , municipality
        , postal_code
        , male
        , contact_number
        , birthdate
      ) VALUES(
       $1,
       $2,
       $3,
       $4,
       $5,
       $6,
       $7,
       $8,
       $9,
       $10
      )
      RETURNING id
    `;
    params = [
      patient.name.given,
      patient.name.middle,
      patient.name.family,
      patient.address.line,
      patient.address.city,
      patient.address.state,
      patient.address.postalCode,
      patient.gender.toLowerCase() == "male" ? 1 : 0,
      patient.telecom,
      patient.birthDate,
    ];
    result = await db.query(query, params);
    const id = result.rows[0].id;

    query = `INSERT INTO patient(patient_id) VALUES ($1)`;
    params = [id];

    result = await db.query(query, params);
  }
  res.status("200").json(result.rows);
});

router.post("/patient-data-after", async (req, res) => {
  const lastDate = req.body.date;
  const patient = req.body.patient;

  var query = `
    SELECT 
      patient.id
    FROM patient
    LEFT JOIN person
      ON patient.patient_id = person.id
    WHERE LOWER(person.first_name) = LOWER($1)
      AND LOWER(person.middle_name) = LOWER($2)
      AND LOWER(person.last_name) = LOWER($3)
      AND person.birthdate = $4
      AND person.male = $5
    ORDER BY SIMILARITY(LOWER(person.contact_number), LOWER($6)) DESC
      , SIMILARITY(LOWER(person.postal_code), LOWER($7)) DESC
      , SIMILARITY(LOWER(person.municipality), LOWER($8)) DESC
      , SIMILARITY(LOWER(person.city), LOWER($9)) DESC
      , SIMILARITY(LOWER(person.street_address), LOWER($10)) DESC
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
  ];

  var result = await db.query(query, params);

  if (!result.rows.length) {
    res.status(200).json(null);
    return;
  }

  const patientid = result.rows[0].id;

  query = `
  SELECT JSON_AGG(encounter) as encounter
  FROM
  (
    SELECT
      JSON_BUILD_OBJECT(
        'id',
        id,
        'subject',
        patient,
        'participant',
        doctor,
        'dateVisited',
        date_visited,
        'diagnosis',
        JSON_BUILD_OBJECT('text', diagnosis, 'code', code, 'system', system),
        'observation',
        JSON_AGG(data)
      ) AS encounter
    FROM
      (
        SELECT
          encounter,
          ROW_TO_JSON(rows) as data
        FROM
          (
            SELECT
              id,
              resource_type,
              created_at AS issued,
              encounter_id AS encounter,
              JSON_BUILD_OBJECT('code', code, 'system', system) AS code,
              JSON_BUILD_OBJECT('patient', patient) AS subject,
              JSON_BUILD_OBJECT('doctor', doctor) AS performer,
              JSON_BUILD_OBJECT('value', value, 'unit', unit) AS value,
            type as note
            FROM
              observation
            WHERE
              patient = $1
              AND DATE(created_at) > $2
          ) rows
      ) json
      LEFT JOIN encounter e ON e.id = json.encounter
    WHERE
      patient = $3
      AND DATE(created_at) > $4
    GROUP BY
      e.id
  ) a
  `;

  params = [patientid, lastDate, patientid, lastDate];
  result = await db.query(query, params);
  const data = result.rows[0].encounter;

  res.json(data);
});
module.exports = router;
