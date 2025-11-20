import { describe, it, expect, beforeEach } from 'vitest';
import filesData from '../../data/files.js';
import usersData from '../../data/users.js';

describe('Files Data Layer', () => {
  let testUser;
  let testUserId;

  beforeEach(async () => {
    // Create a test user for file operations
    testUser = await usersData.createUser({
      username: 'fileowner',
      email: 'fileowner@example.com',
      password: 'Test1234',
    });
    testUserId = testUser._id.toString();
  });

  describe('createFile', () => {
    it('should create a file with valid data', async () => {
      const fileData = {
        filename: 'test-document.pdf',
        originalFilename: 'original-test.pdf',
        description: 'Test file description',
        category: 'Documents',
        size: 1024000,
        mimetype: 'application/pdf',
        s3Key: `${testUserId}/test-document.pdf`,
        ownerId: testUserId,
      };

      const result = await filesData.createFile(fileData);

      expect(result).toHaveProperty('_id');
      expect(result.filename).toBe('test-document.pdf');
      expect(result.category).toBe('Documents');
      expect(result.ownerId.toString()).toBe(testUserId);
      expect(result).toHaveProperty('uploadedAt');
      expect(result).toHaveProperty('createdAt');
      expect(result.accessCount).toBe(0);
    });

    it('should create a file without description (optional)', async () => {
      const fileData = {
        filename: 'test.pdf',
        originalFilename: 'test.pdf',
        category: 'Personal',
        size: 1024,
        mimetype: 'application/pdf',
        s3Key: `${testUserId}/test.pdf`,
        ownerId: testUserId,
      };

      const result = await filesData.createFile(fileData);
      expect(result).toHaveProperty('_id');
      expect(result.description).toBeUndefined();
    });

    it('should throw error with invalid category', async () => {
      const fileData = {
        filename: 'test.pdf',
        originalFilename: 'test.pdf',
        category: 'Invalid Category',
        size: 1024,
        mimetype: 'application/pdf',
        s3Key: `${testUserId}/test.pdf`,
        ownerId: testUserId,
      };

      await expect(filesData.createFile(fileData)).rejects.toThrow();
    });

    it('should throw error with invalid filename characters', async () => {
      const fileData = {
        filename: 'test<>file?.pdf',
        originalFilename: 'test.pdf',
        category: 'Documents',
        size: 1024,
        mimetype: 'application/pdf',
        s3Key: `${testUserId}/test.pdf`,
        ownerId: testUserId,
      };

      await expect(filesData.createFile(fileData)).rejects.toThrow();
    });

    it('should throw error with invalid owner ID', async () => {
      const fileData = {
        filename: 'test.pdf',
        originalFilename: 'test.pdf',
        category: 'Documents',
        size: 1024,
        mimetype: 'application/pdf',
        s3Key: 'invalid/test.pdf',
        ownerId: 'invalid-id',
      };

      await expect(filesData.createFile(fileData)).rejects.toThrow();
    });

    it('should throw error with negative file size', async () => {
      const fileData = {
        filename: 'test.pdf',
        originalFilename: 'test.pdf',
        category: 'Documents',
        size: -1024,
        mimetype: 'application/pdf',
        s3Key: `${testUserId}/test.pdf`,
        ownerId: testUserId,
      };

      await expect(filesData.createFile(fileData)).rejects.toThrow();
    });
  });

  describe('getFileById', () => {
    it('should retrieve file by ID', async () => {
      const fileData = {
        filename: 'find-me.pdf',
        originalFilename: 'find-me.pdf',
        category: 'Personal',
        size: 2048,
        mimetype: 'application/pdf',
        s3Key: `${testUserId}/find-me.pdf`,
        ownerId: testUserId,
      };

      const created = await filesData.createFile(fileData);
      const file = await filesData.getFileById(created._id.toString());

      expect(file).toBeDefined();
      expect(file._id.toString()).toBe(created._id.toString());
      expect(file.filename).toBe('find-me.pdf');
    });

    it('should return null for non-existent ID', async () => {
      const file = await filesData.getFileById('507f1f77bcf86cd799439011');
      expect(file).toBeNull();
    });

    it('should throw error with invalid ObjectId format', async () => {
      await expect(filesData.getFileById('invalid-id')).rejects.toThrow();
    });
  });

  describe('getFilesByOwner', () => {
    it('should retrieve all files for an owner', async () => {
      // Create multiple files
      await filesData.createFile({
        filename: 'file1.pdf',
        originalFilename: 'file1.pdf',
        category: 'Personal',
        size: 1024,
        mimetype: 'application/pdf',
        s3Key: `${testUserId}/file1.pdf`,
        ownerId: testUserId,
      });

      await filesData.createFile({
        filename: 'file2.pdf',
        originalFilename: 'file2.pdf',
        category: 'Work',
        size: 2048,
        mimetype: 'application/pdf',
        s3Key: `${testUserId}/file2.pdf`,
        ownerId: testUserId,
      });

      const files = await filesData.getFilesByOwner(testUserId);

      expect(files).toHaveLength(2);
      expect(files[0].ownerId.toString()).toBe(testUserId);
    });

    it('should return empty array for user with no files', async () => {
      const newUser = await usersData.createUser({
        username: 'nofiles',
        email: 'nofiles@example.com',
        password: 'Test1234',
      });

      const files = await filesData.getFilesByOwner(newUser._id.toString());
      expect(files).toHaveLength(0);
    });

    it('should throw error with invalid owner ID', async () => {
      await expect(filesData.getFilesByOwner('invalid-id')).rejects.toThrow();
    });
  });

  describe('getFilesByCategory', () => {
    it('should retrieve files by category for owner', async () => {
      // Create files in different categories
      await filesData.createFile({
        filename: 'work1.pdf',
        originalFilename: 'work1.pdf',
        category: 'Work',
        size: 1024,
        mimetype: 'application/pdf',
        s3Key: `${testUserId}/work1.pdf`,
        ownerId: testUserId,
      });

      await filesData.createFile({
        filename: 'personal1.pdf',
        originalFilename: 'personal1.pdf',
        category: 'Personal',
        size: 2048,
        mimetype: 'application/pdf',
        s3Key: `${testUserId}/personal1.pdf`,
        ownerId: testUserId,
      });

      await filesData.createFile({
        filename: 'work2.pdf',
        originalFilename: 'work2.pdf',
        category: 'Work',
        size: 3072,
        mimetype: 'application/pdf',
        s3Key: `${testUserId}/work2.pdf`,
        ownerId: testUserId,
      });

      const workFiles = await filesData.getFilesByCategory(testUserId, 'Work');

      expect(workFiles).toHaveLength(2);
      workFiles.forEach((file) => {
        expect(file.category).toBe('Work');
        expect(file.ownerId.toString()).toBe(testUserId);
      });
    });

    it('should return empty array for category with no files', async () => {
      const files = await filesData.getFilesByCategory(testUserId, 'Archive');
      expect(files).toHaveLength(0);
    });

    it('should throw error with invalid category', async () => {
      await expect(
        filesData.getFilesByCategory(testUserId, 'Invalid')
      ).rejects.toThrow();
    });
  });

  describe('updateFilename', () => {
    it('should update filename successfully', async () => {
      const fileData = {
        filename: 'old-name.pdf',
        originalFilename: 'old-name.pdf',
        category: 'Documents',
        size: 1024,
        mimetype: 'application/pdf',
        s3Key: `${testUserId}/old-name.pdf`,
        ownerId: testUserId,
      };

      const created = await filesData.createFile(fileData);
      const result = await filesData.updateFilename(
        created._id.toString(),
        'new-name.pdf'
      );

      expect(result.modifiedCount).toBe(1);

      // Verify the filename was updated
      const updated = await filesData.getFileById(created._id.toString());
      expect(updated.filename).toBe('new-name.pdf');
      expect(updated.updatedAt).toBeInstanceOf(Date);
    });

    it('should throw error with invalid filename characters', async () => {
      const fileData = {
        filename: 'test.pdf',
        originalFilename: 'test.pdf',
        category: 'Documents',
        size: 1024,
        mimetype: 'application/pdf',
        s3Key: `${testUserId}/test.pdf`,
        ownerId: testUserId,
      };

      const created = await filesData.createFile(fileData);

      await expect(
        filesData.updateFilename(created._id.toString(), 'invalid<>name.pdf')
      ).rejects.toThrow();
    });

    it('should throw error with invalid file ID', async () => {
      await expect(
        filesData.updateFilename('invalid-id', 'newname.pdf')
      ).rejects.toThrow();
    });
  });

  describe('deleteFile', () => {
    it('should delete file successfully', async () => {
      const fileData = {
        filename: 'delete-me.pdf',
        originalFilename: 'delete-me.pdf',
        category: 'Documents',
        size: 1024,
        mimetype: 'application/pdf',
        s3Key: `${testUserId}/delete-me.pdf`,
        ownerId: testUserId,
      };

      const created = await filesData.createFile(fileData);
      const result = await filesData.deleteFile(created._id.toString());

      expect(result.deletedCount).toBe(1);

      // Verify file is deleted
      const deleted = await filesData.getFileById(created._id.toString());
      expect(deleted).toBeNull();
    });

    it('should return 0 deletedCount for non-existent file', async () => {
      const result = await filesData.deleteFile('507f1f77bcf86cd799439011');
      expect(result.deletedCount).toBe(0);
    });

    it('should throw error with invalid file ID', async () => {
      await expect(filesData.deleteFile('invalid-id')).rejects.toThrow();
    });
  });

  describe('updateAccessStats', () => {
    it('should increment access count and update lastAccessedAt', async () => {
      const fileData = {
        filename: 'access-me.pdf',
        originalFilename: 'access-me.pdf',
        category: 'Documents',
        size: 1024,
        mimetype: 'application/pdf',
        s3Key: `${testUserId}/access-me.pdf`,
        ownerId: testUserId,
      };

      const created = await filesData.createFile(fileData);
      const fileId = created._id.toString();

      // Access the file multiple times
      await filesData.updateAccessStats(fileId);
      await filesData.updateAccessStats(fileId);
      await filesData.updateAccessStats(fileId);

      const updated = await filesData.getFileById(fileId);

      expect(updated.accessCount).toBe(3);
      expect(updated.lastAccessedAt).toBeInstanceOf(Date);
      expect(updated.lastAccessedAt.getTime()).toBeGreaterThan(
        created.uploadedAt.getTime()
      );
    });

    it('should throw error with invalid file ID', async () => {
      await expect(filesData.updateAccessStats('invalid-id')).rejects.toThrow();
    });
  });

  describe('searchAndFilterFiles', () => {
    beforeEach(async () => {
      // Create diverse files for testing search and filter
      await filesData.createFile({
        filename: 'report-2024.pdf',
        originalFilename: 'report.pdf',
        category: 'Work',
        size: 5000,
        mimetype: 'application/pdf',
        s3Key: `${testUserId}/report.pdf`,
        ownerId: testUserId,
      });

      await filesData.createFile({
        filename: 'presentation.pptx',
        originalFilename: 'presentation.pptx',
        category: 'Work',
        size: 10000,
        mimetype: 'application/vnd.ms-powerpoint',
        s3Key: `${testUserId}/presentation.pptx`,
        ownerId: testUserId,
      });

      await filesData.createFile({
        filename: 'vacation-photo.jpg',
        originalFilename: 'vacation.jpg',
        category: 'Personal',
        size: 2000,
        mimetype: 'image/jpeg',
        s3Key: `${testUserId}/vacation.jpg`,
        ownerId: testUserId,
      });

      // Wait a bit to create different upload times
      await new Promise((resolve) => setTimeout(resolve, 10));

      await filesData.createFile({
        filename: 'report-2025.pdf',
        originalFilename: 'report2.pdf',
        category: 'Documents',
        size: 3000,
        mimetype: 'application/pdf',
        s3Key: `${testUserId}/report2.pdf`,
        ownerId: testUserId,
      });
    });

    it('should search files by filename', async () => {
      const result = await filesData.searchAndFilterFiles(testUserId, {
        search: 'report',
      });

      expect(result.length).toBeGreaterThanOrEqual(2);
      result.forEach((file) => {
        expect(file.filename.toLowerCase()).toContain('report');
      });
    });

    it('should filter by file type (mimetype)', async () => {
      const result = await filesData.searchAndFilterFiles(testUserId, {
        fileType: 'application/pdf',
      });

      expect(result.length).toBeGreaterThanOrEqual(2);
      result.forEach((file) => {
        expect(file.mimetype).toBe('application/pdf');
      });
    });

    it('should sort by uploadDate ascending', async () => {
      const result = await filesData.searchAndFilterFiles(testUserId, {
        sortBy: 'uploadDate',
        sortOrder: 'asc',
      });

      expect(result.length).toBeGreaterThanOrEqual(4);
      // Check if sorted (oldest first)
      for (let i = 0; i < result.length - 1; i++) {
        expect(result[i].uploadedAt.getTime()).toBeLessThanOrEqual(
          result[i + 1].uploadedAt.getTime()
        );
      }
    });

    it('should sort by uploadDate descending', async () => {
      const result = await filesData.searchAndFilterFiles(testUserId, {
        sortBy: 'uploadDate',
        sortOrder: 'desc',
      });

      expect(result.length).toBeGreaterThanOrEqual(4);
      // Check if sorted (newest first)
      for (let i = 0; i < result.length - 1; i++) {
        expect(result[i].uploadedAt.getTime()).toBeGreaterThanOrEqual(
          result[i + 1].uploadedAt.getTime()
        );
      }
    });

    it('should sort by filename', async () => {
      const result = await filesData.searchAndFilterFiles(testUserId, {
        sortBy: 'filename',
        sortOrder: 'asc',
      });

      expect(result.length).toBeGreaterThanOrEqual(4);
      // Check if sorted alphabetically
      for (let i = 0; i < result.length - 1; i++) {
        expect(
          result[i].filename.localeCompare(result[i + 1].filename)
        ).toBeLessThanOrEqual(0);
      }
    });

    it('should combine search and filter', async () => {
      const result = await filesData.searchAndFilterFiles(testUserId, {
        search: 'report',
        fileType: 'application/pdf',
        sortBy: 'filename',
        sortOrder: 'asc',
      });

      result.forEach((file) => {
        expect(file.filename.toLowerCase()).toContain('report');
        expect(file.mimetype).toBe('application/pdf');
      });
    });

    it('should return empty array when no files match', async () => {
      const result = await filesData.searchAndFilterFiles(testUserId, {
        search: 'nonexistent-file-xyz',
      });

      expect(result).toHaveLength(0);
    });

    it('should return all files when no filters applied', async () => {
      const result = await filesData.searchAndFilterFiles(testUserId, {});

      expect(result.length).toBeGreaterThanOrEqual(4);
    });
  });
});
