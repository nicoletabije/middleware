const db = require("../db");
const pgp = require("pg-promise")(/* Initialization Options */);

const getPatientId = async (patient) => {
  var query = `
    SELECT 
      patient.id
    FROM person
    LEFT JOIN patient ON person.id = patient.patient_id
    WHERE LOWER(person.first_name) = LOWER($1)
    AND LOWER(person.middle_name) = LOWER($2) OR $2 IS NULL
      AND LOWER(person.last_name) = LOWER($3)
      AND person.birthdate = $4
      AND person.male = CAST($5 AS BOOLEAN)
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
    console.log(pgp.as.format(query, params));
    result = await db.query(query, params);
    const id = result.rows[0].id;

    query = `INSERT INTO patient(patient_id) VALUES ($1) RETURNING id`;
    params = [id];
    console.log(pgp.as.format(query, params));
    result = await db.query(query, params);
  }

  return result.rows[0].id;
};

module.exports = {
  getPatientId,
};
