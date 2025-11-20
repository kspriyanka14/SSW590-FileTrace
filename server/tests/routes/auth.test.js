import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { config } from 'dotenv';
import app from '../../server.js';
import { connectToDb, closeConnection, getDb } from '../../config/index.js';

// Load test environment
config({ path: '.env.test' });

describe('Auth Routes', () => {
  let testUser = {
    username: 'testuser',
    email: 'test@example.com',
    password: 'Test1234',
  };

  beforeAll(async () => {
    await connectToDb();
  });

  beforeEach(async () => {
    // Clean users before each test for isolation
    const db = getDb();
    await db.collection('users').deleteMany({});
  });

  afterAll(async () => {
    // Final cleanup
    const db = getDb();
    await db.collection('users').deleteMany({});
    await closeConnection();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user with valid data', async () => {
      const response = await request(app).post('/api/auth/register').send({
        username: 'testuser',
        email: 'test@example.com',
        password: 'Test1234',
        confirmPassword: 'Test1234',
      });

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('User registered successfully');
      expect(response.body.user).toHaveProperty('_id');
      expect(response.body.user.username).toBe('testuser');
      expect(response.body.user.email).toBe('test@example.com');
      expect(response.body.user).not.toHaveProperty('password');
    });

    it('should fail with duplicate email', async () => {
      // Create first user
      await request(app).post('/api/auth/register').send({
        username: 'firstuser',
        email: 'test@example.com',
        password: 'Test1234',
        confirmPassword: 'Test1234',
      });

      // Try to create second user with same email
      const response = await request(app).post('/api/auth/register').send({
        username: 'anotheruser',
        email: 'test@example.com', // Same email
        password: 'Test1234',
        confirmPassword: 'Test1234',
      });

      expect(response.status).toBe(409);
      expect(response.body.error).toContain('already exists');
    });

    it('should fail with duplicate username', async () => {
      // Create first user
      await request(app).post('/api/auth/register').send({
        username: 'testuser',
        email: 'first@example.com',
        password: 'Test1234',
        confirmPassword: 'Test1234',
      });

      // Try to create second user with same username
      const response = await request(app).post('/api/auth/register').send({
        username: 'testuser', // Same username
        email: 'different@example.com',
        password: 'Test1234',
        confirmPassword: 'Test1234',
      });

      expect(response.status).toBe(409);
      expect(response.body.error).toContain('already exists');
    });

    it('should fail with weak password', async () => {
      const response = await request(app).post('/api/auth/register').send({
        username: 'newuser',
        email: 'new@example.com',
        password: 'weak',
        confirmPassword: 'weak',
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
    });

    it('should fail when passwords do not match', async () => {
      const response = await request(app).post('/api/auth/register').send({
        username: 'newuser2',
        email: 'new2@example.com',
        password: 'Test1234',
        confirmPassword: 'Different1234',
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
    });

    it('should fail with invalid email format', async () => {
      const response = await request(app).post('/api/auth/register').send({
        username: 'newuser3',
        email: 'invalid-email',
        password: 'Test1234',
        confirmPassword: 'Test1234',
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      // Create a user for login tests
      await request(app).post('/api/auth/register').send({
        username: testUser.username,
        email: testUser.email,
        password: testUser.password,
        confirmPassword: testUser.password,
      });
    });

    it('should login with valid credentials', async () => {
      const response = await request(app).post('/api/auth/login').send({
        email: testUser.email,
        password: testUser.password,
      });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Login successful');
      expect(response.body).toHaveProperty('token');
      expect(response.body.user.email).toBe(testUser.email);
      expect(response.body.user.username).toBe(testUser.username);
    });

    it('should fail with invalid email', async () => {
      const response = await request(app).post('/api/auth/login').send({
        email: 'nonexistent@example.com',
        password: 'Test1234',
      });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid email or password');
    });

    it('should fail with invalid password', async () => {
      const response = await request(app).post('/api/auth/login').send({
        email: 'test@example.com',
        password: 'WrongPassword123',
      });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid email or password');
    });

    it('should fail with missing credentials', async () => {
      const response = await request(app).post('/api/auth/login').send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
    });
  });

  describe('GET /api/auth/me', () => {
    let authToken;

    beforeEach(async () => {
      // Register and login to get a valid token
      await request(app).post('/api/auth/register').send({
        username: testUser.username,
        email: testUser.email,
        password: testUser.password,
        confirmPassword: testUser.password,
      });

      const loginResponse = await request(app).post('/api/auth/login').send({
        email: testUser.email,
        password: testUser.password,
      });
      authToken = loginResponse.body.token;
    });

    it('should get user info with valid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.user).toHaveProperty('_id');
      expect(response.body.user.email).toBe(testUser.email);
      expect(response.body.user.username).toBe(testUser.username);
    });

    it('should fail without token', async () => {
      const response = await request(app).get('/api/auth/me');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('No authentication token provided');
    });

    it('should fail with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid_token');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid authentication token');
    });

    it('should fail with malformed authorization header', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'InvalidFormat');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid authorization header format');
    });
  });

  describe('POST /api/auth/logout', () => {
    let authToken;

    beforeEach(async () => {
      // Register and login to get a valid token
      await request(app).post('/api/auth/register').send({
        username: testUser.username,
        email: testUser.email,
        password: testUser.password,
        confirmPassword: testUser.password,
      });

      const loginResponse = await request(app).post('/api/auth/login').send({
        email: testUser.email,
        password: testUser.password,
      });
      authToken = loginResponse.body.token;
    });

    it('should logout successfully with valid token', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Logout successful');
    });

    it('should fail logout without token', async () => {
      const response = await request(app).post('/api/auth/logout');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('No authentication token provided');
    });
  });
});
