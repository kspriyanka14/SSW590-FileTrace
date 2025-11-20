import { ObjectId } from 'mongodb';
import { getCollection, COLLECTIONS } from '../config/index.js';
import { createAuditLogSchema, objectIdSchema } from '../validation/index.js';

/**
 * Creates a new audit log entry
 *
 * @param {Object} auditData - Audit log data
 * @param {string} auditData.fileId - File ID (nullable for expired link attempts)
 * @param {string} auditData.action - Action type
 * @param {string} [auditData.userId] - User ID (optional)
 * @param {string} [auditData.username] - Username (optional)
 * @param {string} [auditData.ipAddress] - IP address (optional)
 * @param {string} [auditData.location] - Geographic location (optional)
 * @param {Object} [auditData.details] - Action-specific details (optional)
 * @returns {Promise<Object>} Created audit log object
 * @throws {Error} If validation fails
 */
const createAuditLog = async (auditData) => {
  const validatedData = createAuditLogSchema.parse(auditData);

  const collection = getCollection(COLLECTIONS.AUDIT_LOGS);

  const newAuditLog = {
    fileId: validatedData.fileId ? new ObjectId(validatedData.fileId) : null,
    action: validatedData.action,
    userId: validatedData.userId
      ? new ObjectId(validatedData.userId)
      : undefined,
    username: validatedData.username,
    ipAddress: validatedData.ipAddress,
    location: validatedData.location,
    details: validatedData.details,
    timestamp: new Date(),
  };

  // Remove undefined fields
  if (newAuditLog.userId === undefined) delete newAuditLog.userId;
  if (newAuditLog.username === undefined) delete newAuditLog.username;
  if (newAuditLog.ipAddress === undefined) delete newAuditLog.ipAddress;
  if (newAuditLog.location === undefined) delete newAuditLog.location;
  if (newAuditLog.details === undefined) delete newAuditLog.details;

  const result = await collection.insertOne(newAuditLog);

  return { ...newAuditLog, _id: result.insertedId };
};

/**
 * Retrieves all audit logs for a specific file
 *
 * @param {string} fileId - File ID
 * @returns {Promise<Array>} Array of audit log objects sorted by timestamp (newest first)
 * @throws {Error} If validation fails
 */
const getAuditLogsByFile = async (fileId) => {
  const validatedId = objectIdSchema.parse(fileId);

  const collection = getCollection(COLLECTIONS.AUDIT_LOGS);
  const logs = await collection
    .find({ fileId: new ObjectId(validatedId) })
    .sort({ timestamp: -1 })
    .toArray();

  return logs;
};

/**
 * Retrieves audit logs by action type
 *
 * @param {string} action - Action type
 * @returns {Promise<Array>} Array of audit log objects
 */
const getAuditLogsByAction = async (action) => {
  const collection = getCollection(COLLECTIONS.AUDIT_LOGS);
  const logs = await collection
    .find({ action })
    .sort({ timestamp: -1 })
    .toArray();

  return logs;
};

export default {
  createAuditLog,
  getAuditLogsByFile,
  getAuditLogsByAction,
};
