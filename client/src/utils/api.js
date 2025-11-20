/**
 * API Utility
 * Axios instance with authentication and error handling
 * All backend API calls are defined here
 */

import axios from 'axios';

// Get API base URL from environment variables
const API_BASE_URL =
  import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

/**
 * Create Axios instance with default configuration
 */
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 seconds
});

/**
 * Request Interceptor
 * Automatically adds JWT token to all requests
 */
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

/**
 * Response Interceptor
 * Handles authentication errors and redirects
 */
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle 401 Unauthorized - token expired or invalid
    if (error.response?.status === 401) {
      // Get the request URL
      const requestUrl = error.config?.url || '';

      // Don't auto-logout for password verification endpoints
      // These endpoints return 401 when password is wrong, but user is still authenticated
      const passwordVerificationEndpoints = [
        '/auth/profile', // Update profile (wrong currentPassword)
        '/auth/password', // Change password (wrong currentPassword)
        '/auth/account', // Delete account (wrong password)
      ];

      // Check if this is a password verification endpoint
      const isPasswordVerification = passwordVerificationEndpoints.some(
        (endpoint) => requestUrl.includes(endpoint)
      );

      // If it's a password verification endpoint, let the component handle the error
      if (isPasswordVerification) {
        return Promise.reject(error);
      }

      // For other 401 errors (expired token, etc.), logout and redirect
      localStorage.removeItem('token');
      localStorage.removeItem('user');

      // Only redirect if not already on login/register pages
      const currentPath = window.location.pathname;
      if (
        currentPath !== '/login' &&
        currentPath !== '/register' &&
        !currentPath.startsWith('/share/')
      ) {
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

/**
 * Authentication API
 */
export const authAPI = {
  /**
   * Register a new user
   * @param {Object} data - User registration data
   * @param {string} data.username - Username (3-30 chars)
   * @param {string} data.email - Email address
   * @param {string} data.password - Password (min 8 chars)
   * @returns {Promise<Object>} Response with user and token
   */
  register: (data) => api.post('/auth/register', data),

  /**
   * Login existing user
   * @param {Object} data - Login credentials
   * @param {string} data.email - Email address
   * @param {string} data.password - Password
   * @returns {Promise<Object>} Response with user and token
   */
  login: (data) => api.post('/auth/login', data),

  /**
   * Get current authenticated user
   * @returns {Promise<Object>} Current user data
   */
  getMe: () => api.get('/auth/me'),

  /**
   * Logout user (client-side only)
   */
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  },

  /**
   * Update user profile (username and/or email)
   * Requires current password verification
   * @param {Object} data - Profile update data
   * @param {string} [data.username] - New username (optional)
   * @param {string} [data.email] - New email (optional)
   * @param {string} data.currentPassword - Current password for verification
   * @returns {Promise<Object>} Response with updated user data
   */
  updateProfile: (data) => api.patch('/auth/profile', data),

  /**
   * Change user password
   * Requires current password verification
   * @param {Object} data - Password change data
   * @param {string} data.currentPassword - Current password
   * @param {string} data.newPassword - New password (min 8 chars)
   * @param {string} data.confirmNewPassword - New password confirmation
   * @returns {Promise<Object>} Response with success message
   */
  changePassword: (data) => api.patch('/auth/password', data),

  /**
   * Delete user account permanently
   * Cascades: deletes all files (MongoDB + S3), shareLinks, userShares, and audit logs
   * @param {Object} data - Account deletion data
   * @param {string} data.password - Current password for verification
   * @param {string} data.confirmation - Must be exactly "DELETE" to confirm
   * @returns {Promise<Object>} Response with deletion counts
   */
  deleteAccount: (data) => api.delete('/auth/account', { data }),
};

/**
 * File API
 */
export const fileAPI = {
  /**
   * Get all files or files by category
   * @param {string} category - Category name (optional)
   * @param {Object} params - Query parameters for search/filter/sort
   * @returns {Promise<Object>} Response with files array
   */
  getMyFiles: (category, params = {}) => {
    const url = category ? `/files/my-files/${category}` : '/files/my-files';
    return api.get(url, { params });
  },

  /**
   * Upload a new file
   * @param {FormData} formData - File upload data
   * @returns {Promise<Object>} Response with uploaded file data
   */
  uploadFile: (formData) => {
    return api.post('/files/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },

  /**
   * Get pre-signed download URL for a file
   * @param {string} fileId - File ID
   * @returns {Promise<Object>} Response with downloadUrl
   */
  getDownloadUrl: (fileId) => api.get(`/files/download/${fileId}`),

  /**
   * Rename a file
   * @param {string} fileId - File ID
   * @param {string} filename - New filename
   * @returns {Promise<Object>} Response with updated file
   */
  renameFile: (fileId, filename) => {
    return api.patch(`/files/${fileId}/rename`, { filename });
  },

  /**
   * Move a file to a different category
   * @param {string} fileId - File ID
   * @param {string} category - New category (Personal, Work, Documents, Archive)
   * @returns {Promise<Object>} Response with updated file
   */
  moveFile: (fileId, category) => {
    return api.patch(`/files/${fileId}/move`, { category });
  },

  /**
   * Delete a file
   * @param {string} fileId - File ID
   * @returns {Promise<Object>} Response with deletion confirmation
   */
  deleteFile: (fileId) => api.delete(`/files/${fileId}`),

  /**
   * Get detailed file information
   * @param {string} fileId - File ID
   * @returns {Promise<Object>} Response with file details
   */
  getFileDetails: (fileId) => api.get(`/files/${fileId}/details`),
};

/**
 * Share API
 */
export const shareAPI = {
  /**
   * Create a file share (user share or public link)
   * @param {Object} data - Share creation data
   * @param {string} data.fileId - File ID to share
   * @param {string} data.shareType - 'user' or 'link'
   * @param {string} [data.recipientIdentifier] - Username/email (for user shares)
   * @param {number} [data.expirationMinutes] - Expiration in minutes (min: 10, max: 525960 = 1 year)
   * @param {number} [data.maxAccessCount] - Maximum access count
   * @returns {Promise<Object>} Response with share details and link
   */
  createShare: (data) => api.post('/share/create', data),

  /**
   * Access a shared file via public token (view only, no download)
   * @param {string} token - Share token
   * @returns {Promise<Object>} Response with file info and share metadata
   */
  getShareByToken: (token) => api.get(`/share/${token}`),

  /**
   * Download a shared file via public token
   * This increments access count and logs the download
   * @param {string} token - Share token
   * @returns {Promise<Object>} Response with downloadUrl
   */
  downloadSharedFile: (token) => api.post(`/share/${token}/download`),

  /**
   * Get all files shared with current user
   * @returns {Promise<Object>} Response with shared files array
   */
  getSharedWithMe: () => api.get('/share/shared-with-me'),

  /**
   * Get all active shares for a file (by file owner)
   * Returns both share links and user shares with recipient details
   * @param {string} fileId - File ID
   * @returns {Promise<Object>} Response with shareLinks and userShares arrays
   */
  getActiveSharesForFile: (fileId) =>
    api.get(`/share/file/${fileId}/active-shares`),

  /**
   * Revoke a single share link
   * Sets isActive to false and logs the action
   * @param {string} token - Share link token (64-char hex string)
   * @returns {Promise<Object>} Response with confirmation message
   */
  revokeShareLink: (token) => api.patch(`/share/link/${token}/revoke`),

  /**
   * Revoke a single user share
   * Sets isActive to false and logs the action
   * @param {string} shareId - User share ID
   * @returns {Promise<Object>} Response with confirmation message
   */
  revokeUserShare: (shareId) => api.patch(`/share/user/${shareId}/revoke`),

  /**
   * Revoke all shares for a file at once
   * Deactivates both share links and user shares
   * @param {string} fileId - File ID
   * @returns {Promise<Object>} Response with revoked counts
   */
  revokeAllShares: (fileId) => api.post(`/share/file/${fileId}/revoke-all`),
};

/**
 * Audit API
 */
export const auditAPI = {
  /**
   * Get audit logs for a specific file
   * @param {string} fileId - File ID
   * @returns {Promise<Object>} Response with audit logs array
   */
  getFileAuditLogs: (fileId) => api.get(`/audit/file/${fileId}`),
};

/**
 * Error Handler Utility
 * Extracts error message from API response
 * @param {Error} error - Axios error object
 * @returns {string} User-friendly error message
 */
export const getErrorMessage = (error) => {
  if (error.response) {
    // Server responded with error status
    return (
      error.response.data?.error ||
      error.response.data?.message ||
      'An error occurred'
    );
  } else if (error.request) {
    // Request made but no response received
    return 'No response from server. Please check your connection.';
  } else {
    // Error in request setup
    return error.message || 'An unexpected error occurred';
  }
};

// Export the Axios instance for custom requests
export default api;
