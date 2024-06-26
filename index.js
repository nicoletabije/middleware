require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const app = express();
const { Client } = require("pg");
const config = require("./config");
const db = require("./db");

const patientService = require("./services/patient");
app.use(cors({ origin: true }));
app.use(bodyParser.json());
app.use("/patient", patientService);

app.listen(config.port || 2000, () => {
  console.log(`Listening on port ${config.port || 2000}`);
});
