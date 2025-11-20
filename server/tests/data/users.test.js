import { describe, it, expect } from 'vitest';
import usersData from '../../data/users.js';
import { getCollection, COLLECTIONS } from '../../config/index.js';

describe('Users Data Layer', () => {
  describe('createUser', () => {
    it('should create a user with valid data', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'Test1234',
      };

      const result = await usersData.createUser(userData);

      expect(result).toHaveProperty('_id');
      expect(result.username).toBe('testuser');
      expect(result.email).toBe('test@example.com');
      expect(result.password).not.toBe('Test1234'); // Should be hashed
      expect(result).toHaveProperty('createdAt');
      expect(result).toHaveProperty('updatedAt');
    });

    it('should throw error when creating user with duplicate email', async () => {
      const userData = {
        username: 'user1',
        email: 'duplicate@example.com',
        password: 'Test1234',
      };

      await usersData.createUser(userData);

      const duplicateUser = {
        username: 'user2',
        email: 'duplicate@example.com',
        password: 'Test1234',
      };

      await expect(usersData.createUser(duplicateUser)).rejects.toThrow(
        'Email already exists'
      );
    });

    it('should throw error when creating user with duplicate username', async () => {
      const userData = {
        username: 'duplicate',
        email: 'user1@example.com',
        password: 'Test1234',
      };

      await usersData.createUser(userData);

      const duplicateUser = {
        username: 'duplicate',
        email: 'user2@example.com',
        password: 'Test1234',
      };

      await expect(usersData.createUser(duplicateUser)).rejects.toThrow(
        'Username already exists'
      );
    });

    it('should throw error with invalid email format', async () => {
      const userData = {
        username: 'testuser',
        email: 'invalid-email',
        password: 'Test1234',
      };

      await expect(usersData.createUser(userData)).rejects.toThrow();
    });

    it('should throw error with weak password', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'weak',
      };

      await expect(usersData.createUser(userData)).rejects.toThrow();
    });

    it('should convert email to lowercase', async () => {
      const userData = {
        username: 'testuser',
        email: 'TEST@EXAMPLE.COM',
        password: 'Test1234',
      };

      const result = await usersData.createUser(userData);
      expect(result.email).toBe('test@example.com');
    });
  });

  describe('getUserByEmail', () => {
    it('should retrieve user by email', async () => {
      const userData = {
        username: 'testuser',
        email: 'find@example.com',
        password: 'Test1234',
      };

      await usersData.createUser(userData);
      const user = await usersData.getUserByEmail('find@example.com');

      expect(user).toBeDefined();
      expect(user.email).toBe('find@example.com');
      expect(user.username).toBe('testuser');
    });

    it('should return null for non-existent email', async () => {
      const user = await usersData.getUserByEmail('nonexistent@example.com');
      expect(user).toBeNull();
    });

    it('should be case-insensitive for email', async () => {
      const userData = {
        username: 'testuser',
        email: 'case@example.com',
        password: 'Test1234',
      };

      await usersData.createUser(userData);
      const user = await usersData.getUserByEmail('CASE@EXAMPLE.COM');

      expect(user).toBeDefined();
      expect(user.email).toBe('case@example.com');
    });

    it('should throw error with invalid email format', async () => {
      await expect(usersData.getUserByEmail('invalid-email')).rejects.toThrow();
    });
  });

  describe('getUserById', () => {
    it('should retrieve user by ID', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'Test1234',
      };

      const created = await usersData.createUser(userData);
      const user = await usersData.getUserById(created._id.toString());

      expect(user).toBeDefined();
      expect(user._id.toString()).toBe(created._id.toString());
      expect(user.username).toBe('testuser');
    });

    it('should return null for non-existent ID', async () => {
      const user = await usersData.getUserById('507f1f77bcf86cd799439011');
      expect(user).toBeNull();
    });

    it('should throw error with invalid ObjectId format', async () => {
      await expect(usersData.getUserById('invalid-id')).rejects.toThrow();
    });
  });

  describe('getUserByUsername', () => {
    it('should retrieve user by username', async () => {
      const userData = {
        username: 'findme',
        email: 'test@example.com',
        password: 'Test1234',
      };

      await usersData.createUser(userData);
      const user = await usersData.getUserByUsername('findme');

      expect(user).toBeDefined();
      expect(user.username).toBe('findme');
    });

    it('should return null for non-existent username', async () => {
      const user = await usersData.getUserByUsername('nonexistent');
      expect(user).toBeNull();
    });

    it('should throw error with invalid username format', async () => {
      await expect(usersData.getUserByUsername('ab')).rejects.toThrow(); // Too short
    });
  });

  describe('updateLastLogin', () => {
    it('should update last login timestamp', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'Test1234',
      };

      const created = await usersData.createUser(userData);
      const userId = created._id.toString();

      // Wait a bit to ensure different timestamp
      await new Promise((resolve) => setTimeout(resolve, 10));

      const result = await usersData.updateLastLogin(userId);

      expect(result.modifiedCount).toBe(1);

      // Verify the lastLogin was actually updated
      const collection = getCollection(COLLECTIONS.USERS);
      const updatedUser = await collection.findOne({ _id: created._id });

      expect(updatedUser.lastLogin).toBeDefined();
      expect(updatedUser.lastLogin).toBeInstanceOf(Date);
    });

    it('should throw error with invalid user ID', async () => {
      await expect(usersData.updateLastLogin('invalid-id')).rejects.toThrow();
    });

    it('should not throw error for non-existent user ID', async () => {
      const result = await usersData.updateLastLogin(
        '507f1f77bcf86cd799439011'
      );
      expect(result.modifiedCount).toBe(0);
    });
  });

  describe('getUserByEmailOrUsername', () => {
    it('should retrieve user by email', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'Test1234',
      };

      await usersData.createUser(userData);
      const user = await usersData.getUserByEmailOrUsername('test@example.com');

      expect(user).toBeDefined();
      expect(user.email).toBe('test@example.com');
    });

    it('should retrieve user by username', async () => {
      const userData = {
        username: 'findme',
        email: 'test@example.com',
        password: 'Test1234',
      };

      await usersData.createUser(userData);
      const user = await usersData.getUserByEmailOrUsername('findme');

      expect(user).toBeDefined();
      expect(user.username).toBe('findme');
    });

    it('should return null for non-existent identifier', async () => {
      const user = await usersData.getUserByEmailOrUsername('nonexistent');
      expect(user).toBeNull();
    });
  });
});
