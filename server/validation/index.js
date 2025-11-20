import { z } from 'zod';
import { ObjectId } from 'mongodb';

/**
 * Custom Zod Validators
 * These validators are reused across different schemas
 */

/**
 * Validates MongoDB ObjectId format
 */
const objectIdSchema = z.string().refine((value) => ObjectId.isValid(value), {
  message: 'Invalid ObjectId format',
});

/**
 * Validates email format with additional constraints
 */
const emailSchema = z
  .string()
  .email('Invalid email format')
  .min(5, 'Email must be at least 5 characters')
  .max(255, 'Email must not exceed 255 characters')
  .trim()
  .toLowerCase();

/**
 * Validates username format
 * 3-30 characters, alphanumeric with underscores and hyphens
 */
const usernameSchema = z
  .string()
  .min(3, 'Username must be at least 3 characters')
  .max(30, 'Username must not exceed 30 characters')
  .regex(
    /^[a-zA-Z0-9_-]+$/,
    'Username can only contain letters, numbers, underscores, and hyphens'
  )
  .trim();

/**
 * Validates password strength
 * Minimum 8 characters, must contain lowercase, uppercase, and number
 */
const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(100, 'Password must not exceed 100 characters')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

/**
 * Validates filename format
 * 1-255 characters, no special characters that are invalid in file systems
 */
