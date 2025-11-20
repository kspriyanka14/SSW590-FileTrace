import { MongoClient } from 'mongodb';

/**
 * MongoDB connection singleton
 * Maintains a single connection instance across the application
 * with connection pooling for optimal performance
 */

let _connection = undefined;
let _db = undefined;

/**
 * Establishes connection to MongoDB database
 * Uses connection pooling with optimized settings
 *
 * @returns {Promise<Db>} MongoDB database instance
 * @throws {Error} If connection fails or environment variables are missing
 * @example
 * const db = await connectToDb();
 */
const connectToDb = async () => {
  if (!_connection) {
    const mongoUri = process.env.MONGODB_URI;
    const dbName = process.env.DB_NAME;

    if (!mongoUri) {
      throw new Error('MONGODB_URI environment variable is not set');
    }

    if (!dbName) {
      throw new Error('DB_NAME environment variable is not set');
    }

    try {
      _connection = await MongoClient.connect(mongoUri, {
        maxPoolSize: 100, // Maximum number of connections in the pool
        minPoolSize: 2, // Minimum number of connections to maintain
        serverSelectionTimeoutMS: 5000, // Timeout for server selection
        socketTimeoutMS: 45000, // Timeout for socket operations
        family: 4, // Use IPv4, skip trying IPv6
      });

      _db = _connection.db(dbName);

      console.log(`Connected to MongoDB database: ${dbName}`);
    } catch (error) {
      console.error('MongoDB connection error:', error);
      throw new Error(`Failed to connect to MongoDB: ${error.message}`);
    }
  }

  return _db;
};

/**
 * Returns the database instance
 * Must be called after connectToDb()
 *
 * @returns {Db} MongoDB database instance
 * @throws {Error} If database is not initialized
 * @example
 * const db = getDb();
 * const collection = db.collection('users');
 */
const getDb = () => {
  if (!_db) {
    throw new Error('Database not initialized. Call connectToDb() first.');
  }
  return _db;
};

/**
 * Closes the MongoDB connection
 * Should be called when the application shuts down
 *
 * @returns {Promise<void>}
 * @example
 * await closeConnection();
 */
const closeConnection = async () => {
  if (_connection) {
    await _connection.close();
    _connection = undefined;
    _db = undefined;
    console.log('MongoDB connection closed');
  }
};

export { connectToDb, getDb, closeConnection };
