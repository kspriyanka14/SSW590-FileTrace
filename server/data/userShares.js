import { ObjectId } from 'mongodb';
import { z } from 'zod';
import { getCollection, COLLECTIONS } from '../config/index.js';
import {
  objectIdSchema,
  nonNegativeIntSchema,
  positiveIntSchema,
} from '../validation/index.js';

/**
 * Schema for creating a user share
 * Expiration time is in minutes (min: 10, max: 525960 = 1 year)
 */
const createUserShareSchema = z
  .object({
    fileId: objectIdSchema,
    ownerId: objectIdSchema,
    recipientId: objectIdSchema,
    expirationMinutes: z
      .number()
      .int('Expiration minutes must be an integer')
      .min(10, 'Expiration must be at least 10 minutes')
      .max(525960, 'Expiration cannot exceed 1 year (525960 minutes)')
      .optional(),
    maxAccessCount: positiveIntSchema.optional(),
  })
  .refine(
    (data) =>
      data.expirationMinutes !== undefined || data.maxAccessCount !== undefined,
    { message: 'At least one expiration method is required' }
  )
  .refine((data) => data.ownerId !== data.recipientId, {
    message: 'Cannot share file with yourself',
  });

/**
 * Creates a new user share
 *
 * @param {Object} userShareData - User share data
 * @returns {Promise<Object>} Created user share object
 * @throws {Error} If validation fails or sharing with self
 */
const createUserShare = async (userShareData) => {
  const validatedData = createUserShareSchema.parse(userShareData);

  const collection = getCollection(COLLECTIONS.USER_SHARES);

  // Check for existing active share
  const existing = await collection.findOne({
    fileId: new ObjectId(validatedData.fileId),
    recipientId: new ObjectId(validatedData.recipientId),
    isActive: true,
  });

  // If existing active share found, deactivate it to allow new share with different settings
  if (existing) {
    await collection.updateOne(
      { _id: existing._id },
      {
        $set: {
          isActive: false,
          updatedAt: new Date(),
        },
      }
    );
  }

  let expiresAt;
  if (validatedData.expirationMinutes !== undefined) {
    expiresAt = new Date();
    expiresAt.setMinutes(
      expiresAt.getMinutes() + validatedData.expirationMinutes
    );
  }

  const now = new Date();
  const newUserShare = {
    fileId: new ObjectId(validatedData.fileId),
    ownerId: new ObjectId(validatedData.ownerId),
    recipientId: new ObjectId(validatedData.recipientId),
    expiresAt,
    maxAccessCount: validatedData.maxAccessCount,
    accessCount: 0,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };

  // Remove undefined fields
  if (newUserShare.expiresAt === undefined) delete newUserShare.expiresAt;
  if (newUserShare.maxAccessCount === undefined)
    delete newUserShare.maxAccessCount;

  const result = await collection.insertOne(newUserShare);

  return { ...newUserShare, _id: result.insertedId };
};

/**
 * Retrieves all files shared with a specific user
 *
 * @param {string} recipientId - Recipient user ID
 * @returns {Promise<Array>} Array of shared files with share info
 */
const getFilesSharedWithUser = async (recipientId) => {
  const validatedId = objectIdSchema.parse(recipientId);

  const collection = getCollection(COLLECTIONS.USER_SHARES);
  const shares = await collection
    .find({
      recipientId: new ObjectId(validatedId),
      isActive: true,
    })
    .sort({ createdAt: -1 })
    .toArray();

  return shares;
};

/**
 * Retrieves all files shared with a specific user WITH OWNER USERNAME
 * Uses MongoDB aggregation with $lookup to join with users collection
 * More efficient than fetching owner info separately for each share
 * This is the enriched version of getFilesSharedWithUser()
 *
 * @param {string} recipientId - Recipient user ID
 * @returns {Promise<Array>} Array of share objects enriched with owner info
 * @throws {Error} If validation fails
 * @example
 * const shares = await getFilesSharedWithUserEnriched('507f1f77bcf86cd799439011');
 * // Returns: [
 * //   {
 * //     _id, fileId, ownerId, recipientId,
 * //     expiresAt, maxAccessCount, accessCount, isActive,
 * //     createdAt, updatedAt,
 * //     ownerInfo: { _id, username }  // Joined from users collection
 * //   }
 * // ]
 * // Note: ownerInfo.username will be 'Unknown User' if owner account deleted
 */
