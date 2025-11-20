import express from 'express';
import jwt from 'jsonwebtoken';
import { usersData, filesData } from '../data/index.js';
import { auth } from '../middleware/index.js';
import {
  registerSchema,
  loginSchema,
  updateProfileSchema,
  changePasswordSchema,
  deleteAccountSchema,
} from '../validation/index.js';
import { deleteAllUserFilesFromS3 } from '../utils/s3.js';

const router = express.Router();

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post('/register', async (req, res) => {
  try {
    const validatedData = registerSchema.parse(req.body);

    const user = await usersData.createUser({
      username: validatedData.username,
      email: validatedData.email,
      password: validatedData.password,
    });

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
      });
    }

    if (error.message.includes('already exists')) {
      return res.status(409).json({ error: error.message });
    }

    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

/**
 * POST /api/auth/login
 * Login user and return JWT token
 */
router.post('/login', async (req, res) => {
  try {
    const validatedData = loginSchema.parse(req.body);

    const user = await usersData.getUserByEmail(validatedData.email);

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isValidPassword = await usersData.verifyPassword(
      validatedData.password,
      user.password
    );

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Update last login
    await usersData.updateLastLogin(user._id.toString());

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user._id.toString(),
        email: user.email,
        username: user.username,
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
      });
    }

    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

/**
 * GET /api/auth/me
 * Get current authenticated user info
 */
router.get('/me', auth, async (req, res) => {
  try {
    const user = await usersData.getUserById(req.user.userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.status(200).json({
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to retrieve user info' });
  }
});

/**
 * POST /api/auth/logout
 * Logout user (client-side token removal)
 * Note: JWT is stateless, so logout is primarily handled client-side
 * This endpoint confirms the logout action and can be extended for token blacklisting
 */
router.post('/logout', auth, (req, res) => {
  try {
    // Successfully authenticated (token is valid)
    // Client should remove token from storage
    res.status(200).json({
      message: 'Logout successful',
      user: {
        username: req.user.username,
        email: req.user.email,
      },
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

/**
 * PATCH /api/auth/profile
 * Update user profile (username and/or email)
 * Requires current password verification
 */
router.patch('/profile', auth, async (req, res) => {
  try {
    const validatedData = updateProfileSchema.parse(req.body);

    // Get current user
    const user = await usersData.getUserById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    const isValidPassword = await usersData.verifyPassword(
      validatedData.currentPassword,
      user.password
    );

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const updates = {};
    if (validatedData.username) updates.username = validatedData.username;
    if (validatedData.email) updates.email = validatedData.email;

    const updatedUser = await usersData.updateUserProfile(
      req.user.userId,
      updates
    );

    res.status(200).json({
      message: 'Profile updated successfully',
      user: {
        _id: updatedUser._id,
        username: updatedUser.username,
        email: updatedUser.email,
        createdAt: updatedUser.createdAt,
      },
    });
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
      });
    }

    // Handle uniqueness errors
    if (error.message.includes('already exists')) {
      return res.status(409).json({ error: error.message });
    }

    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

/**
 * PATCH /api/auth/password
 * Change user password
 * Requires current password verification
 */
router.patch('/password', auth, async (req, res) => {
  try {
    const validatedData = changePasswordSchema.parse(req.body);

    // Get current user
    const user = await usersData.getUserById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    const isValidPassword = await usersData.verifyPassword(
      validatedData.currentPassword,
      user.password
    );

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    await usersData.updatePassword(req.user.userId, validatedData.newPassword);

    res.status(200).json({
      message: 'Password changed successfully',
    });
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
      });
    }

    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

/**
 * DELETE /api/auth/account
 * Permanently delete user account with cascade deletion
 *
 * DELETION FLOW:
 * 1. Verify password
 * 2. Get all user's files (for S3 keys)
 * 3. Delete from S3 (irreversible)
 * 4. Delete from MongoDB (transaction, with cascade)
 * 5. Return deletion counts
 */
router.delete('/account', auth, async (req, res) => {
  try {
    const validatedData = deleteAccountSchema.parse(req.body);

    const user = await usersData.getUserById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isValidPassword = await usersData.verifyPassword(
      validatedData.password,
      user.password
    );

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Password is incorrect' });
    }

    // Get all user's files
    const userFiles = await filesData.getFilesByOwner(req.user.userId);
    const fileCount = userFiles.length;

    // Delete from S3 FIRST
    let s3Result = { deletedCount: 0, errors: null };

    if (fileCount > 0) {
      try {
        s3Result = await deleteAllUserFilesFromS3(req.user.userId);

        // Log S3 errors but continue (MongoDB deletion more critical)
        if (s3Result.errors) {
          console.error('S3 deletion had errors:', s3Result.errors);
        }
      } catch (s3Error) {
        // Log but don't fail - continue with MongoDB deletion
        console.error('S3 deletion failed:', s3Error);
      }
    }

    const dbResult = await usersData.deleteUserAccount(req.user.userId);

    res.status(200).json({
      message: 'Account deleted successfully',
      deletedRecords: {
        user: dbResult.user,
        files: dbResult.files,
        shareLinks: dbResult.shareLinks,
        userSharesOwned: dbResult.userSharesOwned,
        auditLogsOwnFiles: dbResult.auditLogsOwnFiles,
        auditLogsAnonymized: dbResult.auditLogsAnonymized,
        s3Objects: s3Result.deletedCount,
      },
    });
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
      });
    }

    console.error('Delete account error:', error);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

export default router;
