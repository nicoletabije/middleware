require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const app = express();
const { Client } = require("pg");
const config = require("./config");
const db = require("./db");

const patientService = require("./services/patient");
const encounterService = require("./services/encounter");
const userService = require("./services/user");
const careplanService = require("./services/careplan");
const issuesService = require("./services/issues");
const rosService = require("./services/ros");
const vitalsAndBiometricsService = require("./services/vitals-and-biometrics");
const signsAndSymptomsService = require("./services/signs-and-symptoms");
const allergyService = require("./services/allergy");
const medicationService = require("./services/medication");
const fullService = require("./services/full");
app.use(cors({ origin: true }));
app.use(bodyParser.json());

app.use("/patient", patientService);
app.use("/encounter", encounterService);
app.use("/user", userService);
app.use("/careplan", careplanService);
app.use("/issues", issuesService);
app.use("/ros", rosService);
app.use("/allergy", allergyService);
app.use("/medication", medicationService);
app.use("/signs-and-symptoms", signsAndSymptomsService);
app.use("/vitals-and-biometrics", vitalsAndBiometricsService);
app.use("/full", fullService);

app.listen(config.port || 2000, () => {
  console.log(`Listening on port ${config.port || 2000}`);
});
