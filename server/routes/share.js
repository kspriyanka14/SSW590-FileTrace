import express from 'express';
import { ObjectId } from 'mongodb';
import {
  filesData,
  shareLinksData,
  userSharesData,
  usersData,
  auditLogsData,
} from '../data/index.js';
import { auth, auditLogger } from '../middleware/index.js';
import { getDownloadUrl } from '../utils/s3.js';
import { createShareSchema, shareTokenSchema } from '../validation/index.js';
import { getCollection, COLLECTIONS } from '../config/index.js';

const router = express.Router();

/**
 * POST /api/share/create
 * Create a share (with user or public link)
 */
router.post(
  '/create',
  auth,
  auditLogger('SHARE_CREATED', (req) => ({
    shareType: req.body.shareType,
    expirationMinutes: req.body.expirationMinutes,
    maxAccessCount: req.body.maxAccessCount,
  })),
  async (req, res) => {
    try {
      const validatedData = createShareSchema.parse(req.body);

      // Verify file exists and ownership
      const file = await filesData.getFileById(validatedData.fileId);
      if (!file) {
        return res.status(404).json({ error: 'File not found' });
      }

      if (file.ownerId.toString() !== req.user.userId) {
        return res.status(404).json({ error: 'File not found' });
      }

      res.locals.fileId = validatedData.fileId;

      if (validatedData.shareType === 'user') {
        // Share with specific user
        const recipient = await usersData.getUserByEmailOrUsername(
          validatedData.recipientIdentifier
        );

        if (!recipient) {
          return res.status(404).json({ error: 'Recipient user not found' });
        }

        const share = await userSharesData.createUserShare({
          fileId: validatedData.fileId,
          ownerId: req.user.userId,
          recipientId: recipient._id.toString(),
          expirationMinutes: validatedData.expirationMinutes,
          maxAccessCount: validatedData.maxAccessCount,
        });

        return res.status(201).json({
          message: 'File shared with user successfully',
          share: {
            _id: share._id,
            shareType: 'user',
            recipient: {
              _id: recipient._id,
              username: recipient.username,
              email: recipient.email,
            },
            expiresAt: share.expiresAt,
            maxAccessCount: share.maxAccessCount,
          },
        });
      } else {
        // Create public link
        const share = await shareLinksData.createShareLink({
          fileId: validatedData.fileId,
          ownerId: req.user.userId,
          expirationMinutes: validatedData.expirationMinutes,
          maxAccessCount: validatedData.maxAccessCount,
        });

        const shareUrl = `${process.env.CLIENT_URL}/share/${share.token}`;

        return res.status(201).json({
          message: 'Share link created successfully',
          share: {
            _id: share._id,
            token: share.token,
            shareUrl,
            expiresAt: share.expiresAt,
            maxAccessCount: share.maxAccessCount,
          },
        });
      }
    } catch (error) {
      if (error.name === 'ZodError') {
        return res.status(400).json({
          error: 'Validation failed',
          details: error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
        });
      }

      if (error.message.includes('already shared')) {
        return res.status(409).json({ error: error.message });
      }

      console.error('Share creation error:', error);
      res.status(500).json({ error: 'Failed to create share' });
    }
  }
);

/**
 * GET /api/share/shared-with-me
 * Get files shared with current user
 * Includes owner username for each shared file
 * NOTE: This must come BEFORE /:token route to avoid matching conflict
 */
