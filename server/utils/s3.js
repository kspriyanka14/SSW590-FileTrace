import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'crypto';

/**
 * Lazy-loaded S3 client
 * Created only when first used to ensure env vars are loaded
 */
let s3Client = null;

/**
 * Get or create S3 client instance
 */
const getS3Client = () => {
  if (!s3Client) {
    s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });
  }
  return s3Client;
};

const getBucketName = () => process.env.S3_BUCKET_NAME;

/**
 * Uploads a file buffer to S3 with server-side encryption
 *
 * @param {Buffer} fileBuffer - File data as buffer
 * @param {string} userId - User ID for organizing files
 * @param {string} originalFilename - Original filename
 * @param {string} mimetype - File MIME type
 * @returns {Promise<Object>} Object containing s3Key
 * @throws {Error} If upload fails
 * @example
 * const result = await uploadToS3(buffer, 'userId123', 'document.pdf', 'application/pdf');
 */
export const uploadToS3 = async (
  fileBuffer,
  userId,
  originalFilename,
  mimetype
) => {
  // Generate unique S3 key
  const uniqueId = crypto.randomBytes(16).toString('hex');
  const sanitizedFilename = originalFilename.replace(/[^a-zA-Z0-9.-]/g, '_');
  const s3Key = `${userId}/${uniqueId}-${sanitizedFilename}`;

  const command = new PutObjectCommand({
    Bucket: getBucketName(),
    Key: s3Key,
    Body: fileBuffer,
    ContentType: mimetype,
    ServerSideEncryption: 'AES256',
  });

  await getS3Client().send(command);

  return { s3Key };
};

/**
 * Generates a pre-signed URL for downloading a file from S3
 *
 * @param {string} s3Key - S3 object key
 * @param {string} filename - Filename for download (Content-Disposition header)
 * @param {number} [expiresIn=3600] - URL expiration in seconds (default: 1 hour)
 * @returns {Promise<string>} Pre-signed download URL
 * @throws {Error} If URL generation fails
 * @example
 * const url = await getDownloadUrl('userId/file.pdf', 'document.pdf', 3600);
 */
export const getDownloadUrl = async (s3Key, filename, expiresIn = 3600) => {
  const command = new GetObjectCommand({
    Bucket: getBucketName(),
    Key: s3Key,
    ResponseContentDisposition: `attachment; filename="${encodeURIComponent(
      filename
    )}"`,
  });

  const url = await getSignedUrl(getS3Client(), command, { expiresIn });

  return url;
};

/**
 * Deletes a file from S3
 *
 * @param {string} s3Key - S3 object key
 * @returns {Promise<void>}
 * @throws {Error} If deletion fails
 * @example
 * await deleteFromS3('userId/file.pdf');
 */
export const deleteFromS3 = async (s3Key) => {
  const command = new DeleteObjectCommand({
    Bucket: getBucketName(),
    Key: s3Key,
  });

  await getS3Client().send(command);
};

/**
 * Checks S3 bucket accessibility
 *
 * @returns {Promise<boolean>} True if bucket is accessible
 * @throws {Error} If bucket is not accessible
 * @example
 * const isAccessible = await checkS3Connectivity();
 */
export const checkS3Connectivity = async () => {
  const command = new HeadBucketCommand({
    Bucket: getBucketName(),
  });

  await getS3Client().send(command);
  return true;
};

/**
 * Deletes all S3 objects for a specific user
 * Handles pagination for users with > 1000 files
 *
 * @param {string} userId - User ID (used as S3 prefix)
 * @returns {Promise<Object>} Deletion results with counts
 * @throws {Error} If S3 deletion fails
 * @example
 * const result = await deleteAllUserFilesFromS3('userId123');
 * // Returns: { deletedCount: 45, errors: null, success: true }
 */
export const deleteAllUserFilesFromS3 = async (userId) => {
  let totalDeleted = 0;
  let errors = [];
  let continuationToken = null;

  try {
    // Iterate through all pages (1000 objects per page)
    do {
      // STEP 1: List objects with user prefix
      const listCommand = new ListObjectsV2Command({
        Bucket: getBucketName(),
        Prefix: `${userId}/`, // All files start with userId/
        MaxKeys: 1000,
        ContinuationToken: continuationToken,
      });

      const listResponse = await getS3Client().send(listCommand);

      // No objects found
      if (!listResponse.Contents || listResponse.Contents.length === 0) {
        break;
      }

      // STEP 2: Prepare delete request (max 1000 objects)
      const objectsToDelete = listResponse.Contents.map((obj) => ({
        Key: obj.Key,
      }));

      // STEP 3: Batch delete
      const deleteCommand = new DeleteObjectsCommand({
        Bucket: getBucketName(),
        Delete: {
          Objects: objectsToDelete,
          Quiet: false, // Return errors if any
        },
      });

      const deleteResponse = await getS3Client().send(deleteCommand);

      // Track results
      totalDeleted += deleteResponse.Deleted?.length || 0;

      if (deleteResponse.Errors && deleteResponse.Errors.length > 0) {
        errors.push(...deleteResponse.Errors);
      }

      // Check for more pages
      continuationToken = listResponse.NextContinuationToken;
    } while (continuationToken);

    // Return results
    return {
      deletedCount: totalDeleted,
      errors: errors.length > 0 ? errors : null,
      success: errors.length === 0,
    };
  } catch (error) {
    console.error('S3 bulk deletion error:', error);
    throw new Error(`Failed to delete files from S3: ${error.message}`);
  }
};
