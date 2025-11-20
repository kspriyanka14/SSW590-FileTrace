import { beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { config } from 'dotenv';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectToDb, closeConnection, getDb } from '../config/index.js';

// Load test environment variables
config({ path: '.env.test' });

let mongoServer;

// Check if running in CI/CD environment (no .env.test with real Atlas URI)
const useInMemoryDB = !process.env.MONGODB_URI || process.env.CI === 'true';

/**
 * Mock AWS S3 operations for testing
 * This prevents actual S3 calls during tests
 */
vi.mock('../utils/s3.js', () => ({
  uploadToS3: vi.fn(async (buffer, userId, filename) => ({
    s3Key: `test/${userId}/${Date.now()}-${filename}`,
  })),
  getDownloadUrl: vi.fn(
    async (s3Key, filename) =>
      `https://mock-s3-url.com/${s3Key}?filename=${encodeURIComponent(
        filename
      )}`
  ),
  deleteFromS3: vi.fn(async () => {}),
}));

/**
 * Connect to test database before all tests
 * Uses MongoDB Memory Server in CI/CD, or real Atlas DB for local development
 */
beforeAll(async () => {
  if (useInMemoryDB) {
    // Start in-memory MongoDB server for CI/CD
    mongoServer = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongoServer.getUri();
    process.env.DB_NAME = 'filetrace-test';
    console.log('Connected to in-memory test database (CI/CD mode)');
  } else {
    // Use MongoDB Atlas for local development testing
    process.env.DB_NAME = process.env.DB_NAME || 'filetrace-test';
    console.log('Connected to MongoDB Atlas test database (local mode)');
  }

  await connectToDb();
});

/**
 * Clean all collections before each test
 * This ensures test isolation
 */
beforeEach(async () => {
  const db = getDb();
  const collections = await db.listCollections().toArray();

  for (const collection of collections) {
    await db.collection(collection.name).deleteMany({});
  }
});

/**
 * Close database connection and stop in-memory server after all tests
 */
afterAll(async () => {
  await closeConnection();

  if (mongoServer) {
    await mongoServer.stop();
    console.log('Stopped in-memory test database');
  } else {
    console.log('Closed test database connection');
  }
});
