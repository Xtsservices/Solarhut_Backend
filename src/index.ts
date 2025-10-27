import express, { Express } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import pool from './db';

dotenv.config();

const app: Express = express();
const port = process.env.PORT || 3000;

// Test database connection
pool.getConnection((err: Error | null, connection: any) => {
  if (err) {
    console.error('❌ Error connecting to the database:', err.message);
    return;
  }
  console.log('✅ Successfully connected to MySQL database');
  connection.release();
});

app.use(cors());
app.use(express.json());

// Basic route
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to SolarHut Backend API' });
});

app.listen(port, () => {
  console.log(`⚡️[server]: Server is running at http://localhost:${port}`);
});