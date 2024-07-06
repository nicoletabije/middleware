const db = require("../db");
const express = require("express");
const router = express.Router();
const pgp = require("pg-promise")(/* Initialization Options */);

router.post("/doctor-insert", async (req, res) => {
  const doctorInfo = req.body.doctor;
  console.log(req.body);

  var query = `
        SELECT id 
        FROM doctor
        WHERE doctor_id = $1 
    `;

  var params = [doctorInfo.qualification.id];

  console.log(pgp.as.format(query, params));
  var result = await db.query(query, params);
  if (result.rows.length == 0) {
    query = `
        WITH doctorid AS (
            INSERT INTO person(first_name, last_name, middle_name)
            VALUES ($1, $2, $3)
            RETURNING id
        )
        INSERT INTO doctor (person_id, doctor_id, profession)
        SELECT id, $4, $5
        FROM doctorid
        RETURNING id;
    `;
    params = [
      doctorInfo.name.given,
      doctorInfo.name.family,
      doctorInfo.name.middle,
      doctorInfo.qualification.id,
      doctorInfo.profession,
    ];
    console.log(pgp.as.format(query, params));
    result = await db.query(query, params);
  }
  res.json({ id: result.rows[0].id });
});

module.exports = router;
