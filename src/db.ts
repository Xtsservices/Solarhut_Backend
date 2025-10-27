import mysql from 'mysql2';

// Database connection pool configuration
const pool = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "Pardhu@9949",
  database: "solarhut_local"
});

export default pool;
