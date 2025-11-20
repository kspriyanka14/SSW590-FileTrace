import { ObjectId } from 'mongodb';
import { z } from 'zod';
import { getCollection, COLLECTIONS } from '../config/index.js';
import {
  filenameSchema,
  categorySchema,
  positiveIntSchema,
  objectIdSchema,
} from '../validation/index.js';

/**
 * Schema for creating a file
 */
const createFileSchema = z.object({
  filename: filenameSchema,
  originalFilename: filenameSchema,
  description: z.string().max(250).optional(),
  category: categorySchema,
  size: positiveIntSchema,
  mimetype: z.string().min(1),
  s3Key: z.string().min(1),
  ownerId: objectIdSchema,
});

/**
 * Creates a new file record in the database
 *
 * @param {Object} fileData - File metadata
 * @param {string} fileData.filename - Display filename
 * @param {string} fileData.originalFilename - Original filename at upload
 * @param {string} [fileData.description] - Optional file description
 * @param {string} fileData.category - File category (Personal, Work, Documents, Archive)
 * @param {number} fileData.size - File size in bytes
 * @param {string} fileData.mimetype - MIME type
 * @param {string} fileData.s3Key - S3 object key
 * @param {string} fileData.ownerId - Owner user ID
 * @returns {Promise<Object>} Created file object
 * @throws {Error} If validation fails
 * @example
 * const file = await createFile({
 *   filename: 'document.pdf',
 *   originalFilename: 'document.pdf',
 *   description: 'Important document',
 *   category: 'Documents',
 *   size: 1024000,
 *   mimetype: 'application/pdf',
 *   s3Key: 'userId/uuid-document.pdf',
 *   ownerId: '507f1f77bcf86cd799439011'
 * });
 */
const createFile = async (fileData) => {
  // Validate file data
  const validatedData = createFileSchema.parse(fileData);

  const collection = getCollection(COLLECTIONS.FILES);

  const now = new Date();
  const newFile = {
    filename: validatedData.filename,
    originalFilename: validatedData.originalFilename,
    description: validatedData.description,
    category: validatedData.category,
    size: validatedData.size,
    mimetype: validatedData.mimetype,
    s3Key: validatedData.s3Key,
    ownerId: new ObjectId(validatedData.ownerId),
    uploadedAt: now,
    lastAccessedAt: now,
    accessCount: 0,
    createdAt: now,
    updatedAt: now,
  };

  // Remove undefined description if not provided
  if (newFile.description === undefined) {
    delete newFile.description;
  }

  const result = await collection.insertOne(newFile);

  return {
    ...newFile,
    _id: result.insertedId,
  };
};

/**
 * Retrieves a file by ID
 *
 * @param {string} fileId - File ID
 * @returns {Promise<Object|null>} File object or null if not found
 * @throws {Error} If validation fails
 * @example
 * const file = await getFileById('507f1f77bcf86cd799439011');
 */
const getFileById = async (fileId) => {
  // Validate file ID
  const validatedId = objectIdSchema.parse(fileId);

  const collection = getCollection(COLLECTIONS.FILES);
  const file = await collection.findOne({ _id: new ObjectId(validatedId) });

  return file;
};

/**
 * Retrieves all files for a specific owner
 *
 * @param {string} ownerId - Owner user ID
 * @returns {Promise<Array>} Array of file objects
 * @throws {Error} If validation fails
 * @example
 * const files = await getFilesByOwner('507f1f77bcf86cd799439011');
 */
const getFilesByOwner = async (ownerId) => {
  // Validate owner ID
  const validatedId = objectIdSchema.parse(ownerId);

  const collection = getCollection(COLLECTIONS.FILES);
  const files = await collection
    .find({ ownerId: new ObjectId(validatedId) })
    .sort({ uploadedAt: -1 })
    .toArray();

  return files;
};

/**
 * Retrieves files by category for a specific owner
 * Includes recent activity data from audit logs for each file
 *
 * @param {string} ownerId - Owner user ID
 * @param {string} category - File category
 * @returns {Promise<Array>} Array of file objects with recentActivity field
 * @throws {Error} If validation fails
 * @example
 * const files = await getFilesByCategory('507f1f77bcf86cd799439011', 'Work');
 * // Returns files with recentActivity: { action: 'DOWNLOAD', timestamp: Date }
 */
const getFilesByCategory = async (ownerId, category) => {
  // Validate inputs
  const validatedId = objectIdSchema.parse(ownerId);
  const validatedCategory = categorySchema.parse(category);

  const collection = getCollection(COLLECTIONS.FILES);
  const files = await collection
    .find({
      ownerId: new ObjectId(validatedId),
      category: validatedCategory,
    })
    .sort({ uploadedAt: -1 })
    .toArray();

  // Get recent activity for all files
  if (files.length > 0) {
    const fileIds = files.map((f) => f._id.toString());
    const activityMap = await getRecentActivityForFiles(fileIds);

    // Add recent activity to each file
    files.forEach((file) => {
      const activity = activityMap.get(file._id.toString());
      // If no activity found in audit logs, use upload as the most recent activity
      file.recentActivity = activity || {
        action: 'UPLOAD',
        timestamp: file.uploadedAt,
      };
    });
  }

  return files;
};

