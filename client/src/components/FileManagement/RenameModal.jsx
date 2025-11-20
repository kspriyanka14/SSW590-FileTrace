/**
 * Rename File Modal Component
 * Modal for renaming a file (filename only, extension preserved)
 */

import { useState, useEffect } from 'react';
import { X, Edit, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { fileAPI, getErrorMessage } from '../../utils/api.js';

/**
 * RenameModal Component
 *
 * @param {Object} props - Component props
 * @param {boolean} props.isOpen - Whether modal is open
 * @param {Function} props.onClose - Close callback
 * @param {Object} props.file - File object to rename
 * @param {Function} props.onRenameSuccess - Success callback (refreshes file list)
 * @returns {React.ReactElement} Rename modal
 */
export default function RenameModal({
  isOpen,
  onClose,
  file,
  onRenameSuccess,
}) {
  const [newFilename, setNewFilename] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState({});

  /**
   * Extract filename and extension when modal opens
   */
  useEffect(() => {
    if (isOpen && file) {
      // Extract filename without extension
      const lastDotIndex = file.filename.lastIndexOf('.');
      if (lastDotIndex === -1) {
        // No extension
        setNewFilename(file.filename);
      } else {
        const nameWithoutExt = file.filename.substring(0, lastDotIndex);
        setNewFilename(nameWithoutExt);
      }
      setErrors({});
    }
  }, [isOpen, file]);

  /**
   * Handle escape key press
   */
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape' && isOpen && !isSaving) {
        handleClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, isSaving]);

  /**
   * Get file extension
   */
  const getExtension = () => {
    if (!file) return null;
    const lastDotIndex = file.filename.lastIndexOf('.');
    if (lastDotIndex === -1) return null;
    return file.filename.substring(lastDotIndex);
  };

  /**
   * Validate filename
   */
  const validateFilename = () => {
    const newErrors = {};

    if (!newFilename.trim()) {
      newErrors.filename = 'Filename cannot be empty';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /**
   * Handle close modal
   */
  const handleClose = () => {
    if (!isSaving) {
      setNewFilename('');
      setErrors({});
      onClose();
    }
  };

  /**
   * Handle rename submission
   */
  const handleRename = async () => {
    if (!validateFilename()) return;

    try {
      setIsSaving(true);

      // Build new full filename with extension
      const extension = getExtension();
      const fullFilename = extension
        ? `${newFilename.trim()}${extension}`
        : newFilename.trim();

      // Call API to rename file
      await fileAPI.renameFile(file._id, fullFilename);

      toast.success('File renamed successfully');

      // Call success callback (refreshes file list)
      if (onRenameSuccess) {
        onRenameSuccess();
      }

      handleClose();
    } catch (error) {
      console.error('Rename error:', error);
      const message = getErrorMessage(error);
      toast.error(message || 'Failed to rename file');
      setErrors({ submit: message });
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Handle form submission
   */
  const handleSubmit = (e) => {
    e.preventDefault();
    handleRename();
  };

  if (!isOpen || !file) return null;

  const extension = getExtension();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="rename-modal-title"
    >
      <div
        className="modal-content max-w-lg w-full"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-6 border-b border-border-primary">
          <div className="flex items-center gap-2">
            <Edit className="w-6 h-6 text-primary" aria-hidden="true" />
            <h2
              id="rename-modal-title"
              className="text-2xl font-bold text-text"
            >
              Rename File
            </h2>
          </div>
          <button
            onClick={handleClose}
            disabled={isSaving}
            className="text-text-secondary hover:text-text transition-colors disabled:cursor-not-allowed"
            aria-label="Close modal"
          >
            <X className="w-6 h-6" aria-hidden="true" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="py-6 space-y-6">
          {/* Current Filename Display */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Current Filename
            </label>
            <div className="px-4 py-3 bg-bg-tertiary border border-border-primary rounded-lg">
              <p className="text-text font-medium break-all">{file.filename}</p>
            </div>
          </div>

          {/* New Filename Input */}
          <div>
            <label
              htmlFor="newFilename"
              className="block text-sm font-medium text-text mb-2"
            >
              New Filename <span className="text-error">*</span>
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <input
                  type="text"
                  id="newFilename"
                  value={newFilename}
                  onChange={(e) => setNewFilename(e.target.value)}
                  className={`input-field ${
                    errors.filename ? 'border-error' : ''
                  }`}
                  placeholder="Enter new filename"
                  autoFocus
                  disabled={isSaving}
                />
                {errors.filename && (
                  <p className="text-sm text-error mt-1">{errors.filename}</p>
                )}
              </div>
              {extension && (
                <div className="px-4 py-3 bg-bg-tertiary border border-border-primary rounded-lg">
                  <p className="text-text-secondary font-medium">{extension}</p>
                </div>
              )}
            </div>
            <p className="text-sm text-text-secondary mt-2">
              Extension{' '}
              <strong className="text-text">{extension || '(none)'}</strong>{' '}
              will be preserved automatically
            </p>
          </div>

          {errors.submit && (
            <div className="p-4 bg-error/10 border border-error/30 rounded-lg">
              <p className="text-sm text-error">{errors.submit}</p>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 pt-6 mt-6 border-t border-border-primary">
          <button
            type="button"
            onClick={handleClose}
            disabled={isSaving}
            className="btn-secondary"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleRename}
            disabled={!newFilename.trim() || isSaving}
            className="btn-primary flex items-center gap-2"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" aria-hidden="true" />
                <span>Save Changes</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
