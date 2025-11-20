/**
 * ViewSharesModal Component
 * Modal displaying all active shares for a file with revoke functionality
 */

import { useState, useEffect } from 'react';
import { X, AlertTriangle, Link2, Users, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { shareAPI, getErrorMessage } from '../../utils/api.js';
import ShareCard from './ShareCard.jsx';

/**
 * ViewSharesModal Component
 *
 * @param {Object} props - Component props
 * @param {boolean} props.isOpen - Whether modal is open
 * @param {Function} props.onClose - Callback to close modal
 * @param {string} props.fileId - File ID
 * @param {string} props.filename - Filename for display
 * @param {Function} props.onRevokeSuccess - Callback after successful revoke
 * @returns {JSX.Element}
 */
export default function ViewSharesModal({
  isOpen,
  onClose,
  fileId,
  filename,
  onRevokeSuccess,
}) {
  const [shareLinks, setShareLinks] = useState([]);
  const [userShares, setUserShares] = useState([]);
  const [loading, setLoading] = useState(true);
  const [revokingId, setRevokingId] = useState(null);
  const [revokingAll, setRevokingAll] = useState(false);
  const [showConfirmRevokeAll, setShowConfirmRevokeAll] = useState(false);

  // Load shares when modal opens
  useEffect(() => {
    if (isOpen && fileId) {
      loadShares();
    }
  }, [isOpen, fileId]);

  /**
   * Load all active shares for the file
   */
  const loadShares = async () => {
    try {
      setLoading(true);
      const response = await shareAPI.getActiveSharesForFile(fileId);
      setShareLinks(response.data.shareLinks || []);
      setUserShares(response.data.userShares || []);
    } catch (error) {
      console.error('Load shares error:', error);
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  /**
   * Revoke a single share link
   */
  const handleRevokeShareLink = async (share) => {
    try {
      setRevokingId(share.token);
      await shareAPI.revokeShareLink(share.token);
      toast.success('Share link revoked successfully');

      // Remove from local state
      setShareLinks(shareLinks.filter((s) => s.token !== share.token));

      // Notify parent component
      if (onRevokeSuccess) {
        onRevokeSuccess();
      }
    } catch (error) {
      console.error('Revoke share link error:', error);
      toast.error(getErrorMessage(error));
    } finally {
      setRevokingId(null);
    }
  };

  /**
   * Revoke a single user share
   */
  const handleRevokeUserShare = async (share) => {
    try {
      setRevokingId(share._id.toString());
      await shareAPI.revokeUserShare(share._id.toString());
      toast.success('User share revoked successfully');

      // Remove from local state
      setUserShares(
        userShares.filter((s) => s._id.toString() !== share._id.toString())
      );

      // Notify parent component
      if (onRevokeSuccess) {
        onRevokeSuccess();
      }
    } catch (error) {
      console.error('Revoke user share error:', error);
      toast.error(getErrorMessage(error));
    } finally {
      setRevokingId(null);
    }
  };

  /**
   * Revoke all shares for the file
   */
  const handleRevokeAll = async () => {
    try {
      setRevokingAll(true);
      const response = await shareAPI.revokeAllShares(fileId);

      const { shareLinks: linkCount, userShares: userCount } =
        response.data.revokedCounts;
      toast.success(
        `Revoked ${linkCount} share link(s) and ${userCount} user share(s)`
      );

      // Clear local state
      setShareLinks([]);
      setUserShares([]);
      setShowConfirmRevokeAll(false);

      // Notify parent component
      if (onRevokeSuccess) {
        onRevokeSuccess();
      }
    } catch (error) {
      console.error('Revoke all shares error:', error);
      toast.error(getErrorMessage(error));
    } finally {
      setRevokingAll(false);
    }
  };

  /**
   * Handle revoke based on share type
   */
  const handleRevoke = (share, shareType) => {
    if (shareType === 'link') {
      handleRevokeShareLink(share);
    } else {
      handleRevokeUserShare(share);
    }
  };

  const totalShares = shareLinks.length + userShares.length;
  const hasShares = totalShares > 0;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="modal-content max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-6 border-b border-border-primary">
          <div>
            <h2 className="text-2xl font-bold text-text">Active Shares</h2>
            <p className="text-sm text-text-secondary mt-1">{filename}</p>
          </div>
          <button
            onClick={onClose}
            className="text-text-secondary hover:text-text transition-colors"
            aria-label="Close modal"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin glow-orange"></div>
              <span className="ml-3 text-text-secondary">
                Loading shares...
              </span>
            </div>
          ) : !hasShares ? (
            <div className="text-center py-12">
              <Link2 className="w-16 h-16 text-text-muted mx-auto mb-4" />
              <p className="text-lg font-medium text-text">No Active Shares</p>
              <p className="text-sm text-text-secondary mt-2">
                This file has no active share links or user shares
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Summary */}
              <div className="bg-primary/10 border border-primary/30 rounded-lg p-4">
                <p className="text-sm font-medium text-primary">
                  Total Active Shares: {totalShares}
                </p>
                <p className="text-xs text-text-secondary mt-1">
                  {shareLinks.length} public link(s) • {userShares.length} user
                  share(s)
                </p>
              </div>

              {/* Share Links Section */}
              {shareLinks.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Link2 className="w-5 h-5 text-primary" />
                    <h3 className="text-lg font-semibold text-text">
                      Public Links ({shareLinks.length})
                    </h3>
                  </div>
                  <div className="space-y-3">
                    {shareLinks.map((link) => (
                      <ShareCard
                        key={link.token}
                        share={link}
                        shareType="link"
                        onRevoke={(share) => handleRevoke(share, 'link')}
                        isRevoking={revokingId === link.token}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* User Shares Section */}
              {userShares.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Users className="w-5 h-5 text-primary" />
                    <h3 className="text-lg font-semibold text-text">
                      User Shares ({userShares.length})
                    </h3>
                  </div>
                  <div className="space-y-3">
                    {userShares.map((userShare) => (
                      <ShareCard
                        key={userShare._id}
                        share={userShare}
                        shareType="user"
                        onRevoke={(share) => handleRevoke(share, 'user')}
                        isRevoking={revokingId === userShare._id.toString()}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-6 mt-6 border-t border-border-primary">
          {hasShares && !showConfirmRevokeAll ? (
            <>
              <button
                onClick={() => setShowConfirmRevokeAll(true)}
                disabled={revokingAll || revokingId !== null}
                className="flex items-center gap-2 px-4 py-2 bg-error text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-4 focus:ring-error focus:ring-opacity-30"
              >
                <Trash2 className="w-4 h-4" />
                Revoke All Shares
              </button>
              <button onClick={onClose} className="btn-secondary">
                Close
              </button>
            </>
          ) : hasShares && showConfirmRevokeAll ? (
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2 text-warning">
                <AlertTriangle className="w-5 h-5" />
                <span className="text-sm font-medium">
                  Are you sure? This will revoke all {totalShares} share(s)
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowConfirmRevokeAll(false)}
                  disabled={revokingAll}
                  className="btn-secondary disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRevokeAll}
                  disabled={revokingAll}
                  className="flex items-center gap-2 px-4 py-2 bg-error text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-4 focus:ring-error focus:ring-opacity-30"
                >
                  {revokingAll ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Revoking...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      Confirm Revoke All
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <button onClick={onClose} className="ml-auto btn-secondary">
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