const getFilesSharedWithUserEnriched = async (recipientId) => {
  // Validate recipient ID
  const validatedId = objectIdSchema.parse(recipientId);

  const collection = getCollection(COLLECTIONS.USER_SHARES);

  // Use aggregation pipeline for efficient join with users collection
  const shares = await collection
    .aggregate([
      // Stage 1: Match active shares for this recipient
      {
        $match: {
          recipientId: new ObjectId(validatedId),
          isActive: true,
        },
      },

      // Stage 2: Join with users collection to get owner info
      {
        $lookup: {
          from: COLLECTIONS.USERS,
          localField: 'ownerId',
          foreignField: '_id',
          as: 'ownerInfo',
          pipeline: [
            { $project: { _id: 1, username: 1 } }, // Only fetch _id and username
          ],
        },
      },

      // Stage 3: Unwind ownerInfo array (convert from array to object)
      {
        $unwind: {
          path: '$ownerInfo',
          preserveNullAndEmptyArrays: true, // Handle deleted users
        },
      },

      // Stage 4: Add fallback for deleted users
      {
        $addFields: {
          ownerInfo: {
            $ifNull: [
              '$ownerInfo',
              { _id: '$ownerId', username: 'Unknown User' },
            ],
          },
        },
      },

      // Stage 5: Sort by most recent first
      { $sort: { createdAt: -1 } },
    ])
    .toArray();

  return shares;
};

/**
 * Gets a specific share by file and recipient
 *
 * @param {string} fileId - File ID
 * @param {string} recipientId - Recipient user ID
 * @returns {Promise<Object|null>} User share object or null
 */
const getShareByFileAndRecipient = async (fileId, recipientId) => {
  const validatedFileId = objectIdSchema.parse(fileId);
  const validatedRecipientId = objectIdSchema.parse(recipientId);

  const collection = getCollection(COLLECTIONS.USER_SHARES);

  // Only return active shares, sorted by most recent first
  const share = await collection.findOne(
    {
      fileId: new ObjectId(validatedFileId),
      recipientId: new ObjectId(validatedRecipientId),
      isActive: true,
    },
    {
      sort: { createdAt: -1 },
    }
  );

  return share;
};

/**
 * Validates if a user share is still valid
 *
 * @param {string} shareId - Share ID
 * @returns {Promise<boolean>} True if share is valid
 */
const validateUserShare = async (shareId) => {
  const validatedId = objectIdSchema.parse(shareId);

  const collection = getCollection(COLLECTIONS.USER_SHARES);
  const share = await collection.findOne({ _id: new ObjectId(validatedId) });

  if (!share || !share.isActive) return false;

  if (share.expiresAt && new Date() >= share.expiresAt) return false;

  if (
    share.maxAccessCount !== undefined &&
    share.accessCount >= share.maxAccessCount
  ) {
    return false;
  }

  return true;
};

/**
 * Increments the access count for a user share
 *
 * @param {string} shareId - Share ID
 * @returns {Promise<Object>} Update result
 */
const incrementUserShareAccess = async (shareId) => {
  const validatedId = objectIdSchema.parse(shareId);

  const collection = getCollection(COLLECTIONS.USER_SHARES);
  const result = await collection.updateOne(
    { _id: new ObjectId(validatedId) },
    {
      $inc: { accessCount: 1 },
      $set: { updatedAt: new Date() },
    }
  );

  return result;
};

