import express, { Express, Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import { db } from './db';
import { initializeDatabase } from './schema';
import leadRoutes from './routes/leadRoutes';

dotenv.config();

const app: Express = express();
const port = process.env.PORT || 3000;

// Error handling middleware
const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
};

// Database initialization
const initApp = async () => {
  try {
    // Test database connection
    await db.getConnection();
    console.log('✅ Successfully connected to MySQL database');
    
    // Initialize database tables
    await initializeDatabase();
    
    // Global Middleware
    app.use(cors());
    app.use(express.json());

    // Welcome route
    app.get('/', (req: Request, res: Response) => {
      res.json({
        message: 'Welcome to SolarHut Backend API',
        version: '1.0.0',
        endpoints: {
          leads: '/api/leads'
        }
      });
    });

    // Health check route
    app.get('/health', (req: Request, res: Response) => {
      res.json({
        status: 'healthy',
        database: 'connected',
        timestamp: new Date().toISOString()
      });
    });

    // Mount API routes
    app.use('/api/leads', leadRoutes);

    // 404 handler
    app.use((req: Request, res: Response) => {
      res.status(404).json({
        success: false,
        message: `Route ${req.method} ${req.url} not found`
      });
    });

    // Error handler
    app.use(errorHandler);

    app.listen(port, () => {
      console.log('\n🚀 Server Initialization Complete');
      console.log(`⚡️ Server running at http://localhost:${port}`);
      console.log('\n📝 Available Routes:');
      console.log('   GET    /           - Welcome page');
      console.log('   GET    /health     - Health check');
      console.log('   POST   /api/leads  - Create new lead');
      console.log('\n✅ Database connected successfully\n');
    });

  } catch (error) {
    console.error('❌ Error initializing application:', error);
    process.exit(1);
  }
};

// Handle uncaught errors
process.on('unhandledRejection', (reason: Error) => {
  console.error('❌ Unhandled Rejection:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error: Error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

initApp().catch(error => {
  console.error('❌ Fatal error during initialization:', error);
  process.exit(1);
});