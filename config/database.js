const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  user: process.env.DB_USER || "beth",
  host: process.env.DB_HOST || "localhost",
  database: process.env.DB_NAME || "beth_chat_service",
  password: process.env.DB_PASSWORD || "8826",
  port: process.env.DB_PORT || 5432
});

module.exports = pool;
