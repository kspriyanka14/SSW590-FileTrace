/**
 * ShareCard Component
 * Displays a single share (link or user share) with details and revoke button
 */

import { useState } from 'react';
import {
  Trash2,
  Link2,
  User,
  Calendar,
  Eye,
  Clock,
  Copy,
  Check,
} from 'lucide-react';
import { formatDate, formatRelativeTime } from '../../utils/auth.js';

/**
 * ShareCard Component
 *
 * @param {Object} props - Component props
 * @param {Object} props.share - Share object (link or user share)
 * @param {string} props.shareType - 'link' or 'user'
 * @param {Function} props.onRevoke - Callback when revoke button clicked
 * @param {boolean} props.isRevoking - Whether revoke is in progress
 * @returns {JSX.Element}
 */
export default function ShareCard({ share, shareType, onRevoke, isRevoking }) {
  const [copied, setCopied] = useState(false);

  /**
   * Handle copy link to clipboard
   */
  const handleCopyLink = async () => {
    try {
      const shareUrl = `${window.location.origin}/share/${share.token}`;
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy link:', error);
    }
  };

  // Calculate expiration status for badge color
  // Note: Backend filters out expired shares, so we only check for "expiring-soon"
  const getExpirationStatus = () => {
    if (share.expiresAt) {
      const now = new Date();
      const expiresAt = new Date(share.expiresAt);
      const hoursUntilExpiry = (expiresAt - now) / (1000 * 60 * 60);

      if (hoursUntilExpiry < 24) return 'expiring-soon';
    }

    return 'active';
  };

  const expirationStatus = getExpirationStatus();

  // Build full shareable URL - only for share links
  const shareUrl =
    shareType === 'link'
      ? `${window.location.origin}/share/${share.token}`
      : null;

  // Format access count display
  const accessDisplay =
    share.maxAccessCount !== undefined && share.maxAccessCount !== null
      ? `${share.accessCount || 0}/${share.maxAccessCount} accesses`
      : 'Unlimited accesses';

  // Format remaining accesses
  const remainingDisplay =
    share.remainingAccesses !== null && share.remainingAccesses !== undefined
      ? `${share.remainingAccesses} remaining`
      : null;

  return (
    <div className="border border-border-primary rounded-lg p-4 bg-bg-tertiary hover:border-primary transition-all">
      {/* Header: Type Badge + Revoke Button */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {shareType === 'link' ? (
            <Link2 className="w-5 h-5 text-primary" />
          ) : (
            <User className="w-5 h-5 text-primary" />
          )}
          <span className="font-semibold text-text">
            {shareType === 'link' ? 'Public Link' : 'User Share'}
          </span>
        </div>

        {/* Status Badge */}
        <span
          className={`px-2 py-1 rounded-full text-xs font-medium ${
            expirationStatus === 'expiring-soon'
              ? 'bg-warning/20 text-warning'
              : 'bg-success/20 text-success'
          }`}
        >
          {expirationStatus === 'expiring-soon' ? 'Expiring Soon' : 'Active'}
        </span>
      </div>

      {/* Share Details */}
      <div className="space-y-2 mb-4">
        {/* For Share Links: URL */}
        {shareType === 'link' && (
          <div>
            <label className="block text-sm font-medium text-text mb-2">
              Shareable Link
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={shareUrl}
                readOnly
                className="input-field flex-1 font-mono text-sm"
                aria-label="Share link"
              />
              <button
                onClick={handleCopyLink}
                className="btn-outline flex items-center gap-2 whitespace-nowrap text-sm"
                aria-label="Copy link to clipboard"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4" aria-hidden="true" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" aria-hidden="true" />
                    <span>Copy Link</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* For User Shares: Recipient */}
        {shareType === 'user' && share.recipientInfo && (
          <div>
            <p className="text-sm text-text-secondary mb-1">Shared with:</p>
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-text-muted" />
              <span className="text-sm font-medium text-text">
                {share.recipientInfo.username || 'Unknown User'}
              </span>
              {share.recipientInfo.email && (
                <span className="text-sm text-text-secondary">
                  ({share.recipientInfo.email})
                </span>
              )}
            </div>
          </div>
        )}

        {/* Expiration Date */}
        {share.expiresAt && (
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-text-muted" />
            <span className="text-sm text-text-secondary">
              Expires: {formatDate(share.expiresAt)}
            </span>
            <span className="text-xs text-text-muted">
              ({formatRelativeTime(share.expiresAt)})
            </span>
          </div>
        )}

        {/* No Expiration Date */}
        {!share.expiresAt && (
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-text-muted" />
            <span className="text-sm text-text-secondary">No time limit</span>
          </div>
        )}

        {/* Access Count */}
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-text-muted" />
          <span className="text-sm text-text-secondary">
            {accessDisplay}
            {remainingDisplay && (
              <span className="text-primary ml-2">({remainingDisplay})</span>
            )}
          </span>
        </div>

        {/* Created Date */}
        {share.createdAt && (
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-text-muted" />
            <span className="text-sm text-text-secondary">
              Created {formatRelativeTime(share.createdAt)}
            </span>
          </div>
        )}
      </div>

      {/* Revoke Button */}
      <button
        onClick={() => onRevoke(share)}
        disabled={isRevoking}
        className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-4 focus:ring-error focus:ring-opacity-30 ${
          isRevoking
            ? 'bg-bg-elevated text-text-muted cursor-not-allowed opacity-50'
            : 'bg-error text-white hover:bg-red-700'
        }`}
      >
        {isRevoking ? (
          <>
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            Revoking...
          </>
        ) : (
          <>
            <Trash2 className="w-4 h-4" />
            Revoke Access
          </>
        )}
      </button>
    </div>
  );
}
