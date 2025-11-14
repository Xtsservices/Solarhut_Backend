import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const host = (process.env.DB_HOST || '127.0.0.1').trim();
const user = (process.env.DB_USER || 'root').trim();
const password = (process.env.DB_PASSWORD || '').trim();
const database = (process.env.DB_NAME || '').trim();
const port = parseInt((process.env.DB_PORT || '3306').trim(), 10);

const pool = mysql.createPool({
  host,
  user,
  password,
  database,
  port,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

export const db = pool;
export default pool;

// optional: test connection at startup
(async () => {
  try {
    const conn = await pool.getConnection();
    await conn.ping();
    conn.release();
    console.log('✅ MySQL connected:', `${host}:${port}/${database}`);
  } catch (err) {
    console.error('❌ MySQL connection test failed:', err);
    // keep process exiting or handle accordingly
  }
})();
