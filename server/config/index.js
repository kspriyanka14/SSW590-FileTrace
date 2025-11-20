import { connectToDb, getDb, closeConnection } from './mongoConnection.js';

/**
 * Collection names used in the application
 * Centralized to ensure consistency
 */
const COLLECTIONS = {
  USERS: 'users',
  FILES: 'files',
  SHARE_LINKS: 'shareLinks',
  USER_SHARES: 'userShares',
  AUDIT_LOGS: 'auditLogs',
};

/**
 * Get a specific collection from the database
 *
 * @param {string} collectionName - Name of the collection
 * @returns {Collection} MongoDB collection instance
 * @throws {Error} If database is not initialized
 * @example
 * const usersCollection = getCollection(COLLECTIONS.USERS);
 */
const getCollection = (collectionName) => {
  return getDb().collection(collectionName);
};

export { connectToDb, getDb, closeConnection, getCollection, COLLECTIONS };
