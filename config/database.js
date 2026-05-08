const { Pool } = require("pg");

const pool = new Pool({
  host: "localhost",
  port: 5432,
  database: "festamais",
  user: "postgres",
  password: "210492"
});

module.exports = pool;
