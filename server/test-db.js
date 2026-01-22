// server/test-db.js
require("dotenv").config();
const { Pool } = require("pg");

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

console.log("Testing connection with:");
console.log(`User: ${process.env.DB_USER}`);
console.log(`DB Name: ${process.env.DB_NAME}`);
console.log(`Host: ${process.env.DB_HOST}`);

pool.query("SELECT NOW()", (err, res) => {
  if (err) {
    console.error("❌ CONNECTION FAILED!");
    console.error(err.message); // <--- THIS IS THE CLUE WE NEED
  } else {
    console.log("✅ CONNECTION SUCCESSFUL!");
    console.log("Database time:", res.rows[0].now);
  }
  pool.end();
});