router.get('/shared-with-me', auth, async (req, res) => {
  try {
    // Use enriched function that includes owner username via aggregation
    const shares = await userSharesData.getFilesSharedWithUserEnriched(
      req.user.userId
    );

    // Fetch file details for each share
    const filesWithShareInfo = await Promise.all(
      shares.map(async (share) => {
        const file = await filesData.getFileById(share.fileId.toString());

        // Calculate remaining accesses
        const remainingAccesses =
          share.maxAccessCount !== undefined
            ? Math.max(0, share.maxAccessCount - share.accessCount)
            : null;

        // Check if share is still valid
        const isValid = await userSharesData.validateUserShare(
          share._id.toString()
        );

        return {
          share: {
            _id: share._id,
            expiresAt: share.expiresAt,
            maxAccessCount: share.maxAccessCount,
            accessCount: share.accessCount,
            remainingAccesses,
            isExpired: !isValid,
            ownerUsername: share.ownerInfo.username, // Owner username from aggregation
          },
          file: file
            ? {
                _id: file._id,
                filename: file.filename,
                description: file.description,
                category: file.category,
                size: file.size,
                mimetype: file.mimetype,
              }
            : null,
        };
      })
    );

    // Filter out shares where file no longer exists
    const validShares = filesWithShareInfo.filter((item) => item.file !== null);

    res.status(200).json({ files: validShares });
  } catch (error) {
    console.error('Get shared files error:', error);
    res.status(500).json({ error: 'Failed to retrieve shared files' });
  }
});

/**
 * GET /api/share/file/:fileId/active-shares
 * Get all active, non-expired shares for a file (by file owner)
 * Returns both share links and user shares with recipient details
 * Excludes shares expired by time or access count
 */
router.get('/file/:fileId/active-shares', auth, async (req, res) => {
  try {
    const { fileId } = req.params;

    // Validate file ID
    if (!ObjectId.isValid(fileId)) {
      return res.status(400).json({ error: 'Invalid file ID format' });
    }

    // Verify file exists and user owns it
    const file = await filesData.getFileById(fileId);

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    if (file.ownerId.toString() !== req.user.userId) {
      return res
        .status(403)
        .json({ error: 'Unauthorized: You do not own this file' });
    }

    // Get active share links with enriched data
    const shareLinks = await shareLinksData.getActiveShareLinksByFile(fileId);

    // Get active user shares with recipient information
    const userShares = await userSharesData.getActiveUserSharesByFile(fileId);

    // Calculate total active shares
    const total = shareLinks.length + userShares.length;

    res.status(200).json({
      shareLinks,
      userShares,
      total,
    });
  } catch (error) {
    console.error('Get active shares error:', error);
    res.status(500).json({ error: 'Failed to retrieve active shares' });
  }
});

/**
 * PATCH /api/share/link/:token/revoke
 * Revoke a single share link (by file owner)
 * Sets isActive to false and logs the action
 */
router.patch('/link/:token/revoke', auth, async (req, res) => {
  try {
    const { token } = req.params;

    // Validate token format
    if (!/^[a-f0-9]{64}$/.test(token)) {
      return res.status(400).json({ error: 'Invalid token format' });
    }

    // Get share link
    const shareLink = await shareLinksData.getShareLinkByToken(token);

    if (!shareLink) {
      return res.status(404).json({ error: 'Share link not found' });
    }

    // Verify file exists and user owns it
    const file = await filesData.getFileById(shareLink.fileId.toString());

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    if (file.ownerId.toString() !== req.user.userId) {
      return res
        .status(403)
        .json({ error: 'Unauthorized: You do not own this file' });
    }

    // Deactivate the share link
    await shareLinksData.deactivateShareLink(token);

    // Log the revocation
    await auditLogsData.createAuditLog({
      fileId: file._id.toString(),
      action: 'SHARE_REVOKED',
      userId: req.user.userId,
      username: req.user.username,
      ipAddress:
        req.headers['x-forwarded-for']?.split(',')[0].trim() ||
        req.socket.remoteAddress,
      location: req.headers['cf-ipcountry'],
      details: {
        shareType: 'link',
        token: token.substring(0, 16) + '...', // Only log first 16 chars for security
      },
    });

    res.status(200).json({
      message: 'Share link revoked successfully',
    });
  } catch (error) {
    console.error('Revoke share link error:', error);
    res.status(500).json({ error: 'Failed to revoke share link' });
  }
});

