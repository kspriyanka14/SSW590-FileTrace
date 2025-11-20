/**
 * File Information Modal Component
 * Displays comprehensive file metadata including lazy-loaded share count
 */

import { useState, useEffect } from 'react';
import {
  X,
  Loader2,
  Activity,
  File,
  Image,
  Video,
  Music,
  FileText,
  Sheet,
  Presentation,
  Archive,
  Code,
} from 'lucide-react';
import { shareAPI } from '../../utils/api';
import { formatFileSize, formatDate, getFileIcon } from '../../utils/auth';

/**
 * Get actual icon component from icon name string
 */
const getIconComponent = (iconName) => {
  const iconMap = {
    File,
    Image,
    Video,
    Music,
    FileText,
    Sheet,
    Presentation,
    Archive,
    Code,
  };
  return iconMap[iconName] || File;
};

/**
 * MetadataItem Component
 * Displays a labeled metadata field
 */
function MetadataItem({ label, value, loading = false }) {
  return (
    <div>
      <p className="text-xs text-text-muted mb-1">{label}</p>
      {loading ? (
        <Loader2
          className="w-4 h-4 animate-spin text-text-secondary"
          aria-hidden="true"
        />
      ) : (
        <p className="text-sm font-medium text-text">{value}</p>
      )}
    </div>
  );
}

/**
 * Get action label matching AuditLogs display format
 */
const getActionLabel = (action) => {
  const labels = {
    UPLOAD: 'Upload',
    DOWNLOAD: 'Download',
    NAME_CHANGE: 'Rename',
    CATEGORY_CHANGE: 'Category Change',
    DELETE: 'Delete',
    SHARE_CREATED: 'Share Created',
    SHARE_WITH_USER: 'Shared with User',
    SHARE_ACCESSED: 'Share Accessed',
    LINK_ACCESSED: 'Link Accessed',
    EXPIRED_LINK_ATTEMPT: 'Expired Link',
    SHARE_REVOKED: 'Share Revoked',
    SHARES_REVOKED_ALL: 'All Shares Revoked',
  };
  return labels[action] || action;
};

/**
 * FileInformationModal Component
 * Shows all file metadata with lazy-loaded share count
 *
 * @param {Object} props - Component props
 * @param {boolean} props.isOpen - Whether modal is open
 * @param {Function} props.onClose - Close callback
 * @param {Object} props.file - File object
 * @returns {React.ReactElement} File information modal
 */
export default function FileInformationModal({ isOpen, onClose, file }) {
  const [shareCount, setShareCount] = useState(null);
  const [loadingShares, setLoadingShares] = useState(true);

  /**
   * Load share count when modal opens
   */
  useEffect(() => {
    if (isOpen && file) {
      loadShareCount();
    }
  }, [isOpen, file]);

  /**
   * Fetch active share count for file
   */
  const loadShareCount = async () => {
    try {
      setLoadingShares(true);
      const response = await shareAPI.getActiveSharesForFile(file._id);
      const linkCount = response.data.shareLinks?.length || 0;
      const userShareCount = response.data.userShares?.length || 0;
      setShareCount(linkCount + userShareCount);
    } catch (error) {
      console.error('Load share count error:', error);
      setShareCount(0);
    } finally {
      setLoadingShares(false);
    }
  };

  /**
   * Handle escape key press
   */
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  /**
   * Get formatted file type from mimetype
   */
  const getFileType = (mimetype) => {
    if (!mimetype) return 'Unknown';
    const parts = mimetype.split('/');
    if (parts.length === 2) {
      return parts[1].toUpperCase();
    }
    return mimetype;
  };

  if (!isOpen || !file) return null;

  const iconName = getFileIcon(file.mimetype);
  const FileIcon = getIconComponent(iconName);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="file-info-title"
    >
      <div
        className="modal-content max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside modal
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-6 border-b border-border-primary">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center flex-shrink-0">
              <FileIcon className="w-6 h-6 text-primary" aria-hidden="true" />
            </div>
            <h2
              id="file-info-title"
              className="text-2xl font-bold text-text break-all"
            >
              {file.filename}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-text-secondary hover:text-text transition-colors"
            aria-label="Close modal"
          >
            <X className="w-6 h-6" aria-hidden="true" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Description Section */}
          {file.description && (
            <div>
              <h3 className="text-sm font-medium text-text-secondary mb-2">
                Description
              </h3>
              <p className="text-text">{file.description}</p>
            </div>
          )}

          {/* Metadata Grid */}
          <div>
            <h3 className="text-sm font-medium text-text-secondary mb-3">
              File Details
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <MetadataItem label="Name" value={file.filename} />
              <MetadataItem label="Type" value={getFileType(file.mimetype)} />
              <MetadataItem label="Size" value={formatFileSize(file.size)} />
              <MetadataItem label="Category" value={file.category} />
              <MetadataItem
                label="Uploaded"
                value={formatDate(file.uploadedAt)}
              />
              <MetadataItem label="Times Accessed" value={file.accessCount} />
              <MetadataItem
                label="Active Shares"
                value={shareCount}
                loading={loadingShares}
              />
              {file.lastAccessedAt && (
                <MetadataItem
                  label="Last Accessed"
                  value={formatDate(file.lastAccessedAt)}
                />
              )}
            </div>
          </div>

          {/* Recent Activity Section */}
          {file.recentActivity && (
            <div className="bg-primary/10 border border-primary/30 rounded-lg p-4">
              <h3 className="text-sm font-medium text-primary mb-2 flex items-center gap-2">
                <Activity className="w-4 h-4" aria-hidden="true" />
                Recent Activity
              </h3>
              <p className="text-sm text-text">
                <strong>{getActionLabel(file.recentActivity.action)}</strong>
                {' • '}
                {formatDate(file.recentActivity.timestamp)}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