const filenameSchema = z
  .string()
  .min(1, 'Filename must not be empty')
  .max(255, 'Filename must not exceed 255 characters')
  .refine(
    (value) => !/[<>:"/\\|?*\x00-\x1F]/.test(value),
    'Filename contains invalid characters'
  );

/**
 * Validates file category
 */
const categorySchema = z.enum(['Personal', 'Work', 'Documents', 'Archive'], {
  errorMap: () => ({
    message: 'Category must be one of: Personal, Work, Documents, Archive',
  }),
});

/**
 * Validates positive integers
 */
const positiveIntSchema = z
  .number()
  .int('Must be an integer')
  .positive('Must be a positive number')
  .finite('Must be a finite number');

/**
 * Validates non-negative integers
 */
const nonNegativeIntSchema = z
  .number()
  .int('Must be an integer')
  .nonnegative('Must be a non-negative number')
  .finite('Must be a finite number');

/**
 * ========================================
 * USER SCHEMAS
 * ========================================
 */

/**
 * User registration schema
 */
const registerSchema = z
  .object({
    username: usernameSchema,
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

/**
 * User login schema
 */
const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

/**
 * ========================================
 * FILE SCHEMAS
 * ========================================
 */

/**
 * File upload schema
 */
const uploadFileSchema = z.object({
  filename: filenameSchema,
  description: z
    .string()
    .trim() // Trim whitespace from start and end
    .max(
      250,
      'Description must not exceed 250 characters (after trimming whitespace)'
    )
    .optional(),
  category: categorySchema,
  size: positiveIntSchema,
  mimetype: z.string().min(1, 'MIME type is required'),
});

/**
 * File rename schema
 */
const renameFileSchema = z.object({
  filename: filenameSchema,
});

/**
 * File category move schema
 */
const moveFileCategorySchema = z.object({
  category: categorySchema,
});

/**
 * File ID parameter schema
 */
const fileIdSchema = z.object({
  fileId: objectIdSchema,
});

/**
 * Category parameter schema
 */
const categoryParamSchema = z.object({
  category: categorySchema,
});

/**
 * ========================================
 * SHARE SCHEMAS
 * ========================================
 */

/**
 * Create share schema
 * Validates both user shares and link shares
 * At least one expiration method (time or count) is required
 * Expiration time is in minutes (min: 10, max: 525960 = 1 year)
 */
const createShareSchema = z
  .object({
    fileId: objectIdSchema,
    shareType: z.enum(['user', 'link'], {
      errorMap: () => ({
        message: 'Share type must be either "user" or "link"',
      }),
    }),
    recipientIdentifier: z.string().optional(), // username or email
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
    {
      message:
        'At least one expiration method (expirationMinutes or maxAccessCount) must be specified',
      path: ['expirationMinutes'],
    }
  )
  .refine(
    (data) => {
      if (data.shareType === 'user') {
        return (
          data.recipientIdentifier !== undefined &&
          data.recipientIdentifier.trim().length > 0
        );
      }
      return true;
    },
    {
      message:
        'Recipient identifier (username or email) is required when sharing with a user',
      path: ['recipientIdentifier'],
    }
  );

/**
 * Share token parameter schema
 */
const shareTokenSchema = z.object({
  token: z
    .string()
    .length(64, 'Token must be 64 characters')
    .regex(
      /^[a-f0-9]{64}$/,
      'Token must be a valid 64-character hexadecimal string'
    ),
});

/**
 * ========================================
 * AUDIT SCHEMAS
 * ========================================
 */

/**
 * Action types for audit logs
 */
const auditActionSchema = z.enum([
  'UPLOAD',
  'DOWNLOAD',
  'NAME_CHANGE',
  'CATEGORY_CHANGE',
  'DELETE',
  'SHARE_CREATED',
  'SHARE_ACCESSED',
  'EXPIRED_LINK_ATTEMPT',
  'SHARE_REVOKED',
  'SHARES_REVOKED_ALL',
]);

/**
 * Create audit log schema
 */
const createAuditLogSchema = z.object({
  fileId: objectIdSchema.nullable(), // Nullable for expired link attempts
  action: auditActionSchema,
  userId: objectIdSchema.optional(),
  username: z.string().optional(),
  ipAddress: z.string().optional(),
  location: z.string().optional(),
  details: z.record(z.any()).optional(), // Flexible object for action-specific details
});

/**
 * ========================================
 * QUERY SCHEMAS
 * ========================================
 */

/**
 * Search and filter query schema
 */
const searchQuerySchema = z.object({
  search: z.string().optional(),
  sortBy: z
    .enum(['uploadDate', 'accessDate', 'filename', 'fileType'])
    .optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  fileType: z.string().optional(), // MIME type filter
});

/**
 * ========================================
 * USER PROFILE MANAGEMENT SCHEMAS
 * ========================================
 */

/**
 * Update user profile schema
 * Validates username/email updates with current password verification
 */
const updateProfileSchema = z
  .object({
    username: usernameSchema.optional(),
    email: emailSchema.optional(),
    currentPassword: z.string().min(1, 'Current password is required'),
  })
  .refine((data) => data.username !== undefined || data.email !== undefined, {
    message: 'At least one field (username or email) must be updated',
    path: ['username'],
  });

/**
 * Change password schema
 * Validates password change with confirmation
 */
const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: passwordSchema,
    confirmNewPassword: z.string().min(1, 'Password confirmation is required'),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: 'Passwords do not match',
    path: ['confirmNewPassword'],
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: 'New password must be different from current password',
    path: ['newPassword'],
  });

/**
 * Delete account schema
 * Requires password and explicit "DELETE" confirmation
 */
const deleteAccountSchema = z.object({
  password: z.string().min(1, 'Password is required'),
  confirmation: z.string().refine((val) => val === 'DELETE', {
    message: 'Please type DELETE to confirm account deletion',
  }),
});

/**
 * ========================================
 * EXPORTED SCHEMAS
 * ========================================
 */

export {
  // Custom validators
  objectIdSchema,
  emailSchema,
  usernameSchema,
  passwordSchema,
  filenameSchema,
  categorySchema,
  positiveIntSchema,
  nonNegativeIntSchema,

  // User schemas
  registerSchema,
  loginSchema,
  updateProfileSchema,
  changePasswordSchema,
  deleteAccountSchema,

  // File schemas
  uploadFileSchema,
  renameFileSchema,
  moveFileCategorySchema,
  fileIdSchema,
  categoryParamSchema,

  // Share schemas
  createShareSchema,
  shareTokenSchema,

  // Audit schemas
  auditActionSchema,
  createAuditLogSchema,

  // Query schemas
  searchQuerySchema,
};
