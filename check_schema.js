const mysql = require('mysql2/promise');

(async () => {
  const pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: 'Pardhu@9949',
    database: 'solarhut_local'
  });
  
  const conn = await pool.getConnection();
  const [rows] = await conn.execute(`
    SELECT COLUMN_TYPE 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME='leads' AND COLUMN_NAME='status'
  `);
  
  console.log('Status column type:', rows[0].COLUMN_TYPE);
  process.exit(0);
})().catch(err => {
  console.error(err);
  process.exit(1);
});
