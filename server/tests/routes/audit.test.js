import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi,
} from 'vitest';
import request from 'supertest';
import { config } from 'dotenv';
import app from '../../server.js';
import { connectToDb, closeConnection, getDb } from '../../config/index.js';

// Load test environment
config({ path: '.env.test' });

// Mock S3 operations
vi.mock('../../utils/s3.js', () => ({
  uploadToS3: vi.fn(async (buffer, userId, filename, mimetype) => ({
    s3Key: `users/${userId}/${Date.now()}-${filename}`,
  })),
  getDownloadUrl: vi.fn(
    async (s3Key, filename, expiresIn) =>
      `https://s3.amazonaws.com/test-bucket/${s3Key}?expires=${expiresIn}`
  ),
  deleteFromS3: vi.fn(async (s3Key) => true),
}));

describe('Audit Routes', () => {
  let authToken;
  let userId;
  let otherUserToken;
  let otherUserId;
  let testFileId;

  beforeAll(async () => {
    await connectToDb();
  });

  beforeEach(async () => {
    const db = getDb();
    // Clean all collections before each test
    await db.collection('users').deleteMany({});
    await db.collection('files').deleteMany({});
    await db.collection('auditLogs').deleteMany({});

    // Create test user 1
    await request(app).post('/api/auth/register').send({
      username: 'testuser',
      email: 'test@example.com',
      password: 'Test1234',
      confirmPassword: 'Test1234',
    });

    const loginResponse = await request(app).post('/api/auth/login').send({
      email: 'test@example.com',
      password: 'Test1234',
    });

    authToken = loginResponse.body.token;
    userId = loginResponse.body.user._id;

    // Create test user 2
    await request(app).post('/api/auth/register').send({
      username: 'otheruser',
      email: 'other@example.com',
      password: 'Test1234',
      confirmPassword: 'Test1234',
    });

    const otherLoginResponse = await request(app).post('/api/auth/login').send({
      email: 'other@example.com',
      password: 'Test1234',
    });

    otherUserToken = otherLoginResponse.body.token;
    otherUserId = otherLoginResponse.body.user._id;

    // Clear mock call history
    vi.clearAllMocks();
  });

  afterAll(async () => {
    const db = getDb();
    await db.collection('users').deleteMany({});
    await db.collection('files').deleteMany({});
    await db.collection('auditLogs').deleteMany({});
    await closeConnection();
  });

  describe('GET /api/audit/file/:fileId', () => {
    beforeEach(async () => {
      // Upload a file (creates UPLOAD audit log)
      const uploadResponse = await request(app)
        .post('/api/files/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .field('filename', 'audit-test.pdf')
        .field('category', 'Documents')
        .attach('file', Buffer.from('content'), 'audit-test.pdf');

      testFileId = uploadResponse.body.file._id;

      // Download file (creates DOWNLOAD audit log)
      await request(app)
        .get(`/api/files/download/${testFileId}`)
        .set('Authorization', `Bearer ${authToken}`);

      // Rename file (creates NAME_CHANGE audit log)
      await request(app)
        .patch(`/api/files/${testFileId}/rename`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ filename: 'renamed-audit-test.pdf' });
    });

    it('should get audit logs for owned file with logs', async () => {
      const response = await request(app)
        .get(`/api/audit/file/${testFileId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.logs).toBeInstanceOf(Array);
      expect(response.body.logs.length).toBeGreaterThan(0);
    });

    it('should return audit logs with correct action types', async () => {
      const response = await request(app)
        .get(`/api/audit/file/${testFileId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      const actions = response.body.logs.map((log) => log.action);
      expect(actions).toContain('UPLOAD');
      expect(actions).toContain('DOWNLOAD');
      expect(actions).toContain('NAME_CHANGE');
    });

    it('should return audit logs ordered by timestamp (newest first)', async () => {
      const response = await request(app)
        .get(`/api/audit/file/${testFileId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      const logs = response.body.logs;

      // Verify timestamps are in descending order
      for (let i = 0; i < logs.length - 1; i++) {
        const currentTimestamp = new Date(logs[i].timestamp).getTime();
        const nextTimestamp = new Date(logs[i + 1].timestamp).getTime();
        expect(currentTimestamp).toBeGreaterThanOrEqual(nextTimestamp);
      }
    });

    it('should include audit log details like IP and action-specific data', async () => {
      const response = await request(app)
        .get(`/api/audit/file/${testFileId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      const logs = response.body.logs;

      // Check NAME_CHANGE log has old and new filename
      const nameChangeLog = logs.find((log) => log.action === 'NAME_CHANGE');
      expect(nameChangeLog).toBeDefined();
      expect(nameChangeLog.details).toHaveProperty('oldFilename');
      expect(nameChangeLog.details).toHaveProperty('newFilename');
      expect(nameChangeLog.details.oldFilename).toBe('audit-test.pdf');
      expect(nameChangeLog.details.newFilename).toBe('renamed-audit-test.pdf');
    });

    it('should return empty array when file has no logs', async () => {
      // Insert a file directly to database without creating audit logs
      const db = getDb();
      const { ObjectId } = await import('mongodb');

      const fileDoc = {
        _id: new ObjectId(),
        filename: 'no-logs.pdf',
        description: '',
        category: 'Personal',
        size: 1024,
        mimetype: 'application/pdf',
        s3Key: `users/${userId}/no-logs.pdf`,
        originalFilename: 'no-logs.pdf',
        ownerId: new ObjectId(userId),
        uploadedAt: new Date(),
        lastAccessedAt: new Date(),
        accessCount: 0,
      };

      await db.collection('files').insertOne(fileDoc);
      const newFileId = fileDoc._id.toString();

      const response = await request(app)
        .get(`/api/audit/file/${newFileId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.logs).toBeInstanceOf(Array);
      expect(response.body.logs.length).toBe(0);
    });

    it('should fail for non-existent file', async () => {
      const response = await request(app)
        .get('/api/audit/file/507f1f77bcf86cd799439011')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('File not found');
    });

    it('should fail for file owned by different user', async () => {
      const response = await request(app)
        .get(`/api/audit/file/${testFileId}`)
        .set('Authorization', `Bearer ${otherUserToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('File not found');
    });

    it('should fail without authentication', async () => {
      const response = await request(app).get(`/api/audit/file/${testFileId}`);

      expect(response.status).toBe(401);
    });

    it('should fail with invalid fileId format', async () => {
      const response = await request(app)
        .get('/api/audit/file/invalid-id')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
    });
  });
});