/**
 * Retrieves all ACTIVE and NON-EXPIRED user shares for a specific file
 * Filters out:
 * - Inactive shares (isActive: false)
 * - Time-expired shares (expiresAt < now)
 * - Access-count-expired shares (accessCount >= maxAccessCount)
 *
 * Includes detailed recipient information from users collection
 * Enriches data with calculated fields (remainingAccesses)
 *
 * @param {string} fileId - File ID
 * @returns {Promise<Array>} Array of active, non-expired user share objects with recipient details
 * @throws {Error} If validation fails
 * @example
 * const activeShares = await getActiveUserSharesByFile('507f1f77bcf86cd799439011');
 * // Returns: [
 * //   {
 * //     _id, fileId, ownerId, recipientId,
 * //     expiresAt, maxAccessCount, accessCount,
 * //     remainingAccesses: 5,
 * //     recipientInfo: { _id, username, email },
 * //     createdAt, updatedAt
 * //   }
 * // ]
 * // Note: All returned shares are guaranteed to be non-expired
 */
const getActiveUserSharesByFile = async (fileId) => {
  // Validate file ID
  const validatedId = objectIdSchema.parse(fileId);

  const userSharesCollection = getCollection(COLLECTIONS.USER_SHARES);
  const usersCollection = getCollection(COLLECTIONS.USERS);

  const now = new Date();

  // Use aggregation to filter out expired shares
  const userShares = await userSharesCollection
    .aggregate([
      {
        $match: {
          fileId: new ObjectId(validatedId),
          isActive: true,
        },
      },
      {
        $match: {
          $expr: {
            $and: [
              // Not expired by time
              {
                $or: [
                  { $eq: [{ $type: '$expiresAt' }, 'missing'] },
                  { $gt: ['$expiresAt', now] },
                ],
              },
              // Not expired by access count
              {
                $or: [
                  { $eq: [{ $type: '$maxAccessCount' }, 'missing'] },
                  { $lt: ['$accessCount', '$maxAccessCount'] },
                ],
              },
            ],
          },
        },
      },
      { $sort: { createdAt: -1 } },
    ])
    .toArray();

  // Enrich each share with recipient information and calculated fields
  const enrichedShares = await Promise.all(
    userShares.map(async (share) => {
      // Fetch recipient user information
      const recipient = await usersCollection.findOne(
        { _id: share.recipientId },
        { projection: { _id: 1, username: 1, email: 1 } }
      );

      // Calculate remaining accesses (null if no limit)
      const remainingAccesses =
        share.maxAccessCount !== undefined
          ? Math.max(0, share.maxAccessCount - share.accessCount)
          : null;

      return {
        ...share,
        recipientInfo: recipient || {
          _id: share.recipientId,
          username: null,
          email: null,
        },
        remainingAccesses,
      };
    })
  );

  return enrichedShares;
};

/**
 * Revokes all user shares for a specific file
 * Deactivates all shares (both active and inactive) by setting isActive to false
 * Used when file owner wants to revoke all user access at once
 *
 * @param {string} fileId - File ID
 * @returns {Promise<Object>} Update result with modifiedCount
 * @throws {Error} If validation fails
 * @example
 * const result = await revokeAllUserSharesByFile('507f1f77bcf86cd799439011');
 * // Returns: { modifiedCount: 2 }
 */
const revokeAllUserSharesByFile = async (fileId) => {
  // Validate file ID
  const validatedId = objectIdSchema.parse(fileId);

  const collection = getCollection(COLLECTIONS.USER_SHARES);
  const result = await collection.updateMany(
    {
      fileId: new ObjectId(validatedId),
      isActive: true,
    },
    {
      $set: {
        isActive: false,
        updatedAt: new Date(),
      },
    }
  );

  return {
    modifiedCount: result.modifiedCount,
  };
};

/**
 * Deactivates a user share
 *
 * @param {string} shareId - Share ID
 * @returns {Promise<Object>} Update result
 */
const deactivateUserShare = async (shareId) => {
  const validatedId = objectIdSchema.parse(shareId);

  const collection = getCollection(COLLECTIONS.USER_SHARES);
  const result = await collection.updateOne(
    { _id: new ObjectId(validatedId) },
    {
      $set: {
        isActive: false,
        updatedAt: new Date(),
      },
    }
  );

  return result;
};

export default {
  createUserShare,
  getFilesSharedWithUser,
  getFilesSharedWithUserEnriched,
  getShareByFileAndRecipient,
  validateUserShare,
  incrementUserShareAccess,
  getActiveUserSharesByFile,
  revokeAllUserSharesByFile,
  deactivateUserShare,
};
