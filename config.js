// config/index.js
require("dotenv").config();

const dbConnection = JSON.parse(process.env.DB_CONNECTION);

module.exports = {
  port: process.env.PORT || 3000,
  dbConnection: dbConnection,
};
