import express from 'express';
import { config } from 'dotenv';
import helmet from 'helmet';
import cors from 'cors';
import { connectToDb, getDb } from './config/index.js';
import configRoutes from './routes/index.js';
import { checkS3Connectivity } from './utils/s3.js';

// Load environment variables
config();

// Create Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());

// CORS configuration
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  })
);

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', async (_req, res) => {
  const health = {
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    status: 'healthy',
    checks: {
      database: 'unknown',
      s3: 'unknown',
    },
  };

  try {
    // Check database connectivity
    const db = getDb();
    await db.admin().ping();
    health.checks.database = 'connected';
  } catch (dbError) {
    health.status = 'unhealthy';
    health.checks.database = 'disconnected';
    health.error = dbError.message;
    return res.status(503).json(health);
  }

  try {
    // Check S3 accessibility
    await checkS3Connectivity();
    health.checks.s3 = 'accessible';
  } catch (s3Error) {
    health.status = 'unhealthy';
    health.checks.s3 = 'inaccessible';
    health.error = s3Error.message;
    return res.status(503).json(health);
  }

  res.status(200).json(health);
});

// Configure routes
configRoutes(app);

// Start server only if this file is run directly (not imported)
const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectToDb();
    console.log('Database connection established');

    // Start listening
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Only start server if running directly (not in tests)
if (process.env.NODE_ENV !== 'test') {
  startServer();
}

export default app;
