import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const host = (process.env.DB_HOST || '').trim();
const user = (process.env.DB_USER || '').trim();
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

// Create a wrapper function to handle connection errors and retries
export const executeQuery = async (query: string, params?: any[], maxRetries: number = 3): Promise<any> => {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const [result] = await pool.execute(query, params);
      return [result];
    } catch (error: any) {
      lastError = error;
      console.warn(`Database query attempt ${attempt}/${maxRetries} failed:`, error.message);
      
      // Check if it's a connection error that we should retry
      const shouldRetry = [
        'ECONNRESET',
        'ENOTFOUND', 
        'ER_CON_COUNT_ERROR',
        'ECONNREFUSED',
        'ETIMEDOUT',
        'PROTOCOL_CONNECTION_LOST'
      ].some(code => error.code === code || error.message?.includes(code));
      
      if (!shouldRetry || attempt === maxRetries) {
        throw error;
      }
      
      // Wait before retrying (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }
  
  throw lastError;
};

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
