import mysql from 'mysql2/promise';

// Database connection pool configuration
const pool = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "Pardhu@9949",
  database: "solarhut_local",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

export const db = pool;
export default pool;
