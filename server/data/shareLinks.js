import { ObjectId } from 'mongodb';
import crypto from 'crypto';
import { z } from 'zod';
import { getCollection, COLLECTIONS } from '../config/index.js';
import {
  objectIdSchema,
  nonNegativeIntSchema,
  positiveIntSchema,
  shareTokenSchema,
} from '../validation/index.js';

/**
 * Schema for creating a share link
 * At least one expiration method (time or count) is required
 */
const createShareLinkSchema = z
  .object({
    fileId: objectIdSchema,
    ownerId: objectIdSchema,
    expirationHours: nonNegativeIntSchema.optional(),
    maxAccessCount: positiveIntSchema.optional(),
  })
  .refine(
    (data) =>
      data.expirationHours !== undefined || data.maxAccessCount !== undefined,
    {
      message:
        'At least one expiration method (expirationHours or maxAccessCount) is required',
    }
  );

/**
 * Generates a secure random token for share links
 * Creates 32 random bytes converted to 64 hex characters
 *
 * @returns {string} 64-character hexadecimal token
 * @example
 * const token = generateShareToken();
 * // Returns: "a1b2c3d4e5f6..."
 */
const generateShareToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Creates a new share link for a file
 *
 * @param {Object} shareLinkData - Share link data
 * @param {string} shareLinkData.fileId - File ID to share
 * @param {string} shareLinkData.ownerId - Owner user ID
 * @param {number} [shareLinkData.expirationMinutes] - Minutes until expiration (min: 10, max: 525960 = 1 year)
 * @param {number} [shareLinkData.maxAccessCount] - Maximum number of accesses
 * @returns {Promise<Object>} Created share link object
 * @throws {Error} If validation fails or no expiration method provided
 * @example
 * const shareLink = await createShareLink({
 *   fileId: '507f1f77bcf86cd799439011',
 *   ownerId: '507f1f77bcf86cd799439012',
 *   expirationMinutes: 1440, // 24 hours
 *   maxAccessCount: 10
 * });
 */
const createShareLink = async (shareLinkData) => {
  // Validate share link data
  const validatedData = createShareLinkSchema.parse(shareLinkData);

  const collection = getCollection(COLLECTIONS.SHARE_LINKS);

  // Generate unique token
  const token = generateShareToken();

  // Calculate expiration date if minutes provided
  let expiresAt;
  if (validatedData.expirationMinutes !== undefined) {
    expiresAt = new Date();
    expiresAt.setMinutes(
      expiresAt.getMinutes() + validatedData.expirationMinutes
    );
  }

  const now = new Date();
  const newShareLink = {
    token,
    fileId: new ObjectId(validatedData.fileId),
    ownerId: new ObjectId(validatedData.ownerId),
    shareType: 'link',
    expiresAt,
    maxAccessCount: validatedData.maxAccessCount,
    accessCount: 0,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };

  // Remove undefined fields
  if (newShareLink.expiresAt === undefined) {
    delete newShareLink.expiresAt;
  }
  if (newShareLink.maxAccessCount === undefined) {
    delete newShareLink.maxAccessCount;
  }

  const result = await collection.insertOne(newShareLink);

  return {
    ...newShareLink,
    _id: result.insertedId,
  };
};

/**
 * Retrieves a share link by token
 *
 * @param {string} token - Share link token (64 hex characters)
 * @returns {Promise<Object|null>} Share link object or null if not found
 * @throws {Error} If validation fails
 * @example
 * const shareLink = await getShareLinkByToken('a1b2c3d4...');
 */
const getShareLinkByToken = async (token) => {
  // Validate token format
  const validatedToken = shareTokenSchema.parse({ token });

  const collection = getCollection(COLLECTIONS.SHARE_LINKS);
  const shareLink = await collection.findOne({ token: validatedToken.token });

  return shareLink;
};

/**
 * Validates if a share link is still valid
 * Checks: exists, active, not expired by time, not exceeded access count
 *
 * @param {string} token - Share link token
 * @returns {Promise<boolean>} True if share link is valid
 * @throws {Error} If validation fails
 * @example
 * const isValid = await validateShareLink('a1b2c3d4...');
 */
const validateShareLink = async (token) => {
  const shareLink = await getShareLinkByToken(token);

  if (!shareLink) {
    return false;
  }

  // Check if active
  if (!shareLink.isActive) {
    return false;
  }

  // Check time expiration
  if (shareLink.expiresAt && new Date() >= shareLink.expiresAt) {
    return false;
  }

  // Check access count expiration
  if (
    shareLink.maxAccessCount !== undefined &&
    shareLink.accessCount >= shareLink.maxAccessCount
  ) {
    return false;
  }

  return true;
};

