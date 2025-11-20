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
import * as s3Utils from '../../utils/s3.js';

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

describe('Share Routes', () => {
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
    await db.collection('shareLinks').deleteMany({});
    await db.collection('userShares').deleteMany({});
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

    // Create test file for user 1
    const uploadResponse = await request(app)
      .post('/api/files/upload')
      .set('Authorization', `Bearer ${authToken}`)
      .field('filename', 'share-test.pdf')
      .field('category', 'Documents')
      .attach('file', Buffer.from('content'), 'share-test.pdf');

    testFileId = uploadResponse.body.file._id;

    // Clear mock call history
    vi.clearAllMocks();
  });

  afterAll(async () => {
    const db = getDb();
    await db.collection('users').deleteMany({});
    await db.collection('files').deleteMany({});
    await db.collection('shareLinks').deleteMany({});
    await db.collection('userShares').deleteMany({});
    await db.collection('auditLogs').deleteMany({});
    await closeConnection();
  });

  describe('POST /api/share/create', () => {
    describe('User shares', () => {
      it('should create user share with both time and count expiration', async () => {
        const response = await request(app)
          .post('/api/share/create')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            fileId: testFileId,
            shareType: 'user',
            recipientIdentifier: 'otheruser',
            expirationHours: 24,
            maxAccessCount: 5,
          });

        expect(response.status).toBe(201);
        expect(response.body.message).toBe(
          'File shared with user successfully'
        );
        expect(response.body.share.shareType).toBe('user');
        expect(response.body.share.recipient.username).toBe('otheruser');
        expect(response.body.share).toHaveProperty('expiresAt');
        expect(response.body.share.maxAccessCount).toBe(5);
      });

      it('should create user share with only time expiration', async () => {
        const response = await request(app)
          .post('/api/share/create')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            fileId: testFileId,
            shareType: 'user',
            recipientIdentifier: 'other@example.com',
            expirationHours: 48,
          });

        expect(response.status).toBe(201);
        expect(response.body.share).toHaveProperty('expiresAt');
        expect(response.body.share.maxAccessCount).toBeUndefined();
      });

      it('should create user share with only count expiration', async () => {
        const response = await request(app)
          .post('/api/share/create')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            fileId: testFileId,
            shareType: 'user',
            recipientIdentifier: 'otheruser',
            maxAccessCount: 10,
          });

        expect(response.status).toBe(201);
        expect(response.body.share.maxAccessCount).toBe(10);
        expect(response.body.share.expiresAt).toBeUndefined();
      });

      it('should fail for non-existent recipient user', async () => {
        const response = await request(app)
          .post('/api/share/create')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            fileId: testFileId,
            shareType: 'user',
            recipientIdentifier: 'nonexistent@example.com',
            expirationHours: 24,
          });

        expect(response.status).toBe(404);
        expect(response.body.error).toBe('Recipient user not found');
      });
    });

    describe('Link shares', () => {
      it('should create link share with both time and count expiration', async () => {
        const response = await request(app)
          .post('/api/share/create')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            fileId: testFileId,
            shareType: 'link',
            expirationHours: 24,
            maxAccessCount: 3,
          });

        expect(response.status).toBe(201);
        expect(response.body.message).toBe('Share link created successfully');
        expect(response.body.share).toHaveProperty('token');
        expect(response.body.share).toHaveProperty('shareUrl');
        expect(response.body.share.shareUrl).toContain(
          response.body.share.token
        );
        expect(response.body.share).toHaveProperty('expiresAt');
        expect(response.body.share.maxAccessCount).toBe(3);
      });

      it('should create link share with only time expiration', async () => {
        const response = await request(app)
          .post('/api/share/create')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            fileId: testFileId,
            shareType: 'link',
            expirationHours: 72,
          });

        expect(response.status).toBe(201);
        expect(response.body.share).toHaveProperty('token');
        expect(response.body.share).toHaveProperty('expiresAt');
        expect(response.body.share.maxAccessCount).toBeUndefined();
      });

      it('should create link share with only count expiration', async () => {
        const response = await request(app)
          .post('/api/share/create')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            fileId: testFileId,
            shareType: 'link',
            maxAccessCount: 5,
          });

        expect(response.status).toBe(201);
        expect(response.body.share.maxAccessCount).toBe(5);
        expect(response.body.share.expiresAt).toBeUndefined();
      });
    });

    describe('Validation tests', () => {
      it('should fail when neither expiration is provided', async () => {
        const response = await request(app)
          .post('/api/share/create')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            fileId: testFileId,
            shareType: 'link',
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Validation failed');
        expect(
          response.body.details.some((d) =>
            d.includes('At least one expiration method')
          )
        ).toBe(true);
      });

      it('should fail for non-existent file', async () => {
        const response = await request(app)
          .post('/api/share/create')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            fileId: '507f1f77bcf86cd799439011',
            shareType: 'link',
            expirationHours: 24,
          });

        expect(response.status).toBe(404);
        expect(response.body.error).toBe('File not found');
      });

      it('should fail for file owned by different user', async () => {
        const response = await request(app)
          .post('/api/share/create')
          .set('Authorization', `Bearer ${otherUserToken}`)
          .send({
            fileId: testFileId,
            shareType: 'link',
            expirationHours: 24,
          });

        expect(response.status).toBe(404);
        expect(response.body.error).toBe('File not found');
      });

      it('should fail without authentication', async () => {
        const response = await request(app).post('/api/share/create').send({
          fileId: testFileId,
          shareType: 'link',
          expirationHours: 24,
        });

        expect(response.status).toBe(401);
      });

      it('should fail with invalid shareType', async () => {
        const response = await request(app)
          .post('/api/share/create')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            fileId: testFileId,
            shareType: 'invalid',
            expirationHours: 24,
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Validation failed');
      });

      it('should fail with invalid fileId format', async () => {
        const response = await request(app)
          .post('/api/share/create')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            fileId: 'invalid-id',
            shareType: 'link',
            expirationHours: 24,
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Validation failed');
      });
    });
  });

  describe('GET /api/share/:token', () => {
    let shareToken;

    beforeEach(async () => {
      // Create a valid share link
      const createResponse = await request(app)
        .post('/api/share/create')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          fileId: testFileId,
          shareType: 'link',
          expirationHours: 24,
          maxAccessCount: 3,
        });

      shareToken = createResponse.body.share.token;
    });

    it('should access shared file via valid link', async () => {
      const response = await request(app).get(`/api/share/${shareToken}`);

      expect(response.status).toBe(200);
      expect(response.body.file).toHaveProperty('filename');
      expect(response.body.file.filename).toBe('share-test.pdf');
      expect(response.body).toHaveProperty('downloadUrl');
      expect(s3Utils.getDownloadUrl).toHaveBeenCalledTimes(1);
    });

    it('should return file info and remaining accesses', async () => {
      const response = await request(app).get(`/api/share/${shareToken}`);

      expect(response.status).toBe(200);
      expect(response.body.file).toHaveProperty('filename');
      expect(response.body.file).toHaveProperty('size');
      expect(response.body.file).toHaveProperty('mimetype');
      expect(response.body.remainingAccesses).toBe(2); // Started with 3, used 1
      expect(response.body).toHaveProperty('expiresAt');
    });

    it('should increment access count on each access', async () => {
      // First access
      await request(app).get(`/api/share/${shareToken}`);
      const firstResponse = await request(app).get(`/api/share/${shareToken}`);
      expect(firstResponse.body.remainingAccesses).toBe(1); // 3 - 2 = 1

      // Second access
      const secondResponse = await request(app).get(`/api/share/${shareToken}`);
      expect(secondResponse.body.remainingAccesses).toBe(0); // 3 - 3 = 0
    });

    it('should fail for link at max accesses', async () => {
      // Use up all accesses
      await request(app).get(`/api/share/${shareToken}`); // 1
      await request(app).get(`/api/share/${shareToken}`); // 2
      await request(app).get(`/api/share/${shareToken}`); // 3

      // Try to access again
      const response = await request(app).get(`/api/share/${shareToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toContain(
        'expired or reached maximum accesses'
      );
    });

    it('should fail for invalid token', async () => {
      // Use a valid-looking token (64 hex chars) that doesn't exist in database
      const fakeToken = 'a'.repeat(64);
      const response = await request(app).get(`/api/share/${fakeToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toContain(
        'expired or reached maximum accesses'
      );
    });

    it('should log EXPIRED_LINK_ATTEMPT on expired link', async () => {
      const db = getDb();

      // Use a valid-looking token (64 hex chars) that doesn't exist in database
      const fakeToken = 'b'.repeat(64);
      await request(app).get(`/api/share/${fakeToken}`);

      // Check audit logs
      const auditLogs = await db
        .collection('auditLogs')
        .find({ action: 'EXPIRED_LINK_ATTEMPT' })
        .toArray();
      expect(auditLogs.length).toBeGreaterThan(0);
    });

    it('should work without authentication (public access)', async () => {
      const response = await request(app).get(`/api/share/${shareToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('downloadUrl');
    });
  });

  describe('GET /api/share/shared-with-me', () => {
    beforeEach(async () => {
      // User 1 shares a file with User 2
      await request(app)
        .post('/api/share/create')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          fileId: testFileId,
          shareType: 'user',
          recipientIdentifier: 'otheruser',
          expirationHours: 24,
        });
    });

    it('should get files shared with current user', async () => {
      const response = await request(app)
        .get('/api/share/shared-with-me')
        .set('Authorization', `Bearer ${otherUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.files).toBeInstanceOf(Array);
      expect(response.body.files.length).toBe(1);
      expect(response.body.files[0].file.filename).toBe('share-test.pdf');
      expect(response.body.files[0].share).toHaveProperty('expiresAt');
    });

    it('should return empty array when no files shared', async () => {
      const response = await request(app)
        .get('/api/share/shared-with-me')
        .set('Authorization', `Bearer ${authToken}`); // User 1 has no shares

      expect(response.status).toBe(200);
      expect(response.body.files).toBeInstanceOf(Array);
      expect(response.body.files.length).toBe(0);
    });

    it('should fail without authentication', async () => {
      const response = await request(app).get('/api/share/shared-with-me');

      expect(response.status).toBe(401);
    });
  });
});
