import express, { Express, Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import { initializeDatabase } from './src/schema';
import { cleanupExpiredOTPs } from './src/queries/otpQueries';
import db from './src/db';
import leadRoutes from './src/routes/leadRoutes';
import assignLeadsRoutes from './src/routes/assignLeadsRoutes';
import authRoutes from './src/routes/authRoutes';
import contactRoutes from './src/routes/contactRoutes';
import employeeRoutes from './src/routes/employeeRoutes';
import roleRoutes from './src/routes/roleRoutes';
import packageRoutes from './src/routes/packageRoutes';
import featureRoutes from './src/routes/featureRoutes';
import permissionRoutes from './src/routes/permissionRoutes';
import countryRoutes from './src/routes/countryRoutes';
import stateRoutes from './src/routes/stateRoutes';
import districtRoutes from './src/routes/districtRoutes';
import customerRoutes from './src/routes/customerRoutes';
import jobRoutes from './src/routes/jobRoutes';
import myTasksRoutes from './src/routes/myTasksRoutes';
import profileRoutes from './src/routes/profileRoutes';
import statsRoutes from './src/routes/statsRoutes';
import paymentsStatsRoutes from './src/routes/paymentsStatsRoutes';
import estimationRoutes from './src/routes/estimationRoutes';
import taxInvoiceRoutes from './src/routes/taxInvoiceRoutes';
import invoiceRoutes from './src/routes/invoiceRoutes';
import paymentsSummaryRoutes from './src/routes/paymentsSummaryRoutes';
import summaryGraphRoutes from './src/routes/summaryGraphRoutes';
import solarCapacityRoutes from './src/routes/solarCapacityRoutes';
import bankDetailsRoutes from './src/routes/bankDetailsRoutes';

dotenv.config();
      
const app: Express = express();
const port = parseInt(process.env.PORT || '3200', 10);


// CORS configuration - MUST be applied first
app.use(cors({
  origin: true, // Allow all origins
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'Accept', 'X-Requested-With'],
  exposedHeaders: ['Content-Length', 'Content-Range'],
  maxAge: 86400, // 24 hours
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

// Body parsing middleware
app.use(express.json());

// Error handling middleware
const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
};

// Create Database connection and start server
const createDbConnection = async () => {
    try {
        await db.getConnection();
        console.log('✅ Successfully connected to MySQL database');
    } catch (error) {
        console.error('❌ Error connecting to MySQL database:', error);
        process.exit(1);
    }
};

// Database initialization
const initApp = async () => {
  try {
    // Test database connection
    await db.getConnection();
    console.log('✅ Successfully connected to MySQL database');
    
    // Initialize database tables
    await initializeDatabase();
    
    // Start OTP cleanup scheduler (every 5 minutes)
    const startOTPCleanup = () => {
      setInterval(async () => {
        try {
          await cleanupExpiredOTPs();
        } catch (error) {
          console.error('Error during OTP cleanup:', error);
        }
      }, 5 * 60 * 1000); // 5 minutes
    };
    
    // Initial cleanup on startup
    try {
      console.log('🧹 Starting OTP cleanup...');
      await cleanupExpiredOTPs();
      startOTPCleanup();
      console.log('🕒 OTP cleanup scheduler started (runs every 5 minutes)');
    } catch (error) {
      console.error('Error starting OTP cleanup:', error);
    }

    console.log('🛣️  Setting up routes...');
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
    app.use('/api/assignleads', assignLeadsRoutes);
    app.use('/api/packages', packageRoutes);
    app.use('/api/features', featureRoutes);
    app.use('/api/permissions', permissionRoutes);
    app.use('/api/auth', authRoutes);
    app.use('/api/contacts', contactRoutes);
    app.use('/api/employees', employeeRoutes);
    app.use('/api/roles', roleRoutes);
    app.use('/api/countries', countryRoutes);
    app.use('/api/states', stateRoutes);
    app.use('/api/districts', districtRoutes);
    app.use('/api/customers', customerRoutes);
    app.use('/api/jobs', jobRoutes);
    app.use('/api/mytasks', myTasksRoutes);
    app.use('/api/estimations', estimationRoutes);
    app.use('/api/invoices', invoiceRoutes);
    app.use('/api/taxinvoices', taxInvoiceRoutes);
    app.use('/api/solar-capacities', solarCapacityRoutes);
    app.use('/api/bank-details', bankDetailsRoutes);
    // Mount new dashboard/statistics routes
    app.use('/api/stats', statsRoutes);
    
    app.use('/api/profile', profileRoutes);
    app.use('/api/payments/stats', paymentsStatsRoutes);
    app.use('/api/payments', paymentsSummaryRoutes);
    app.use('/api/summary', summaryGraphRoutes);


    // 404 handler
    app.use((req: Request, res: Response) => {
      res.status(404).json({
        success: false,
        message: `Route ${req.method} ${req.url} not found`
      });
    });

    // Error handler
    app.use(errorHandler);

    console.log('🔧 About to start server on port:', port);
    const server = app.listen(port, '0.0.0.0', () => {
      console.log('\n🚀 Server Initialization Complete');
      console.log(`⚡️ Server running at http://localhost:${port}`);
      console.log(`⚡️ Server also accessible at http://0.0.0.0:${port}`);
      console.log('\n📝 Available Routes:');
      console.log('   GET    /           - Welcome page');
      console.log('   GET    /health     - Health check');
      console.log('   POST   /api/leads  - Create new lead');
      console.log('\n✅ Database connected successfully\n');
    });

    server.on('error', (err) => {
      console.error('❌ Server error:', err);
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