/**
 * Increments the access count for a share link
 *
 * @param {string} token - Share link token
 * @returns {Promise<Object>} Update result
 * @throws {Error} If validation fails
 * @example
 * await incrementShareAccess('a1b2c3d4...');
 */
const incrementShareAccess = async (token) => {
  // Validate token format
  const validatedToken = shareTokenSchema.parse({ token });

  const collection = getCollection(COLLECTIONS.SHARE_LINKS);
  const result = await collection.updateOne(
    { token: validatedToken.token },
    {
      $inc: { accessCount: 1 },
      $set: { updatedAt: new Date() },
    }
  );

  return result;
};

/**
 * Retrieves all share links for a specific file
 *
 * @param {string} fileId - File ID
 * @returns {Promise<Array>} Array of share link objects
 * @throws {Error} If validation fails
 * @example
 * const shareLinks = await getShareLinksByFile('507f1f77bcf86cd799439011');
 */
const getShareLinksByFile = async (fileId) => {
  // Validate file ID
  const validatedId = objectIdSchema.parse(fileId);

  const collection = getCollection(COLLECTIONS.SHARE_LINKS);
  const shareLinks = await collection
    .find({ fileId: new ObjectId(validatedId) })
    .sort({ createdAt: -1 })
    .toArray();

  return shareLinks;
};

/**
 * Retrieves all ACTIVE and NON-EXPIRED share links for a specific file
 * Filters out:
 * - Inactive links (isActive: false)
 * - Time-expired links (expiresAt < now)
 * - Access-count-expired links (accessCount >= maxAccessCount)
 *
 * Enriches data with calculated fields (remainingAccesses)
 *
 * @param {string} fileId - File ID
 * @returns {Promise<Array>} Array of active, non-expired share link objects with enriched data
 * @throws {Error} If validation fails
 * @example
 * const activeLinks = await getActiveShareLinksByFile('507f1f77bcf86cd799439011');
 * // Returns: [
 * //   {
 * //     _id, token, fileId, ownerId, expiresAt, maxAccessCount, accessCount,
 * //     remainingAccesses: 7,
 * //     createdAt, updatedAt
 * //   }
 * // ]
 * // Note: All returned shares are guaranteed to be non-expired
 */
const getActiveShareLinksByFile = async (fileId) => {
  // Validate file ID
  const validatedId = objectIdSchema.parse(fileId);

  const collection = getCollection(COLLECTIONS.SHARE_LINKS);
  const now = new Date();

  // Use aggregation to filter out expired shares
  const shareLinks = await collection
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

  // Enrich each share link with calculated fields
  const enrichedLinks = shareLinks.map((link) => {
    // Calculate remaining accesses (null if no limit)
    const remainingAccesses =
      link.maxAccessCount !== undefined
        ? Math.max(0, link.maxAccessCount - link.accessCount)
        : null;

    return {
      ...link,
      remainingAccesses,
    };
  });

  return enrichedLinks;
};

/**
 * Revokes all share links for a specific file
 * Deactivates all links (both active and inactive) by setting isActive to false
 * Used when file owner wants to revoke all public access at once
 *
 * @param {string} fileId - File ID
 * @returns {Promise<Object>} Update result with modifiedCount
 * @throws {Error} If validation fails
 * @example
 * const result = await revokeAllShareLinksByFile('507f1f77bcf86cd799439011');
 * // Returns: { modifiedCount: 3 }
 */
const revokeAllShareLinksByFile = async (fileId) => {
  // Validate file ID
  const validatedId = objectIdSchema.parse(fileId);

  const collection = getCollection(COLLECTIONS.SHARE_LINKS);
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
 * Deactivates a share link (soft delete)
 *
 * @param {string} token - Share link token
 * @returns {Promise<Object>} Update result
 * @throws {Error} If validation fails
 * @example
 * await deactivateShareLink('a1b2c3d4...');
 */
const deactivateShareLink = async (token) => {
  // Validate token format
  const validatedToken = shareTokenSchema.parse({ token });

  const collection = getCollection(COLLECTIONS.SHARE_LINKS);
  const result = await collection.updateOne(
    { token: validatedToken.token },
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
  createShareLink,
  getShareLinkByToken,
  validateShareLink,
  incrementShareAccess,
  getShareLinksByFile,
  getActiveShareLinksByFile,
  revokeAllShareLinksByFile,
  deactivateShareLink,
};
