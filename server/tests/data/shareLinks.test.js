import { describe, it, expect, beforeEach } from 'vitest';
import shareLinksData from '../../data/shareLinks.js';
import usersData from '../../data/users.js';
import filesData from '../../data/files.js';

describe('ShareLinks Data Layer', () => {
  let testUser;
  let testUserId;
  let testFile;
  let testFileId;

  beforeEach(async () => {
    // Create test user and file
    testUser = await usersData.createUser({
      username: 'shareowner',
      email: 'shareowner@example.com',
      password: 'Test1234',
    });
    testUserId = testUser._id.toString();

    testFile = await filesData.createFile({
      filename: 'shared-document.pdf',
      originalFilename: 'shared-document.pdf',
      category: 'Documents',
      size: 1024000,
      mimetype: 'application/pdf',
      s3Key: `${testUserId}/shared-document.pdf`,
      ownerId: testUserId,
    });
    testFileId = testFile._id.toString();
  });

  describe('createShareLink', () => {
    it('should create a share link with time expiration', async () => {
      const shareLinkData = {
        fileId: testFileId,
        ownerId: testUserId,
        expirationHours: 24,
      };

      const result = await shareLinksData.createShareLink(shareLinkData);

      expect(result).toHaveProperty('_id');
      expect(result).toHaveProperty('token');
      expect(result.token).toHaveLength(64); // 64 hex characters
      expect(result.token).toMatch(/^[a-f0-9]{64}$/); // Hex format
      expect(result.fileId.toString()).toBe(testFileId);
      expect(result.ownerId.toString()).toBe(testUserId);
      expect(result.shareType).toBe('link');
      expect(result.expiresAt).toBeInstanceOf(Date);
      expect(result.accessCount).toBe(0);
      expect(result.isActive).toBe(true);
    });

    it('should create a share link with access count limit', async () => {
      const shareLinkData = {
        fileId: testFileId,
        ownerId: testUserId,
        maxAccessCount: 5,
      };

      const result = await shareLinksData.createShareLink(shareLinkData);

      expect(result).toHaveProperty('token');
      expect(result.maxAccessCount).toBe(5);
      expect(result.expiresAt).toBeUndefined();
    });

    it('should create a share link with both time and count limits', async () => {
      const shareLinkData = {
        fileId: testFileId,
        ownerId: testUserId,
        expirationHours: 48,
        maxAccessCount: 10,
      };

      const result = await shareLinksData.createShareLink(shareLinkData);

      expect(result.expiresAt).toBeInstanceOf(Date);
      expect(result.maxAccessCount).toBe(10);
    });

    it('should throw error without expiration method', async () => {
      const shareLinkData = {
        fileId: testFileId,
        ownerId: testUserId,
      };

      await expect(
        shareLinksData.createShareLink(shareLinkData)
      ).rejects.toThrow();
    });

    it('should throw error with invalid file ID', async () => {
      const shareLinkData = {
        fileId: 'invalid-id',
        ownerId: testUserId,
        expirationHours: 24,
      };

      await expect(
        shareLinksData.createShareLink(shareLinkData)
      ).rejects.toThrow();
    });

    it('should throw error with negative expiration hours', async () => {
      const shareLinkData = {
        fileId: testFileId,
        ownerId: testUserId,
        expirationHours: -5,
      };

      await expect(
        shareLinksData.createShareLink(shareLinkData)
      ).rejects.toThrow();
    });

    it('should generate unique tokens', async () => {
      const share1 = await shareLinksData.createShareLink({
        fileId: testFileId,
        ownerId: testUserId,
        expirationHours: 24,
      });

      const share2 = await shareLinksData.createShareLink({
        fileId: testFileId,
        ownerId: testUserId,
        expirationHours: 24,
      });

      expect(share1.token).not.toBe(share2.token);
    });
  });

  describe('getShareLinkByToken', () => {
    it('should retrieve share link by token', async () => {
      const created = await shareLinksData.createShareLink({
        fileId: testFileId,
        ownerId: testUserId,
        expirationHours: 24,
      });

      const shareLink = await shareLinksData.getShareLinkByToken(created.token);

      expect(shareLink).toBeDefined();
      expect(shareLink.token).toBe(created.token);
      expect(shareLink._id.toString()).toBe(created._id.toString());
    });

    it('should return null for non-existent token', async () => {
      const fakeToken = 'a'.repeat(64);
      const shareLink = await shareLinksData.getShareLinkByToken(fakeToken);
      expect(shareLink).toBeNull();
    });

    it('should throw error with invalid token format', async () => {
      await expect(
        shareLinksData.getShareLinkByToken('short-token')
      ).rejects.toThrow();
    });
  });

  describe('validateShareLink', () => {
    it('should return true for valid share link with time expiration', async () => {
      const created = await shareLinksData.createShareLink({
        fileId: testFileId,
        ownerId: testUserId,
        expirationHours: 24,
      });

      const isValid = await shareLinksData.validateShareLink(created.token);
      expect(isValid).toBe(true);
    });

    it('should return true for valid share link with access count', async () => {
      const created = await shareLinksData.createShareLink({
        fileId: testFileId,
        ownerId: testUserId,
        maxAccessCount: 5,
      });

      const isValid = await shareLinksData.validateShareLink(created.token);
      expect(isValid).toBe(true);
    });

    it('should return false for expired time-based link', async () => {
      const created = await shareLinksData.createShareLink({
        fileId: testFileId,
        ownerId: testUserId,
        expirationHours: 1,
      });

      // Manually update expiration to past
      const { getCollection, COLLECTIONS } = await import(
        '../../config/index.js'
      );
      const collection = getCollection(COLLECTIONS.SHARE_LINKS);
      await collection.updateOne(
        { token: created.token },
        { $set: { expiresAt: new Date('2020-01-01') } }
      );

      const isValid = await shareLinksData.validateShareLink(created.token);
      expect(isValid).toBe(false);
    });

    it('should return false for maxed out access count', async () => {
      const created = await shareLinksData.createShareLink({
        fileId: testFileId,
        ownerId: testUserId,
        maxAccessCount: 3,
      });

      // Access 3 times (reaches limit)
      await shareLinksData.incrementShareAccess(created.token);
      await shareLinksData.incrementShareAccess(created.token);
      await shareLinksData.incrementShareAccess(created.token);

      const isValid = await shareLinksData.validateShareLink(created.token);
      expect(isValid).toBe(false);
    });

    it('should return false for non-existent token', async () => {
      const fakeToken = 'a'.repeat(64);
      const isValid = await shareLinksData.validateShareLink(fakeToken);
      expect(isValid).toBe(false);
    });

    it('should return false for inactive share link', async () => {
      const created = await shareLinksData.createShareLink({
        fileId: testFileId,
        ownerId: testUserId,
        expirationHours: 24,
      });

      // Deactivate the link
      const { getCollection, COLLECTIONS } = await import(
        '../../config/index.js'
      );
      const collection = getCollection(COLLECTIONS.SHARE_LINKS);
      await collection.updateOne(
        { token: created.token },
        { $set: { isActive: false } }
      );

      const isValid = await shareLinksData.validateShareLink(created.token);
      expect(isValid).toBe(false);
    });
  });

  describe('incrementShareAccess', () => {
    it('should increment access count', async () => {
      const created = await shareLinksData.createShareLink({
        fileId: testFileId,
        ownerId: testUserId,
        expirationHours: 24,
      });

      await shareLinksData.incrementShareAccess(created.token);
      await shareLinksData.incrementShareAccess(created.token);

      const updated = await shareLinksData.getShareLinkByToken(created.token);
      expect(updated.accessCount).toBe(2);
    });

    it('should update updatedAt timestamp', async () => {
      const created = await shareLinksData.createShareLink({
        fileId: testFileId,
        ownerId: testUserId,
        expirationHours: 24,
      });

      await new Promise((resolve) => setTimeout(resolve, 10));
      await shareLinksData.incrementShareAccess(created.token);

      const updated = await shareLinksData.getShareLinkByToken(created.token);
      expect(updated.updatedAt.getTime()).toBeGreaterThan(
        created.createdAt.getTime()
      );
    });

    it('should throw error with invalid token format', async () => {
      await expect(
        shareLinksData.incrementShareAccess('invalid')
      ).rejects.toThrow();
    });
  });

  describe('getShareLinksByFile', () => {
    it('should retrieve all share links for a file', async () => {
      await shareLinksData.createShareLink({
        fileId: testFileId,
        ownerId: testUserId,
        expirationHours: 24,
      });

      await shareLinksData.createShareLink({
        fileId: testFileId,
        ownerId: testUserId,
        maxAccessCount: 5,
      });

      const shareLinks = await shareLinksData.getShareLinksByFile(testFileId);

      expect(shareLinks).toHaveLength(2);
      shareLinks.forEach((link) => {
        expect(link.fileId.toString()).toBe(testFileId);
      });
    });

    it('should return empty array for file with no share links', async () => {
      const newFile = await filesData.createFile({
        filename: 'unshared.pdf',
        originalFilename: 'unshared.pdf',
        category: 'Personal',
        size: 1024,
        mimetype: 'application/pdf',
        s3Key: `${testUserId}/unshared.pdf`,
        ownerId: testUserId,
      });

      const shareLinks = await shareLinksData.getShareLinksByFile(
        newFile._id.toString()
      );
      expect(shareLinks).toHaveLength(0);
    });

    it('should throw error with invalid file ID', async () => {
      await expect(
        shareLinksData.getShareLinksByFile('invalid-id')
      ).rejects.toThrow();
    });
  });

  describe('deactivateShareLink', () => {
    it('should deactivate a share link', async () => {
      const created = await shareLinksData.createShareLink({
        fileId: testFileId,
        ownerId: testUserId,
        expirationHours: 24,
      });

      const result = await shareLinksData.deactivateShareLink(created.token);
      expect(result.modifiedCount).toBe(1);

      const updated = await shareLinksData.getShareLinkByToken(created.token);
      expect(updated.isActive).toBe(false);
    });

    it('should return 0 modifiedCount for non-existent token', async () => {
      const fakeToken = 'a'.repeat(64);
      const result = await shareLinksData.deactivateShareLink(fakeToken);
      expect(result.modifiedCount).toBe(0);
    });

    it('should throw error with invalid token format', async () => {
      await expect(
        shareLinksData.deactivateShareLink('invalid')
      ).rejects.toThrow();
    });
  });
});