/**
 * PATCH /api/share/user/:shareId/revoke
 * Revoke a single user share (by file owner)
 * Sets isActive to false and logs the action
 */
router.patch('/user/:shareId/revoke', auth, async (req, res) => {
  try {
    const { shareId } = req.params;

    // Validate share ID format
    if (!ObjectId.isValid(shareId)) {
      return res.status(400).json({ error: 'Invalid share ID format' });
    }

    // Get user share
    const userSharesCollection = getCollection(COLLECTIONS.USER_SHARES);
    const userShare = await userSharesCollection.findOne({
      _id: new ObjectId(shareId),
    });

    if (!userShare) {
      return res.status(404).json({ error: 'User share not found' });
    }

    // Verify file exists and user owns it
    const file = await filesData.getFileById(userShare.fileId.toString());

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    if (file.ownerId.toString() !== req.user.userId) {
      return res
        .status(403)
        .json({ error: 'Unauthorized: You do not own this file' });
    }

    // Get recipient email for audit log
    const usersCollection = getCollection(COLLECTIONS.USERS);
    const recipient = await usersCollection.findOne(
      { _id: userShare.recipientId },
      { projection: { email: 1 } }
    );

    // Deactivate the user share
    await userSharesData.deactivateUserShare(shareId);

    // Log the revocation
    await auditLogsData.createAuditLog({
      fileId: file._id.toString(),
      action: 'SHARE_REVOKED',
      userId: req.user.userId,
      username: req.user.username,
      ipAddress:
        req.headers['x-forwarded-for']?.split(',')[0].trim() ||
        req.socket.remoteAddress,
      location: req.headers['cf-ipcountry'],
      details: {
        shareType: 'user',
        recipientId: userShare.recipientId.toString(),
        recipientEmail: recipient?.email || 'unknown',
      },
    });

    res.status(200).json({
      message: 'User share revoked successfully',
    });
  } catch (error) {
    console.error('Revoke user share error:', error);
    res.status(500).json({ error: 'Failed to revoke user share' });
  }
});

/**
 * POST /api/share/file/:fileId/revoke-all
 * Revoke ALL shares for a file at once (by file owner)
 * Deactivates both share links and user shares
 */
router.post('/file/:fileId/revoke-all', auth, async (req, res) => {
  try {
    const { fileId } = req.params;

    // Validate file ID
    if (!ObjectId.isValid(fileId)) {
      return res.status(400).json({ error: 'Invalid file ID format' });
    }

    // Verify file exists and user owns it
    const file = await filesData.getFileById(fileId);

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    if (file.ownerId.toString() !== req.user.userId) {
      return res
        .status(403)
        .json({ error: 'Unauthorized: You do not own this file' });
    }

    // Revoke all share links
    const shareLinksResult = await shareLinksData.revokeAllShareLinksByFile(
      fileId
    );

    // Revoke all user shares
    const userSharesResult = await userSharesData.revokeAllUserSharesByFile(
      fileId
    );

    const totalRevoked =
      shareLinksResult.modifiedCount + userSharesResult.modifiedCount;

    // Log the bulk revocation
    await auditLogsData.createAuditLog({
      fileId: file._id.toString(),
      action: 'SHARES_REVOKED_ALL',
      userId: req.user.userId,
      username: req.user.username,
      ipAddress:
        req.headers['x-forwarded-for']?.split(',')[0].trim() ||
        req.socket.remoteAddress,
      location: req.headers['cf-ipcountry'],
      details: {
        shareLinksCount: shareLinksResult.modifiedCount,
        userSharesCount: userSharesResult.modifiedCount,
        totalCount: totalRevoked,
      },
    });

    res.status(200).json({
      message: 'All shares revoked successfully',
      revokedCounts: {
        shareLinks: shareLinksResult.modifiedCount,
        userShares: userSharesResult.modifiedCount,
      },
    });
  } catch (error) {
    console.error('Revoke all shares error:', error);
    res.status(500).json({ error: 'Failed to revoke all shares' });
  }
});

