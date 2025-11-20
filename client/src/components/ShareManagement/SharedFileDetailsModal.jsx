/**
 * SharedFileDetailsModal Component
 * Displays details for a file shared with the current user
 * Shows file metadata and share information (owner, expiration, downloads remaining)
 */

import { useState, useEffect } from 'react';
import {
  X,
  Download,
  Loader2,
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
import { toast } from 'sonner';
import { fileAPI, getErrorMessage } from '../../utils/api';
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
function MetadataItem({ label, value }) {
  return (
    <div>
      <p className="text-xs text-text-muted mb-1">{label}</p>
      <p className="text-sm font-medium text-text">{value}</p>
    </div>
  );
}

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

/**
 * SharedFileDetailsModal Component
 * Shows file details + share metadata
 *
 * @param {Object} props - Component props
 * @param {boolean} props.isOpen - Whether modal is open
 * @param {Function} props.onClose - Close callback
 * @param {Object} props.file - File object with shareInfo attached
 * @returns {React.ReactElement} Shared file details modal
 */
export default function SharedFileDetailsModal({ isOpen, onClose, file }) {
  const [downloading, setDownloading] = useState(false);

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
   * Handle file download
   */
  const handleDownload = async () => {
    try {
      setDownloading(true);
      const response = await fileAPI.downloadFile(file._id);
      const url = response.data.url;

      // Open pre-signed URL in new window
      window.location.href = url;

      toast.success('Download started');

      // Close modal after download starts
      setTimeout(() => {
        onClose();
      }, 500);
    } catch (error) {
      console.error('Download error:', error);
      toast.error(getErrorMessage(error) || 'Failed to download file');
    } finally {
      setDownloading(false);
    }
  };

  if (!isOpen || !file) return null;

  const iconName = getFileIcon(file.mimetype);
  const FileIcon = getIconComponent(iconName);
  const isExpired = file.shareInfo?.isExpired || false;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="shared-file-info-title"
    >
      <div
        className="modal-content max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-6 border-b border-border-primary">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center flex-shrink-0">
              <FileIcon className="w-6 h-6 text-primary" aria-hidden="true" />
            </div>
            <h2
              id="shared-file-info-title"
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
          {file.description ? (
            <div>
              <h3 className="text-sm font-medium text-text-secondary mb-2">
                Description
              </h3>
              <p className="text-text">{file.description}</p>
            </div>
          ) : (
            <div>
              <h3 className="text-sm font-medium text-text-secondary mb-2">
                Description
              </h3>
              <p className="text-text-muted italic">No description provided</p>
            </div>
          )}

          {/* Metadata Grid */}
          <div>
            <h3 className="text-sm font-medium text-text-secondary mb-3">
              File Details
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <MetadataItem
                label="File Type"
                value={getFileType(file.mimetype)}
              />
              <MetadataItem
                label="File Size"
                value={formatFileSize(file.size)}
              />
              <MetadataItem
                label="Shared By"
                value={file.shareInfo?.ownerUsername || 'Unknown User'}
              />
              <MetadataItem
                label="Expiration"
                value={
                  file.shareInfo?.expiresAt
                    ? formatDate(file.shareInfo.expiresAt)
                    : 'No expiration'
                }
              />
              <MetadataItem
                label="Downloads Remaining"
                value={
                  file.shareInfo?.remainingAccesses !== null &&
                  file.shareInfo?.remainingAccesses !== undefined ? (
                    file.shareInfo.remainingAccesses === 0 ? (
                      <span className="text-error">No downloads remaining</span>
                    ) : (
                      file.shareInfo.remainingAccesses
                    )
                  ) : (
                    'Unlimited'
                  )
                }
              />
            </div>
          </div>

          {/* Expiration Warning */}
          {isExpired && (
            <div className="bg-error/10 border border-error/30 rounded-lg p-4">
              <p className="text-error font-medium flex items-center gap-2">
                <span className="badge badge-error">EXPIRED</span>
                This file share has expired and can no longer be downloaded
              </p>
            </div>
          )}
        </div>

        {/* Footer - Download Button (only if not expired) */}
        {!isExpired && (
          <div className="flex items-center justify-end gap-3 pt-6 mt-6 border-t border-border-primary">
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="btn-primary flex items-center gap-2"
            >
              {downloading ? (
                <>
                  <Loader2
                    className="w-4 h-4 animate-spin"
                    aria-hidden="true"
                  />
                  <span>Downloading...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" aria-hidden="true" />
                  <span>Download</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