/**
 * Updates the filename of a file (metadata only, S3 file unchanged)
 *
 * @param {string} fileId - File ID
 * @param {string} newFilename - New filename
 * @returns {Promise<Object>} Update result
 * @throws {Error} If validation fails
 * @example
 * await updateFilename('507f1f77bcf86cd799439011', 'new-name.pdf');
 */
const updateFilename = async (fileId, newFilename) => {
  // Validate inputs
  const validatedId = objectIdSchema.parse(fileId);
  const validatedFilename = filenameSchema.parse(newFilename);

  const collection = getCollection(COLLECTIONS.FILES);
  const result = await collection.updateOne(
    { _id: new ObjectId(validatedId) },
    {
      $set: {
        filename: validatedFilename,
        updatedAt: new Date(),
      },
    }
  );

  return result;
};

/**
 * Updates the category of a file
 * Moves a file to a different category (Personal, Work, Documents, Archive)
 *
 * @param {string} fileId - File ID
 * @param {string} newCategory - New category (Personal, Work, Documents, Archive)
 * @returns {Promise<Object>} Update result
 * @throws {Error} If validation fails
 * @example
 * await moveFileToCategory('507f1f77bcf86cd799439011', 'Work');
 */
const moveFileToCategory = async (fileId, newCategory) => {
  // Validate inputs
  const validatedId = objectIdSchema.parse(fileId);
  const validatedCategory = categorySchema.parse(newCategory);

  const collection = getCollection(COLLECTIONS.FILES);
  const result = await collection.updateOne(
    { _id: new ObjectId(validatedId) },
    {
      $set: {
        category: validatedCategory,
        updatedAt: new Date(),
      },
    }
  );

  return result;
};

/**
 * Deletes a file from the database with cascade deletion
 * Removes the file and all associated data from related collections:
 * - Deletes file record from FILES collection
 * - Deletes all share links for this file from SHARE_LINKS collection
 * - Deletes all user shares for this file from USER_SHARES collection
 * - Deletes all audit logs for this file from AUDIT_LOGS collection
 *
 * NOTE: S3 file deletion should be handled separately in the route layer
 *
 * @param {string} fileId - File ID
 * @returns {Promise<Object>} Delete result with counts for each collection
 * @returns {Promise<Object>} result.file - File deletion result (deletedCount)
 * @returns {Promise<Object>} result.shareLinks - Share links deletion result (deletedCount)
 * @returns {Promise<Object>} result.userShares - User shares deletion result (deletedCount)
 * @returns {Promise<Object>} result.auditLogs - Audit logs deletion result (deletedCount)
 * @throws {Error} If validation fails
 * @example
 * const result = await deleteFile('507f1f77bcf86cd799439011');
 * // Returns: {
 * //   file: { deletedCount: 1 },
 * //   shareLinks: { deletedCount: 3 },
 * //   userShares: { deletedCount: 2 },
 * //   auditLogs: { deletedCount: 15 }
 * // }
 */
const deleteFile = async (fileId) => {
  // Validate file ID
  const validatedId = objectIdSchema.parse(fileId);
  const fileObjectId = new ObjectId(validatedId);

  // Get all collections
  const filesCollection = getCollection(COLLECTIONS.FILES);
  const shareLinksCollection = getCollection(COLLECTIONS.SHARE_LINKS);
  const userSharesCollection = getCollection(COLLECTIONS.USER_SHARES);
  const auditLogsCollection = getCollection(COLLECTIONS.AUDIT_LOGS);

  // Delete file from FILES collection
  const fileResult = await filesCollection.deleteOne({ _id: fileObjectId });

  // Cascade delete: Remove all share links associated with this file
  const shareLinksResult = await shareLinksCollection.deleteMany({
    fileId: fileObjectId,
  });

  // Cascade delete: Remove all user shares associated with this file
  const userSharesResult = await userSharesCollection.deleteMany({
    fileId: fileObjectId,
  });

  // Cascade delete: Remove all audit logs associated with this file
  const auditLogsResult = await auditLogsCollection.deleteMany({
    fileId: fileObjectId,
  });

  // Return aggregated results
  return {
    file: {
      deletedCount: fileResult.deletedCount,
    },
    shareLinks: {
      deletedCount: shareLinksResult.deletedCount,
    },
    userShares: {
      deletedCount: userSharesResult.deletedCount,
    },
    auditLogs: {
      deletedCount: auditLogsResult.deletedCount,
    },
  };
};

