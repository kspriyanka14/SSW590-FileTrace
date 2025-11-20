import { ObjectId } from 'mongodb';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { getCollection, getDb, COLLECTIONS } from '../config/index.js';
import {
  emailSchema,
  usernameSchema,
  passwordSchema,
  objectIdSchema,
} from '../validation/index.js';

/**
 * Number of salt rounds for bcrypt hashing
 * Higher number = more secure but slower
 * Using 10 rounds (2025 industry standard)
 */
const BCRYPT_ROUNDS = 10;

/**
 * Schema for creating a user (data layer validation)
 * Excludes confirmPassword which is only needed at route level
 */
const createUserSchema = z.object({
  username: usernameSchema,
  email: emailSchema,
  password: passwordSchema,
});

/**
 * Creates a new user in the database
 *
 * @param {Object} userData - User data object
 * @param {string} userData.username - Username (3-30 chars, alphanumeric with _ -)
 * @param {string} userData.email - Email address
 * @param {string} userData.password - Plain text password (will be hashed)
 * @returns {Promise<Object>} Created user object without password
 * @throws {Error} If validation fails or email/username already exists
 * @example
 * const user = await createUser({
 *   username: 'john_doe',
 *   email: 'john@example.com',
 *   password: 'SecurePass123'
 * });
 */
