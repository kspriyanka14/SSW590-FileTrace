import express from 'express';
import multer from 'multer';
import { filesData, userSharesData } from '../data/index.js';
import { auth, auditLogger } from '../middleware/index.js';
import { uploadToS3, getDownloadUrl, deleteFromS3 } from '../utils/s3.js';
import {
  uploadFileSchema,
  renameFileSchema,
  moveFileCategorySchema,
  fileIdSchema,
  categoryParamSchema,
  searchQuerySchema,
} from '../validation/index.js';

const router = express.Router();

// Configure Multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB max file size
    fieldSize: 10 * 1024, // 10KB max field value size (for description, etc.)
    fields: 10, // Max 10 non-file fields
    fieldNameSize: 100, // Max field name size
  },
});

/**
 * GET /api/files/my-files
 * Get all files for current user with optional search/filter
 */
router.get('/my-files', auth, async (req, res) => {
  try {
    const filters = searchQuerySchema.parse(req.query);
    const files = await filesData.searchAndFilterFiles(
      req.user.userId,
      filters
    );

    res.status(200).json({ files });
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
      });
    }

    console.error('Get files error:', error);
    res.status(500).json({ error: 'Failed to retrieve files' });
  }
});

/**
 * GET /api/files/my-files/:category
 * Get files by category for current user with recent activity data
 * Returns ALL files - frontend handles filtering/sorting
 */
router.get('/my-files/:category', auth, async (req, res) => {
  try {
    const { category } = categoryParamSchema.parse(req.params);

    // Get all files for category with recent activity data
    const files = await filesData.getFilesByCategory(req.user.userId, category);

    // Return all files - let frontend handle filtering/sorting for better performance
    res.status(200).json({ files, category });
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
      });
    }

    console.error('Get files by category error:', error);
    res.status(500).json({ error: 'Failed to retrieve files' });
  }
});

/**
 * POST /api/files/upload
 * Upload a new file
 */
router.post(
  '/upload',
  auth,
  (req, res, next) => {
    upload.single('file')(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        // Multer-specific errors
        console.error('Multer error:', err.code, err.message);
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res
            .status(400)
            .json({ error: 'File size exceeds 100MB limit' });
        } else if (err.code === 'LIMIT_FIELD_VALUE') {
          return res.status(400).json({
            error:
              'Field value too large. Description must not exceed 250 characters.',
          });
        } else if (err.code === 'LIMIT_FIELD_COUNT') {
          return res
            .status(400)
            .json({ error: 'Too many fields in the request' });
        }
        return res.status(400).json({ error: `Upload error: ${err.message}` });
      } else if (err) {
        // Other errors
        console.error('Upload error:', err);
        return res.status(500).json({ error: 'File upload failed' });
      }
      next();
    });
  },
  auditLogger('UPLOAD'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      let fileMetadata;
      try {
        fileMetadata = uploadFileSchema.parse({
          filename: req.body.filename || req.file.originalname,
          description: req.body.description,
          category: req.body.category,
          size: req.file.size,
          mimetype: req.file.mimetype,
        });
      } catch (zodError) {
        return res.status(400).json({
          error: 'Validation failed',
          details: zodError.errors.map(
            (e) => `${e.path.join('.')}: ${e.message}`
          ),
        });
      }

      // Upload to S3
      const { s3Key } = await uploadToS3(
        req.file.buffer,
        req.user.userId,
        fileMetadata.filename,
        fileMetadata.mimetype
      );

      // Create file record in database
      const file = await filesData.createFile({
        ...fileMetadata,
        originalFilename: req.file.originalname,
        s3Key,
        ownerId: req.user.userId,
      });

      // Store fileId for audit logger
      res.locals.fileId = file._id.toString();

      res.status(201).json({
        message: 'File uploaded successfully',
        file: {
          _id: file._id,
          filename: file.filename,
          description: file.description,
          category: file.category,
          size: file.size,
          uploadedAt: file.uploadedAt,
        },
      });
    } catch (error) {
      if (error.name === 'ZodError') {
        return res.status(400).json({
          error: 'Validation failed',
          details: error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
        });
      }

      console.error('Upload error:', error);
      res.status(500).json({ error: 'File upload failed' });
    }
  }
);

/**
 * GET /api/files/download/:fileId
 * Get pre-signed download URL for a file
 * Supports both owned files and files shared with user
 */
router.get(
  '/download/:fileId',
  auth,
  auditLogger('DOWNLOAD', (req, res) => {
    // Include share info in audit details if this is a shared file
    return res.locals.isSharedFile ? { via: 'user_share' } : { via: 'owner' };
  }),
  async (req, res) => {
    try {
      const { fileId } = fileIdSchema.parse(req.params);

      const file = await filesData.getFileById(fileId);

      if (!file) {
        return res.status(404).json({ error: 'File not found' });
      }

      const isOwner = file.ownerId.toString() === req.user.userId;
      let userShare = null;

      // If not owner, check if file is shared with user
      if (!isOwner) {
        userShare = await userSharesData.getShareByFileAndRecipient(
          fileId,
          req.user.userId
        );

        if (!userShare) {
          return res.status(404).json({ error: 'File not found' });
        }

        // Validate the share is still active and not expired
        const isValid = await userSharesData.validateUserShare(
          userShare._id.toString()
        );

        if (!isValid) {
          return res
            .status(403)
            .json({ error: 'Share has expired or reached maximum accesses' });
        }

        // Increment share access count (only for shared files, not owner)
        await userSharesData.incrementUserShareAccess(userShare._id.toString());

        // Mark this as a shared file for audit logging
        res.locals.isSharedFile = true;
      }

      // Generate pre-signed URL
      const downloadUrl = await getDownloadUrl(file.s3Key, file.filename, 3600);

      // Update file access stats (for both owner and shared)
      await filesData.updateAccessStats(fileId);

      // Store fileId for audit logger
      res.locals.fileId = fileId;

      res.status(200).json({
        downloadUrl,
        filename: file.filename,
        expiresIn: 3600,
        ...(userShare && {
          shareInfo: {
            remainingAccesses:
              userShare.maxAccessCount !== undefined
                ? userShare.maxAccessCount - userShare.accessCount - 1
                : null,
          },
        }),
      });
    } catch (error) {
      if (error.name === 'ZodError') {
        return res.status(400).json({
          error: 'Validation failed',
          details: error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
        });
      }

      console.error('Download error:', error);
      res.status(500).json({ error: 'Failed to generate download URL' });
    }
  }
);

