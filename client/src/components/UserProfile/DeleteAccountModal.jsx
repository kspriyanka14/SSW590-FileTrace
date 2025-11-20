/**
 * DeleteAccountModal Component
 * Modal for permanently deleting user account with cascade deletion
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, AlertTriangle, Lock, Type } from 'lucide-react';
import { toast } from 'sonner';
import { authAPI, getErrorMessage } from '../../utils/api';
import {
  deleteAccountSchema,
  extractValidationErrors,
} from '../../utils/validation';

/**
 * DeleteAccountModal Component
 * Handles account deletion with server validation
 * On success: automatically logs out user and redirects to login
 *
 * @param {Object} props - Component props
 * @param {boolean} props.isOpen - Whether modal is open
 * @param {Function} props.onClose - Callback to close modal
 * @param {Object} props.user - Current user data
 * @param {string} props.user.username - Username for display
 * @returns {JSX.Element|null}
 */
export default function DeleteAccountModal({ isOpen, onClose, user }) {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    password: '',
    confirmation: '',
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData({
        password: '',
        confirmation: '',
      });
      setErrors({});
      setShowDetails(false);
    }
  }, [isOpen]);

  /**
   * Handle input change
   */
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear field error on change
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  /**
   * Handle form submission
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});

    // Validate
    try {
      deleteAccountSchema.parse(formData);
    } catch (error) {
      const validationErrors = extractValidationErrors(error);
      setErrors(validationErrors);

      // Show toast notification for validation errors
      const errorMessages = Object.values(validationErrors);
      if (errorMessages.length > 0) {
        toast.error(errorMessages[0]); // Show first error
      }
      return;
    }

    // Submit to API
    try {
      setLoading(true);
      const response = await authAPI.deleteAccount(formData);

      // SUCCESS: Server confirmed account deletion
      // Show detailed deletion results
      const deletedRecords = response.data.deletedRecords;
      const message = `Account deleted successfully. Removed: ${deletedRecords.files} files, ${deletedRecords.shareLinks} share links, ${deletedRecords.s3Objects} S3 objects.`;

      toast.success(message, { duration: 5000 });

      // Close modal
      onClose();

      // Clear authentication
      localStorage.removeItem('token');
      localStorage.removeItem('user');

      // Redirect to login with message
      setTimeout(() => {
        navigate('/login', {
          replace: true,
          state: { message: 'Your account has been permanently deleted.' },
        });
      }, 1000); // Small delay to show success toast
    } catch (error) {
      // ERROR: Server rejected account deletion
      // Keep user logged in and show the error
      console.error('Delete account error:', error);
      const errorMessage = getErrorMessage(error);
      toast.error(errorMessage);

      // Set field-specific errors if available
      if (error.response?.data?.details) {
        const fieldErrors = {};
        error.response.data.details.forEach((detail) => {
          const match = detail.match(/^(\w+):/);
          if (match) {
            const field = match[1];
            fieldErrors[field] = detail.replace(`${field}:`, '').trim();
          }
        });
        setErrors(fieldErrors);
      }
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle Escape key to close modal
   */
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen && !loading) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, loading, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) {
          onClose();
        }
      }}
    >
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg border-4 border-red-500 relative">
        {/* Loading Overlay */}
        {loading && (
          <div className="absolute inset-0 bg-white bg-opacity-90 rounded-lg flex items-center justify-center z-10">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-lg font-semibold text-red-900 mb-2">
                Deleting Account...
              </p>
              <p className="text-sm text-gray-600">This may take a moment</p>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-red-200 bg-red-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-red-900">Delete Account</h2>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="text-red-400 hover:text-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Close modal"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4" noValidate>
          {/* Warning Message */}
          <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-red-900 mb-2">
                  Warning: This action is permanent and cannot be undone!
                </p>
                <p className="text-sm text-red-800 mb-3">
                  Deleting your account ({user?.username}) will permanently
                  remove:
                </p>
                <ul className="list-disc list-inside text-sm text-red-800 space-y-1">
                  <li>Your account and profile information</li>
                  <li>All your uploaded files (MongoDB and AWS S3)</li>
                  <li>All share links you created</li>
                  <li>All user shares you created</li>
                  <li>All audit logs for your files</li>
                </ul>
                <button
                  type="button"
                  onClick={() => setShowDetails(!showDetails)}
                  className="text-xs text-red-700 underline hover:text-red-900 mt-3"
                >
                  {showDetails
                    ? 'Hide technical details'
                    : 'Show technical details'}
                </button>
                {showDetails && (
                  <div className="mt-3 p-3 bg-red-100 rounded text-xs text-red-900 font-mono">
                    <p className="font-bold mb-1">Deletion Process:</p>
                    <ul className="list-decimal list-inside space-y-0.5">
                      <li>Verify password</li>
                      <li>Delete all files from AWS S3 (irreversible)</li>
                      <li>Delete files from MongoDB</li>
                      <li>Delete share links and user shares</li>
                      <li>Delete audit logs for your files</li>
                      <li>Anonymize logs for other users' files</li>
                      <li>Delete user account</li>
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Password Field */}
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Confirm Your Password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                disabled={loading}
                required
                className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 disabled:bg-gray-100 disabled:cursor-not-allowed ${
                  errors.password
                    ? 'border-red-500 focus:ring-red-500'
                    : 'border-gray-300 focus:ring-red-500'
                }`}
                placeholder="Enter your password"
              />
            </div>
            {errors.password && (
              <p className="text-sm text-red-600 mt-1">{errors.password}</p>
            )}
          </div>

          {/* Confirmation Field */}
          <div>
            <label
              htmlFor="confirmation"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Type <span className="font-bold text-red-600">DELETE</span> to
              confirm <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Type className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                id="confirmation"
                name="confirmation"
                value={formData.confirmation}
                onChange={handleChange}
                disabled={loading}
                required
                className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 disabled:bg-gray-100 disabled:cursor-not-allowed ${
                  errors.confirmation
                    ? 'border-red-500 focus:ring-red-500'
                    : 'border-gray-300 focus:ring-red-500'
                }`}
                placeholder="Type DELETE to confirm"
                autoComplete="off"
              />
            </div>
            {errors.confirmation && (
              <p className="text-sm text-red-600 mt-1">{errors.confirmation}</p>
            )}
            <p className="text-xs text-gray-600 mt-1">
              Must type exactly: DELETE (all caps, no spaces)
            </p>
          </div>

          {/* Footer Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || formData.confirmation !== 'DELETE'}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Deleting Account...
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4" />
                  Delete My Account
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