/**
 * GET /api/share/:token
 * View shared file info via public link (no authentication required)
 * Does NOT increment access count - that only happens on download
 */
router.get('/:token', async (req, res) => {
  try {
    const { token } = shareTokenSchema.parse(req.params);

    // Validate share link
    const isValid = await shareLinksData.validateShareLink(token);

    if (!isValid) {
      // Get share link to find fileId for logging
      const shareLink = await shareLinksData.getShareLinkByToken(token);
      const fileId = shareLink?.fileId?.toString() || null;

      // Log expired link attempt with fileId
      await auditLogsData.createAuditLog({
        fileId,
        action: 'EXPIRED_LINK_ATTEMPT',
        ipAddress:
          req.headers['x-forwarded-for']?.split(',')[0].trim() ||
          req.socket.remoteAddress,
        location: req.headers['cf-ipcountry'],
        details: { token, reason: 'expired_or_max_access_reached' },
      });

      return res.status(403).json({
        error: 'This share link has expired or reached maximum accesses',
      });
    }

    const shareLink = await shareLinksData.getShareLinkByToken(token);
    const file = await filesData.getFileById(shareLink.fileId.toString());

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Return file info and share metadata WITHOUT incrementing access count
    res.status(200).json({
      file: {
        filename: file.filename,
        description: file.description,
        size: file.size,
        mimetype: file.mimetype,
      },
      share: {
        maxAccessCount: shareLink.maxAccessCount,
        accessCount: shareLink.accessCount,
        expiresAt: shareLink.expiresAt || null,
      },
    });
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
      });
    }

    console.error('Share access error:', error);
    res.status(500).json({ error: 'Failed to access shared file' });
  }
});

/**
 * POST /api/share/:token/download
 * Download shared file via public link (no authentication required)
 * This increments access count and logs the download
 */
router.post('/:token/download', async (req, res) => {
  try {
    const { token } = shareTokenSchema.parse(req.params);

    // Validate share link
    const isValid = await shareLinksData.validateShareLink(token);

    if (!isValid) {
      // Get share link to find fileId for logging
      const shareLink = await shareLinksData.getShareLinkByToken(token);
      const fileId = shareLink?.fileId?.toString() || null;

      // Log expired link attempt with fileId
      await auditLogsData.createAuditLog({
        fileId,
        action: 'EXPIRED_LINK_ATTEMPT',
        ipAddress:
          req.headers['x-forwarded-for']?.split(',')[0].trim() ||
          req.socket.remoteAddress,
        location: req.headers['cf-ipcountry'],
        details: { token, reason: 'download_attempt_after_expiry' },
      });

      return res.status(403).json({
        error: 'This share link has expired or reached maximum accesses',
      });
    }

    const shareLink = await shareLinksData.getShareLinkByToken(token);
    const file = await filesData.getFileById(shareLink.fileId.toString());

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Generate download URL
    const downloadUrl = await getDownloadUrl(file.s3Key, file.filename, 3600);

    // Increment access count (only on actual download)
    await shareLinksData.incrementShareAccess(token);

    // Update file access stats
    await filesData.updateAccessStats(shareLink.fileId.toString());

    // Log download
    await auditLogsData.createAuditLog({
      fileId: file._id.toString(),
      action: 'DOWNLOAD',
      ipAddress:
        req.headers['x-forwarded-for']?.split(',')[0].trim() ||
        req.socket.remoteAddress,
      location: req.headers['cf-ipcountry'],
      details: { via: 'public_share_link', token },
    });

    res.status(200).json({
      downloadUrl,
      filename: file.filename,
      remainingAccesses:
        shareLink.maxAccessCount !== undefined
          ? shareLink.maxAccessCount - shareLink.accessCount - 1
          : null,
    });
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
      });
    }

    console.error('Share download error:', error);
    res.status(500).json({ error: 'Failed to download shared file' });
  }
});

export default router;
