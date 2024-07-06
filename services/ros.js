const db = require("../db");
const express = require("express");
const router = express.Router();
const pgp = require("pg-promise")(/* Initialization Options */);

router.post("/", async (req, res) => {
  console.log(req.body);
  res.json(req.body);
});

module.exports = router;
