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

describe('Files Routes', () => {
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

  describe('POST /api/files/upload', () => {
    it('should upload file successfully with all required fields', async () => {
      const response = await request(app)
        .post('/api/files/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .field('filename', 'test-document.pdf')
        .field('description', 'Test file description')
        .field('category', 'Documents')
        .attach('file', Buffer.from('fake file content'), 'test-document.pdf');

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('File uploaded successfully');
      expect(response.body.file).toHaveProperty('_id');
      expect(response.body.file.filename).toBe('test-document.pdf');
      expect(response.body.file.description).toBe('Test file description');
      expect(response.body.file.category).toBe('Documents');

      // Verify S3 upload was called
      expect(s3Utils.uploadToS3).toHaveBeenCalledTimes(1);

      testFileId = response.body.file._id;
    });

    it('should upload file using original filename if not provided', async () => {
      const response = await request(app)
        .post('/api/files/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .field('category', 'Personal')
        .attach('file', Buffer.from('fake file content'), 'original-name.jpg');

      expect(response.status).toBe(201);
      expect(response.body.file.filename).toBe('original-name.jpg');
    });

    it('should fail without file', async () => {
      const response = await request(app)
        .post('/api/files/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .field('filename', 'test.pdf')
        .field('category', 'Documents');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('No file uploaded');
    });

    it('should fail with invalid category', async () => {
      const response = await request(app)
        .post('/api/files/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .field('filename', 'test.pdf')
        .field('category', 'InvalidCategory')
        .attach('file', Buffer.from('fake file content'), 'test.pdf');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
    });

    it('should fail without authentication', async () => {
      const response = await request(app)
        .post('/api/files/upload')
        .field('filename', 'test.pdf')
        .field('category', 'Documents')
        .attach('file', Buffer.from('fake file content'), 'test.pdf');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/files/my-files', () => {
    beforeEach(async () => {
      // Upload test files
      await request(app)
        .post('/api/files/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .field('filename', 'personal-file.txt')
        .field('category', 'Personal')
        .attach('file', Buffer.from('content'), 'personal-file.txt');

      await request(app)
        .post('/api/files/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .field('filename', 'work-document.pdf')
        .field('category', 'Work')
        .attach('file', Buffer.from('content'), 'work-document.pdf');
    });

    it('should get all files for authenticated user', async () => {
      const response = await request(app)
        .get('/api/files/my-files')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.files).toBeInstanceOf(Array);
      expect(response.body.files.length).toBe(2);
    });

    it('should filter files by search query', async () => {
      const response = await request(app)
        .get('/api/files/my-files?search=personal')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.files.length).toBe(1);
      expect(response.body.files[0].filename).toContain('personal');
    });

    it('should fail without authentication', async () => {
      const response = await request(app).get('/api/files/my-files');

      expect(response.status).toBe(401);
    });

    it('should return empty array when user has no files', async () => {
      const response = await request(app)
        .get('/api/files/my-files')
        .set('Authorization', `Bearer ${otherUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.files).toBeInstanceOf(Array);
      expect(response.body.files.length).toBe(0);
    });
  });

  describe('GET /api/files/my-files/:category', () => {
    beforeEach(async () => {
      await request(app)
        .post('/api/files/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .field('filename', 'personal-file.txt')
        .field('category', 'Personal')
        .attach('file', Buffer.from('content'), 'personal-file.txt');

      await request(app)
        .post('/api/files/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .field('filename', 'work-document.pdf')
        .field('category', 'Work')
        .attach('file', Buffer.from('content'), 'work-document.pdf');
    });

    it('should get files by valid category', async () => {
      const response = await request(app)
        .get('/api/files/my-files/Personal')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.files.length).toBe(1);
      expect(response.body.files[0].category).toBe('Personal');
      expect(response.body.category).toBe('Personal');
    });

    it('should filter by search within category', async () => {
      const response = await request(app)
        .get('/api/files/my-files/Personal?search=personal')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.files.length).toBe(1);
    });

    it('should fail with invalid category', async () => {
      const response = await request(app)
        .get('/api/files/my-files/InvalidCategory')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
    });

    it('should fail without authentication', async () => {
      const response = await request(app).get('/api/files/my-files/Personal');

      expect(response.status).toBe(401);
    });

    it('should return empty array for category with no files', async () => {
      const response = await request(app)
        .get('/api/files/my-files/Archive')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.files).toBeInstanceOf(Array);
      expect(response.body.files.length).toBe(0);
    });
  });

  describe('GET /api/files/download/:fileId', () => {
    let fileId;

    beforeEach(async () => {
      const uploadResponse = await request(app)
        .post('/api/files/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .field('filename', 'download-test.pdf')
        .field('category', 'Documents')
        .attach('file', Buffer.from('content'), 'download-test.pdf');

      fileId = uploadResponse.body.file._id;
    });

    it('should generate download URL for owned file', async () => {
      const response = await request(app)
        .get(`/api/files/download/${fileId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('downloadUrl');
      expect(response.body.filename).toBe('download-test.pdf');
      expect(response.body.expiresIn).toBe(3600);
      expect(s3Utils.getDownloadUrl).toHaveBeenCalledTimes(1);
    });

    it('should fail for non-existent file', async () => {
      const response = await request(app)
        .get('/api/files/download/507f1f77bcf86cd799439011')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('File not found');
    });

    it('should fail for file owned by different user', async () => {
      const response = await request(app)
        .get(`/api/files/download/${fileId}`)
        .set('Authorization', `Bearer ${otherUserToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('File not found');
    });

    it('should fail without authentication', async () => {
      const response = await request(app).get(`/api/files/download/${fileId}`);

      expect(response.status).toBe(401);
    });

    it('should fail with invalid fileId format', async () => {
      const response = await request(app)
        .get('/api/files/download/invalid-id')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
    });
  });

  describe('PATCH /api/files/:fileId/rename', () => {
    let fileId;

    beforeEach(async () => {
      const uploadResponse = await request(app)
        .post('/api/files/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .field('filename', 'original-name.pdf')
        .field('category', 'Documents')
        .attach('file', Buffer.from('content'), 'original-name.pdf');

      fileId = uploadResponse.body.file._id;
    });

    it('should rename owned file successfully', async () => {
      const response = await request(app)
        .patch(`/api/files/${fileId}/rename`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ filename: 'new-name.pdf' });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('File renamed successfully');
      expect(response.body.file.filename).toBe('new-name.pdf');
      expect(response.body.file.oldFilename).toBe('original-name.pdf');
    });

    it('should fail for non-existent file', async () => {
      const response = await request(app)
        .patch('/api/files/507f1f77bcf86cd799439011/rename')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ filename: 'new-name.pdf' });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('File not found');
    });

    it('should fail for file owned by different user', async () => {
      const response = await request(app)
        .patch(`/api/files/${fileId}/rename`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .send({ filename: 'new-name.pdf' });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('File not found');
    });

    it('should fail with invalid filename', async () => {
      const response = await request(app)
        .patch(`/api/files/${fileId}/rename`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ filename: '' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
    });

    it('should fail without authentication', async () => {
      const response = await request(app)
        .patch(`/api/files/${fileId}/rename`)
        .send({ filename: 'new-name.pdf' });

      expect(response.status).toBe(401);
    });

    it('should fail with invalid fileId format', async () => {
      const response = await request(app)
        .patch('/api/files/invalid-id/rename')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ filename: 'new-name.pdf' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
    });
  });

  describe('DELETE /api/files/:fileId', () => {
    let fileId;

    beforeEach(async () => {
      const uploadResponse = await request(app)
        .post('/api/files/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .field('filename', 'delete-test.pdf')
        .field('category', 'Documents')
        .attach('file', Buffer.from('content'), 'delete-test.pdf');

      fileId = uploadResponse.body.file._id;
      vi.clearAllMocks(); // Clear upload mock calls
    });

    it('should delete owned file successfully', async () => {
      const response = await request(app)
        .delete(`/api/files/${fileId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('File deleted successfully');
      expect(response.body.fileId).toBe(fileId);
      expect(s3Utils.deleteFromS3).toHaveBeenCalledTimes(1);
    });

    it('should fail for non-existent file', async () => {
      const response = await request(app)
        .delete('/api/files/507f1f77bcf86cd799439011')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('File not found');
    });

    it('should fail for file owned by different user', async () => {
      const response = await request(app)
        .delete(`/api/files/${fileId}`)
        .set('Authorization', `Bearer ${otherUserToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('File not found');
    });

    it('should fail without authentication', async () => {
      const response = await request(app).delete(`/api/files/${fileId}`);

      expect(response.status).toBe(401);
    });

    it('should fail with invalid fileId format', async () => {
      const response = await request(app)
        .delete('/api/files/invalid-id')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
    });
  });

  describe('GET /api/files/:fileId/details', () => {
    let fileId;

    beforeEach(async () => {
      const uploadResponse = await request(app)
        .post('/api/files/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .field('filename', 'details-test.pdf')
        .field('description', 'Test description')
        .field('category', 'Documents')
        .attach('file', Buffer.from('content'), 'details-test.pdf');

      fileId = uploadResponse.body.file._id;
    });

    it('should get details for owned file', async () => {
      const response = await request(app)
        .get(`/api/files/${fileId}/details`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.file).toHaveProperty('_id');
      expect(response.body.file.filename).toBe('details-test.pdf');
      expect(response.body.file.description).toBe('Test description');
      expect(response.body.file.category).toBe('Documents');
      expect(response.body.file).toHaveProperty('size');
      expect(response.body.file).toHaveProperty('mimetype');
      expect(response.body.file).toHaveProperty('uploadedAt');
    });

    it('should fail for non-existent file', async () => {
      const response = await request(app)
        .get('/api/files/507f1f77bcf86cd799439011/details')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('File not found');
    });

    it('should fail for file owned by different user', async () => {
      const response = await request(app)
        .get(`/api/files/${fileId}/details`)
        .set('Authorization', `Bearer ${otherUserToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('File not found');
    });

    it('should fail without authentication', async () => {
      const response = await request(app).get(`/api/files/${fileId}/details`);

      expect(response.status).toBe(401);
    });

    it('should fail with invalid fileId format', async () => {
      const response = await request(app)
        .get('/api/files/invalid-id/details')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
    });
  });
});