/**
 * PATCH /api/files/:fileId/rename
 * Rename a file (metadata only, S3 file unchanged)
 */
router.patch(
  '/:fileId/rename',
  auth,
  auditLogger('NAME_CHANGE', (req, res) => {
    const oldFilename = res.locals.oldFilename;
    const newFilename = req.body.filename;
    return { oldFilename, newFilename };
  }),
  async (req, res) => {
    try {
      const { fileId } = fileIdSchema.parse(req.params);
      const { filename } = renameFileSchema.parse(req.body);

      const file = await filesData.getFileById(fileId);

      if (!file) {
        return res.status(404).json({ error: 'File not found' });
      }

      // Verify ownership
      if (file.ownerId.toString() !== req.user.userId) {
        return res.status(404).json({ error: 'File not found' });
      }

      // Store old filename for audit
      res.locals.oldFilename = file.filename;

      // Update filename in database only
      await filesData.updateFilename(fileId, filename);

      res.status(200).json({
        message: 'File renamed successfully',
        file: {
          _id: file._id,
          filename,
          oldFilename: file.filename,
        },
      });
    } catch (error) {
      if (error.name === 'ZodError') {
        return res.status(400).json({
          error: 'Validation failed',
          details: error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
        });
      }

      console.error('Rename error:', error);
      res.status(500).json({ error: 'Failed to rename file' });
    }
  }
);

/**
 * PATCH /api/files/:fileId/move
 * Move a file to a different category
 */
router.patch(
  '/:fileId/move',
  auth,
  auditLogger('CATEGORY_CHANGE', (req, res) => {
    const oldCategory = res.locals.oldCategory;
    const newCategory = req.body.category;
    return { oldCategory, newCategory };
  }),
  async (req, res) => {
    try {
      const { fileId } = fileIdSchema.parse(req.params);
      const { category } = moveFileCategorySchema.parse(req.body);

      const file = await filesData.getFileById(fileId);

      if (!file) {
        return res.status(404).json({ error: 'File not found' });
      }

      // Verify ownership
      if (file.ownerId.toString() !== req.user.userId) {
        return res.status(404).json({ error: 'File not found' });
      }

      // Check if already in target category
      if (file.category === category) {
        return res.status(400).json({
          error: 'File is already in this category',
        });
      }

      // Store old category for audit
      res.locals.oldCategory = file.category;

      // Update category in database
      await filesData.moveFileToCategory(fileId, category);

      // Store fileId for audit logger
      res.locals.fileId = fileId;

      res.status(200).json({
        message: 'File moved successfully',
        file: {
          _id: file._id,
          filename: file.filename,
          oldCategory: file.category,
          newCategory: category,
        },
      });
    } catch (error) {
      if (error.name === 'ZodError') {
        return res.status(400).json({
          error: 'Validation failed',
          details: error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
        });
      }

      console.error('Move category error:', error);
      res.status(500).json({ error: 'Failed to move file' });
    }
  }
);

/**
 * DELETE /api/files/:fileId
 * Delete a file from both database and S3
 * Performs cascade deletion: removes file, share links, user shares, and audit logs
 */
router.delete('/:fileId', auth, auditLogger('DELETE'), async (req, res) => {
  try {
    const { fileId } = fileIdSchema.parse(req.params);

    const file = await filesData.getFileById(fileId);

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Verify ownership
    if (file.ownerId.toString() !== req.user.userId) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Delete from database with cascade deletion (also removes shareLinks, userShares, auditLogs)
    const deleteResult = await filesData.deleteFile(fileId);

    // Then delete from S3
    await deleteFromS3(file.s3Key);

    res.status(200).json({
      message: 'File deleted successfully',
      fileId,
      deletedRecords: {
        file: deleteResult.file.deletedCount,
        shareLinks: deleteResult.shareLinks.deletedCount,
        userShares: deleteResult.userShares.deletedCount,
        auditLogs: deleteResult.auditLogs.deletedCount,
      },
    });
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
      });
    }

    console.error('Delete error:', error);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

/**
 * GET /api/files/:fileId/details
 * Get detailed file information
 */
router.get('/:fileId/details', auth, async (req, res) => {
  try {
    const { fileId } = fileIdSchema.parse(req.params);

    const file = await filesData.getFileById(fileId);

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Verify ownership
    if (file.ownerId.toString() !== req.user.userId) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.status(200).json({
      file: {
        _id: file._id,
        filename: file.filename,
        description: file.description,
        category: file.category,
        size: file.size,
        mimetype: file.mimetype,
        uploadedAt: file.uploadedAt,
        lastAccessedAt: file.lastAccessedAt,
        accessCount: file.accessCount,
      },
    });
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
      });
    }

    console.error('Get file details error:', error);
    res.status(500).json({ error: 'Failed to retrieve file details' });
  }
});

export default router;
