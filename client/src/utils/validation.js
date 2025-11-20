/**
 * Client-Side Validation Schemas
 * Zod schemas for form validation (matches backend validation)
 */

import { z } from 'zod';

/**
 * Password Validation Schema
 * Must match backend requirements exactly
 */
const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(100, 'Password must not exceed 100 characters')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

/**
 * Username Validation Schema
 */
const usernameSchema = z
  .string()
  .trim()
  .min(3, 'Username must be at least 3 characters')
  .max(30, 'Username must not exceed 30 characters')
  .regex(
    /^[a-zA-Z0-9_-]+$/,
    'Username can only contain letters, numbers, underscores, and hyphens'
  );

/**
 * Email Validation Schema
 */
const emailSchema = z
  .string()
  .email('Please enter a valid email address')
  .trim()
  .toLowerCase()
  .min(5, 'Email must be at least 5 characters')
  .max(255, 'Email must not exceed 255 characters');

/**
 * File Categories Enum
 */
export const FILE_CATEGORIES = ['Personal', 'Work', 'Documents', 'Archive'];

/**
 * Register Form Validation Schema
 */
export const registerSchema = z
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
 * Login Form Validation Schema
 */
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

/**
 * File Upload Validation Schema
 */
export const uploadFileSchema = z.object({
  filename: z
    .string()
    .trim()
    .min(1, 'Filename cannot be empty')
    .max(255, 'Filename must not exceed 255 characters')
    .refine(
      (val) => !/[<>:"/\\|?*]/.test(val),
      'Filename contains invalid characters'
    ),
  description: z
    .string()
    .trim()
    .max(250, 'Description must not exceed 250 characters')
    .optional()
    .or(z.literal('')),
  category: z.enum(FILE_CATEGORIES, {
    errorMap: () => ({ message: 'Please select a valid category' }),
  }),
  file: z
    .instanceof(File, { message: 'Please select a file' })
    .refine((file) => file.size > 0, 'File cannot be empty')
    .refine(
      (file) => file.size <= 10 * 1024 * 1024, // 10MB
      'File size must be less than 10MB'
    ),
});

/**
 * File Rename Validation Schema
 */
export const renameFileSchema = z.object({
  filename: z
    .string()
    .trim()
    .min(1, 'Filename cannot be empty')
    .max(255, 'Filename must not exceed 255 characters')
    .refine(
      (val) => !/[<>:"/\\|?*]/.test(val),
      'Filename contains invalid characters'
    ),
});

/**
 * Share Creation Validation Schema
 * Supports both user shares and public links
 * Expiration time is in minutes (min: 10, max: 525960 = 1 year)
 */
export const shareSchema = z
  .object({
    shareType: z.enum(['user', 'link'], {
      errorMap: () => ({ message: 'Please select a share type' }),
    }),
    recipientIdentifier: z.string().trim().optional().or(z.literal('')),
    expirationMinutes: z
      .number({ invalid_type_error: 'Must be a number' })
      .int('Must be a whole number')
      .min(10, 'Minimum 10 minutes')
      .max(525960, 'Maximum 1 year (525960 minutes)')
      .optional()
      .or(z.literal('')),
    maxAccessCount: z
      .number({ invalid_type_error: 'Must be a number' })
      .int('Must be a whole number')
      .positive('Must be greater than 0')
      .optional()
      .or(z.literal('')),
  })
  .refine(
    (data) => {
      // At least one expiration method must be provided
      const hasExpiration =
        data.expirationMinutes && data.expirationMinutes >= 10;
      const hasMaxAccess = data.maxAccessCount && data.maxAccessCount > 0;
      return hasExpiration || hasMaxAccess;
    },
    {
      message:
        'Please provide either an expiration time or maximum access count',
      path: ['expirationMinutes'],
    }
  )
  .refine(
    (data) => {
      // User shares must have a recipient
      if (data.shareType === 'user') {
        return data.recipientIdentifier && data.recipientIdentifier.length > 0;
      }
      return true;
    },
    {
      message: 'Recipient username or email is required for user shares',
      path: ['recipientIdentifier'],
    }
  );

/**
 * Search/Filter Validation Schema
 */
export const searchFilterSchema = z.object({
  search: z.string().trim().max(100, 'Search query too long').optional(),
  sortBy: z
    .enum(['uploadDate', 'accessDate', 'filename', 'fileType', 'size'])
    .optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  fileType: z.string().trim().max(50, 'File type too long').optional(),
});

/**
 * ========================================
 * USER PROFILE MANAGEMENT SCHEMAS
 * ========================================
 */

/**
 * Update Profile Schema
 * Validates username/email updates with current password verification
 */
export const updateProfileSchema = z
  .object({
    username: usernameSchema.optional(),
    email: emailSchema.optional(),
    currentPassword: z.string().min(1, 'Current password is required'),
  })
  .refine((data) => data.username || data.email, {
    message: 'At least one field (username or email) must be updated',
    path: ['username'],
  });

/**
 * Change Password Schema
 * Validates password change with confirmation
 */
export const changePasswordSchema = z
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
 * Delete Account Schema
 * Requires password and explicit "DELETE" confirmation
 */
export const deleteAccountSchema = z.object({
  password: z.string().min(1, 'Password is required'),
  confirmation: z.string().refine((val) => val === 'DELETE', {
    message: 'Please type DELETE to confirm account deletion',
  }),
});

/**
 * Utility: Extract validation errors from Zod error
 * @param {z.ZodError} error - Zod validation error
 * @returns {Object} Field errors object { fieldName: errorMessage }
 */
export const extractValidationErrors = (error) => {
  const fieldErrors = {};

  // Check if it's a ZodError with issues array
  const errorList = error.issues || error.errors || [];

  errorList.forEach((err) => {
    const path = err.path[0];
    if (path && !fieldErrors[path]) {
      fieldErrors[path] = err.message;
    }
  });

  return fieldErrors;
};

/**
 * Utility: Validate form data with a schema
 * @param {z.Schema} schema - Zod schema to validate against
 * @param {Object} data - Form data to validate
 * @returns {Object} { success: boolean, errors: {}, data: {} }
 */
export const validateForm = (schema, data) => {
  try {
    const validatedData = schema.parse(data);
    return {
      success: true,
      errors: {},
      data: validatedData,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        errors: extractValidationErrors(error),
        data: null,
      };
    }
    throw error;
  }
};

/**
 * Utility: Safe parse with error extraction
 * @param {z.Schema} schema - Zod schema
 * @param {Object} data - Data to validate
 * @returns {Object} { success, data, errors }
 */
export const safeParse = (schema, data) => {
  const result = schema.safeParse(data);

  if (result.success) {
    return {
      success: true,
      data: result.data,
      errors: {},
    };
  }

  return {
    success: false,
    data: null,
    errors: extractValidationErrors(result.error),
  };
};
