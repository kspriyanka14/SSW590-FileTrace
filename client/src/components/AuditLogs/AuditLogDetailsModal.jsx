/**
 * AuditLogDetailsModal Component
 * Displays comprehensive details for a single audit log entry
 * Shows: action, timestamp, user, IP, location, and action-specific details
 */

import { useEffect } from 'react';
import {
  X,
  Activity,
  User as UserIcon,
  MapPin,
  Clock,
  Info,
} from 'lucide-react';
import { formatDate, formatRelativeTime } from '../../utils/auth';

/**
 * Get action type badge styling (Modern Earth light mode)
 * Matches getActionBadge from AuditLogs.jsx
 */
const getActionBadge = (action) => {
  const badges = {
    UPLOAD: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Upload' },
    DOWNLOAD: { bg: 'bg-green-100', text: 'text-green-700', label: 'Download' },
    NAME_CHANGE: {
      bg: 'bg-purple-100',
      text: 'text-purple-700',
      label: 'Rename',
    },
    CATEGORY_CHANGE: {
      bg: 'bg-gray-100',
      text: 'text-gray-700',
      label: 'Category Change',
    },
    DELETE: { bg: 'bg-red-100', text: 'text-red-700', label: 'Delete' },
    SHARE_CREATED: {
      bg: 'bg-indigo-100',
      text: 'text-indigo-700',
      label: 'Share Created',
    },
    SHARE_WITH_USER: {
      bg: 'bg-blue-100',
      text: 'text-blue-700',
      label: 'Shared with User',
    },
    SHARE_ACCESSED: {
      bg: 'bg-orange-100',
      text: 'text-orange-700',
      label: 'Share Accessed',
    },
    LINK_ACCESSED: {
      bg: 'bg-sky-100',
      text: 'text-sky-700',
      label: 'Link Accessed',
    },
    EXPIRED_LINK_ATTEMPT: {
      bg: 'bg-amber-100',
      text: 'text-amber-700',
      label: 'Expired Link Attempt',
    },
    SHARE_REVOKED: {
      bg: 'bg-rose-100',
      text: 'text-rose-700',
      label: 'Share Revoked',
    },
    SHARES_REVOKED_ALL: {
      bg: 'bg-pink-100',
      text: 'text-pink-700',
      label: 'All Shares Revoked',
    },
  };

  return (
    badges[action] || {
      bg: 'bg-bg-tertiary',
      text: 'text-text-secondary',
      label: action,
    }
  );
};

/**
 * MetadataItem Component
 * Displays a labeled metadata field
 */
function MetadataItem({ label, value }) {
  return (
    <div>
      <p className="text-xs text-text-muted mb-1">{label}</p>
      <p className="text-sm font-medium text-text">
        {value || 'Not available'}
      </p>
    </div>
  );
}

/**
 * AuditLogDetailsModal Component
 * @param {Object} props - Component props
 * @param {boolean} props.isOpen - Whether modal is open
 * @param {Function} props.onClose - Close callback
 * @param {Object} props.log - Audit log object
 * @returns {React.ReactElement|null} Audit log details modal
 */
export default function AuditLogDetailsModal({ isOpen, onClose, log }) {
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

  if (!isOpen || !log) return null;

  const badge = getActionBadge(log.action);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="audit-log-details-title"
    >
      <div
        className="modal-content max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-6 border-b border-border-primary">
          <div className="flex items-center gap-3">
            <div
              className={`w-12 h-12 rounded-lg flex items-center justify-center ${badge.bg}`}
            >
              <Activity
                className={`w-6 h-6 ${badge.text}`}
                aria-hidden="true"
              />
            </div>
            <h2
              id="audit-log-details-title"
              className="text-2xl font-bold text-text"
            >
              {badge.label}
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
          {/* Timestamp Section - Highlighted */}
          <div className="bg-primary/10 border border-primary/30 rounded-lg p-4">
            <h3 className="text-sm font-medium text-primary mb-2 flex items-center gap-2">
              <Clock className="w-4 h-4" aria-hidden="true" />
              Timestamp
            </h3>
            <p className="text-sm text-text">{formatDate(log.timestamp)}</p>
            <p className="text-xs text-text-secondary mt-1">
              ({formatRelativeTime(log.timestamp)})
            </p>
          </div>

          {/* Action Details Grid */}
          <div>
            <h3 className="text-sm font-medium text-text-secondary mb-3">
              Action Details
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <MetadataItem label="Action Type" value={badge.label} />
              <MetadataItem label="User" value={log.username || 'Anonymous'} />
              <MetadataItem label="IP Address" value={log.ipAddress} />
              {log.location && (
                <MetadataItem label="Location" value={log.location} />
              )}
            </div>
          </div>

          {/* Additional Details (if present) */}
          {log.details && (
            <div>
              <h3 className="text-sm font-medium text-text-secondary mb-3">
                Additional Information
              </h3>
              <div className="bg-bg-tertiary rounded-lg p-4">
                {typeof log.details === 'object' ? (
                  <div className="space-y-2">
                    {Object.entries(log.details).map(([key, value]) => (
                      <div key={key} className="text-sm">
                        <span className="font-medium text-text">
                          {key.replace(/([A-Z])/g, ' $1').trim()}:
                        </span>{' '}
                        <span className="text-text-secondary">
                          {typeof value === 'object'
                            ? JSON.stringify(value)
                            : String(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-text">{log.details}</p>
                )}
              </div>
            </div>
          )}

          {/* Info Banner */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <Info
                className="w-4 h-4 text-blue-700 flex-shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <p className="text-xs text-blue-700">
                Audit logs are permanent records of all file activity. They
                cannot be modified or deleted and help maintain security and
                compliance.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