/**
 * Updates file access statistics
 * Increments access count and updates last accessed timestamp
 *
 * @param {string} fileId - File ID
 * @returns {Promise<Object>} Update result
 * @throws {Error} If validation fails
 * @example
 * await updateAccessStats('507f1f77bcf86cd799439011');
 */
const updateAccessStats = async (fileId) => {
  // Validate file ID
  const validatedId = objectIdSchema.parse(fileId);

  const collection = getCollection(COLLECTIONS.FILES);
  const result = await collection.updateOne(
    { _id: new ObjectId(validatedId) },
    {
      $inc: { accessCount: 1 },
      $set: {
        lastAccessedAt: new Date(),
        updatedAt: new Date(),
      },
    }
  );

  return result;
};

/**
 * Search and filter files with compound filtering
 * Supports search by filename, filter by type, and sorting
 *
 * @param {string} ownerId - Owner user ID
 * @param {Object} filters - Filter options
 * @param {string} [filters.search] - Search term for filename (case-insensitive)
 * @param {string} [filters.fileType] - MIME type filter
 * @param {string} [filters.sortBy] - Sort field (uploadDate, accessDate, filename, fileType)
 * @param {string} [filters.sortOrder] - Sort order (asc, desc)
 * @returns {Promise<Array>} Array of filtered and sorted files
 * @throws {Error} If validation fails
 * @example
 * const files = await searchAndFilterFiles('userId', {
 *   search: 'report',
 *   fileType: 'application/pdf',
 *   sortBy: 'uploadDate',
 *   sortOrder: 'desc'
 * });
 */
const searchAndFilterFiles = async (ownerId, filters = {}) => {
  // Validate owner ID
  const validatedId = objectIdSchema.parse(ownerId);

  const collection = getCollection(COLLECTIONS.FILES);

  // Build query
  const query = { ownerId: new ObjectId(validatedId) };

  // Add filename search (case-insensitive regex)
  if (filters.search) {
    query.filename = { $regex: filters.search, $options: 'i' };
  }

  // Add file type filter
  if (filters.fileType) {
    query.mimetype = filters.fileType;
  }

  // Build sort options
  let sort = { uploadedAt: -1 }; // Default: newest first

  if (filters.sortBy) {
    switch (filters.sortBy) {
      case 'uploadDate':
        sort = { uploadedAt: filters.sortOrder === 'asc' ? 1 : -1 };
        break;
      case 'accessDate':
        sort = { lastAccessedAt: filters.sortOrder === 'asc' ? 1 : -1 };
        break;
      case 'filename':
        sort = { filename: filters.sortOrder === 'asc' ? 1 : -1 };
        break;
      case 'fileType':
        sort = { mimetype: filters.sortOrder === 'asc' ? 1 : -1 };
        break;
      default:
        sort = { uploadedAt: -1 };
    }
  }

  const files = await collection.find(query).sort(sort).toArray();

  return files;
};

/**
 * Get most recent activity for files from audit logs
 * Uses MongoDB aggregation to efficiently fetch the latest audit log entry for each file
 *
 * @param {Array<string>} fileIds - Array of file IDs to get recent activity for
 * @returns {Promise<Map>} Map of fileId to recent activity { action, timestamp }
 * @throws {Error} If file IDs are invalid
 * @example
 * const activityMap = await getRecentActivityForFiles(['fileId1', 'fileId2']);
 * // Returns: Map { 'fileId1' => { action: 'DOWNLOAD', timestamp: Date }, ... }
 */
const getRecentActivityForFiles = async (fileIds) => {
  if (!fileIds || fileIds.length === 0) {
    return new Map();
  }

  const auditCollection = getCollection(COLLECTIONS.AUDIT_LOGS);

  // Get most recent audit log for each file using aggregation
  const recentActivities = await auditCollection
    .aggregate([
      {
        $match: {
          fileId: { $in: fileIds.map((id) => new ObjectId(id)) },
          action: {
            $in: [
              'UPLOAD',
              'DOWNLOAD',
              'NAME_CHANGE',
              'SHARE_CREATED',
              'EXPIRED_LINK_ATTEMPT',
            ],
          },
        },
      },
      {
        $sort: { timestamp: -1 },
      },
      {
        $group: {
          _id: '$fileId',
          action: { $first: '$action' },
          timestamp: { $first: '$timestamp' },
        },
      },
    ])
    .toArray();

  // Convert to Map for easy lookup
  const activityMap = new Map();
  recentActivities.forEach((activity) => {
    activityMap.set(activity._id.toString(), {
      action: activity.action,
      timestamp: activity.timestamp,
    });
  });

  return activityMap;
};

export default {
  createFile,
  getFileById,
  getFilesByOwner,
  getFilesByCategory,
  updateFilename,
  moveFileToCategory,
  deleteFile,
  updateAccessStats,
  searchAndFilterFiles,
  getRecentActivityForFiles,
};
