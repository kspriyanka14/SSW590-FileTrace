import { config } from 'dotenv';
import {
  connectToDb,
  getCollection,
  COLLECTIONS,
  closeConnection,
} from './index.js';

// Load environment variables
config();

/**
 * Creates all necessary database indexes for optimal performance
 */
const createIndexes = async () => {
  try {
    console.log('Creating database indexes...');

    await connectToDb();

    // Users collection indexes
    const usersCollection = getCollection(COLLECTIONS.USERS);
    await usersCollection.createIndex({ email: 1 }, { unique: true });
    await usersCollection.createIndex({ username: 1 }, { unique: true });
    console.log('Users indexes created');

    // Files collection indexes
    const filesCollection = getCollection(COLLECTIONS.FILES);
    await filesCollection.createIndex({ ownerId: 1 });
    await filesCollection.createIndex({ ownerId: 1, category: 1 });
    await filesCollection.createIndex({ ownerId: 1, uploadedAt: -1 });
    console.log('Files indexes created');

    // ShareLinks collection indexes
    const shareLinksCollection = getCollection(COLLECTIONS.SHARE_LINKS);
    await shareLinksCollection.createIndex({ token: 1 }, { unique: true });
    await shareLinksCollection.createIndex({ fileId: 1 });
    await shareLinksCollection.createIndex({ ownerId: 1 });
    console.log('ShareLinks indexes created');

    // UserShares collection indexes
    const userSharesCollection = getCollection(COLLECTIONS.USER_SHARES);
    await userSharesCollection.createIndex({ recipientId: 1, fileId: 1 });
    await userSharesCollection.createIndex({ fileId: 1 });
    await userSharesCollection.createIndex({ ownerId: 1 });
    console.log('UserShares indexes created');

    // AuditLogs collection indexes
    const auditLogsCollection = getCollection(COLLECTIONS.AUDIT_LOGS);
    await auditLogsCollection.createIndex({ fileId: 1, timestamp: -1 });
    await auditLogsCollection.createIndex({ action: 1 });
    console.log('AuditLogs indexes created');

    console.log('All database indexes created successfully');
  } catch (error) {
    console.error('Error creating indexes:', error);
    process.exit(1);
  } finally {
    await closeConnection();
  }
};

// Run if executed directly
createIndexes();

export default createIndexes;