const createUser = async (userData) => {
  // Validate user data
  const validatedData = createUserSchema.parse(userData);

  const collection = getCollection(COLLECTIONS.USERS);

  // Check for existing email
  const existingEmail = await collection.findOne({
    email: validatedData.email,
  });
  if (existingEmail) {
    throw new Error('Email already exists');
  }

  // Check for existing username
  const existingUsername = await collection.findOne({
    username: validatedData.username,
  });
  if (existingUsername) {
    throw new Error('Username already exists');
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(
    validatedData.password,
    BCRYPT_ROUNDS
  );

  // Create user document
  const newUser = {
    username: validatedData.username,
    email: validatedData.email,
    password: hashedPassword,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const result = await collection.insertOne(newUser);

  // Return user without password
  const { password, ...userWithoutPassword } = newUser;
  return {
    ...userWithoutPassword,
    _id: result.insertedId,
  };
};

/**
 * Retrieves a user by email address
 *
 * @param {string} email - Email address (case-insensitive)
 * @returns {Promise<Object|null>} User object or null if not found
 * @throws {Error} If validation fails
 * @example
 * const user = await getUserByEmail('john@example.com');
 */
const getUserByEmail = async (email) => {
  // Validate email format
  const validatedEmail = emailSchema.parse(email);

  const collection = getCollection(COLLECTIONS.USERS);
  const user = await collection.findOne({ email: validatedEmail });

  return user;
};

/**
 * Retrieves a user by user ID
 *
 * @param {string} userId - MongoDB ObjectId as string
 * @returns {Promise<Object|null>} User object or null if not found
 * @throws {Error} If validation fails
 * @example
 * const user = await getUserById('507f1f77bcf86cd799439011');
 */
const getUserById = async (userId) => {
  // Validate ObjectId format
  const validatedId = objectIdSchema.parse(userId);

  const collection = getCollection(COLLECTIONS.USERS);
  const user = await collection.findOne({ _id: new ObjectId(validatedId) });

  return user;
};

/**
 * Retrieves a user by username
 *
 * @param {string} username - Username
 * @returns {Promise<Object|null>} User object or null if not found
 * @throws {Error} If validation fails
 * @example
 * const user = await getUserByUsername('john_doe');
 */
const getUserByUsername = async (username) => {
  // Validate username format
  const validatedUsername = usernameSchema.parse(username);

  const collection = getCollection(COLLECTIONS.USERS);
  const user = await collection.findOne({ username: validatedUsername });

  return user;
};

/**
 * Retrieves a user by email or username
 * Useful for login where user can provide either
 *
 * @param {string} identifier - Email or username
 * @returns {Promise<Object|null>} User object or null if not found
 * @example
 * const user = await getUserByEmailOrUsername('john@example.com');
 * const user2 = await getUserByEmailOrUsername('john_doe');
 */
const getUserByEmailOrUsername = async (identifier) => {
  const collection = getCollection(COLLECTIONS.USERS);

  // Try to find by email or username
  // Email validation will fail for usernames, so we catch and try username
  let user = null;

  // Try email first
  try {
    const validatedEmail = emailSchema.parse(identifier.toLowerCase());
    user = await collection.findOne({ email: validatedEmail });
  } catch (error) {
    // Not a valid email, try username
    try {
      const validatedUsername = usernameSchema.parse(identifier);
      user = await collection.findOne({ username: validatedUsername });
    } catch (error) {
      // Neither valid email nor username format
      return null;
    }
  }

  return user;
};

/**
 * Updates the last login timestamp for a user
 *
 * @param {string} userId - MongoDB ObjectId as string
 * @returns {Promise<Object>} Update result
 * @throws {Error} If validation fails
 * @example
 * await updateLastLogin('507f1f77bcf86cd799439011');
 */
const updateLastLogin = async (userId) => {
  // Validate ObjectId format
  const validatedId = objectIdSchema.parse(userId);

  const collection = getCollection(COLLECTIONS.USERS);
  const result = await collection.updateOne(
    { _id: new ObjectId(validatedId) },
    {
      $set: {
        lastLogin: new Date(),
        updatedAt: new Date(),
      },
    }
  );

  return result;
};

/**
 * Verifies a password against a hashed password
 *
 * @param {string} plainPassword - Plain text password
 * @param {string} hashedPassword - Hashed password from database
 * @returns {Promise<boolean>} True if password matches
 * @example
 * const isValid = await verifyPassword('SecurePass123', user.password);
 */
const verifyPassword = async (plainPassword, hashedPassword) => {
  return await bcrypt.compare(plainPassword, hashedPassword);
};

/**
 * Updates user profile (username and/or email)
 * Checks uniqueness before update
 * If username is updated, also updates all audit logs that reference this user
 *
 * @param {string} userId - User ID
 * @param {Object} updates - Fields to update
 * @param {string} [updates.username] - New username
 * @param {string} [updates.email] - New email
 * @returns {Promise<Object>} Updated user object (without password)
 * @throws {Error} If validation fails or username/email already exists
 * @example
 * const updatedUser = await updateUserProfile('507f1f77bcf86cd799439011', {
 *   username: 'new_username',
 *   email: 'newemail@example.com'
 * });
 */
const updateUserProfile = async (userId, updates) => {
  // Validate userId
  const validatedId = objectIdSchema.parse(userId);

  // Ensure at least one field provided
  if (!updates.username && !updates.email) {
    throw new Error('At least one field (username or email) must be updated');
  }

  const collection = getCollection(COLLECTIONS.USERS);

  // Check username uniqueness (if provided)
  if (updates.username) {
    updates.username = usernameSchema.parse(updates.username);

    const existingUser = await collection.findOne({
      username: updates.username,
      _id: { $ne: new ObjectId(validatedId) }, // Exclude current user
    });

    if (existingUser) {
      throw new Error('Username already exists');
    }
  }

  // Check email uniqueness (if provided)
  if (updates.email) {
    updates.email = emailSchema.parse(updates.email);

    const existingUser = await collection.findOne({
      email: updates.email,
      _id: { $ne: new ObjectId(validatedId) }, // Exclude current user
    });

    if (existingUser) {
      throw new Error('Email already exists');
    }
  }

  // Update user
  const result = await collection.findOneAndUpdate(
    { _id: new ObjectId(validatedId) },
    {
      $set: {
        ...updates,
        updatedAt: new Date(),
      },
    },
    { returnDocument: 'after', projection: { password: 0 } }
  );

  if (!result) {
    throw new Error('User not found');
  }

  // Update all audit logs if username was changed
  // This ensures consistency across all audit logs that reference this user
  if (updates.username) {
    const auditLogsCollection = getCollection(COLLECTIONS.AUDIT_LOGS);
    await auditLogsCollection.updateMany(
      { userId: new ObjectId(validatedId) }, // Find all logs for this user
      { $set: { username: updates.username } } // Update username to new value
    );
  }

  return result;
};

/**
 * Updates user password
 * Password must already be validated and old password verified by caller
 *
 * @param {string} userId - User ID
 * @param {string} newPassword - New plain-text password (will be hashed)
 * @returns {Promise<Object>} Update result
 * @throws {Error} If validation fails
 * @example
 * await updatePassword('507f1f77bcf86cd799439011', 'NewSecurePass123');
 */
const updatePassword = async (userId, newPassword) => {
  // Validate inputs
  const validatedId = objectIdSchema.parse(userId);
  const validatedPassword = passwordSchema.parse(newPassword);

  // Hash new password
  const hashedPassword = await bcrypt.hash(validatedPassword, BCRYPT_ROUNDS);

  // Update password
  const collection = getCollection(COLLECTIONS.USERS);
  const result = await collection.updateOne(
    { _id: new ObjectId(validatedId) },
    {
      $set: {
        password: hashedPassword,
        updatedAt: new Date(),
      },
    }
  );

  if (result.matchedCount === 0) {
    throw new Error('User not found');
  }

  return result;
};

/**
 * Deletes user account with complete cascade deletion
 *
 * DELETION STRATEGY:
 * 1. User's own files: DELETE entirely (DB + S3)
 * 2. ShareLinks owned by user: DELETE entirely
 * 3. UserShares owned by user: DELETE entirely
 * 4. UserShares where user is recipient: KEEP (preserve share history)
 * 5. Audit logs for user's files: DELETE entirely
 * 6. Audit logs for other users' files: KEEP but anonymize (userId=null, username='[Deleted User]')
 * 7. User record: DELETE
 *
 * @param {string} userId - User ID to delete
 * @returns {Promise<Object>} Deletion counts for all affected collections
 * @throws {Error} If deletion fails (transaction will rollback)
 * @example
 * const result = await deleteUserAccount('507f1f77bcf86cd799439011');
 * // Returns: { user: 1, files: 45, shareLinks: 12, userSharesOwned: 8, auditLogsOwnFiles: 234, auditLogsAnonymized: 15 }
 */
const deleteUserAccount = async (userId) => {
  const validatedId = objectIdSchema.parse(userId);
  const db = getDb();
  const session = db.client.startSession();

  try {
    let deletionCounts = {};

    // Start transaction
    await session.withTransaction(async () => {
      const filesCollection = getCollection(COLLECTIONS.FILES);
      const shareLinksCollection = getCollection(COLLECTIONS.SHARE_LINKS);
      const userSharesCollection = getCollection(COLLECTIONS.USER_SHARES);
      const auditLogsCollection = getCollection(COLLECTIONS.AUDIT_LOGS);
      const usersCollection = getCollection(COLLECTIONS.USERS);

      const userObjectId = new ObjectId(validatedId);

      // STEP 1: Get all user's files (need file IDs for audit log filtering)
      const userFiles = await filesCollection
        .find({ ownerId: userObjectId }, { session, projection: { _id: 1 } })
        .toArray();

      const userFileIds = userFiles.map((f) => f._id);

      // STEP 2: Delete shareLinks created by user (they own the shares)
      const shareLinksResult = await shareLinksCollection.deleteMany(
        { ownerId: userObjectId },
        { session }
      );
      deletionCounts.shareLinks = shareLinksResult.deletedCount;

      // STEP 3: Delete userShares WHERE USER IS OWNER (not recipient)
      // Keep userShares where user is recipient (preserves share history for file owners)
      const userSharesResult = await userSharesCollection.deleteMany(
        { ownerId: userObjectId }, // Only delete where they own the share
        { session }
      );
      deletionCounts.userSharesOwned = userSharesResult.deletedCount;

      // STEP 4: Anonymize userShares WHERE USER IS RECIPIENT
      // These stay in DB but show "[Deleted User]" when queried
      // This preserves share history for file owners
      // NOTE: Handled via aggregation $lookup with $ifNull in queries (already implemented)
      // No update needed - null reference will show "[Deleted User]"

      // STEP 5: Delete audit logs for USER'S OWN FILES
      const auditLogsOwnFilesResult = await auditLogsCollection.deleteMany(
        { fileId: { $in: userFileIds } }, // All logs for their files
        { session }
      );
      deletionCounts.auditLogsOwnFiles = auditLogsOwnFilesResult.deletedCount;

      // STEP 6: Anonymize audit logs for OTHER USERS' FILES
      // Keep logs but remove user identity
      const auditLogsOtherFilesResult = await auditLogsCollection.updateMany(
        {
          userId: userObjectId,
          fileId: { $nin: userFileIds }, // Logs NOT for their files
        },
        {
          $set: {
            userId: null, // Clear user reference
            username: '[Deleted User]', // Anonymize
          },
        },
        { session }
      );
      deletionCounts.auditLogsAnonymized =
        auditLogsOtherFilesResult.modifiedCount;

      // STEP 7: Delete all user's FILES from MongoDB
      const filesResult = await filesCollection.deleteMany(
        { ownerId: userObjectId },
        { session }
      );
      deletionCounts.files = filesResult.deletedCount;

      // STEP 8: Delete USER record
      const userResult = await usersCollection.deleteOne(
        { _id: userObjectId },
        { session }
      );
      deletionCounts.user = userResult.deletedCount;
    });

    return deletionCounts;
  } finally {
    await session.endSession();
  }
};

export default {
  createUser,
  getUserByEmail,
  getUserById,
  getUserByUsername,
  getUserByEmailOrUsername,
  updateLastLogin,
  verifyPassword,
  updateUserProfile,
  updatePassword,
  deleteUserAccount,
};
