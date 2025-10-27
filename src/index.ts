import express, { Express } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import { db } from './db';
import { initializeDatabase } from './schema';
import contactRoutes from './routes/contactRoutes';

dotenv.config();

const app: Express = express();
const port = process.env.PORT || 3000;

// Database initialization
const initApp = async () => {
  try {
    // Test database connection
    await db.getConnection();
    console.log('✅ Successfully connected to MySQL database');
    
    // Initialize database tables
    await initializeDatabase();
    
    app.use(cors());
    app.use(express.json());

    // Routes
    app.use('/api', contactRoutes);

    // Basic route
    app.get('/', (req, res) => {
      res.json({ message: 'Welcome to SolarHut Backend API' });
    });

    app.listen(port, () => {
      console.log(`⚡️[server]: Server is running at http://localhost:${port}`);
    });

  } catch (error) {
    console.error('❌ Error initializing application:', error);
    process.exit(1);
  }
};

initApp();