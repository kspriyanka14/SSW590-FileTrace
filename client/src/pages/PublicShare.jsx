/**
 * Public Share Page
 * Access shared files via public link (no authentication required)
 */

import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { FileText, Download, Lock, Loader2, Home } from 'lucide-react';
import { toast } from 'sonner';
import { shareAPI } from '../utils/api';
import { formatFileSize, formatDate } from '../utils/auth';

/**
 * PublicShare Component
 * @returns {React.ReactElement} Public share access page
 */
export default function PublicShare() {
  const { token } = useParams();

  const [file, setFile] = useState(null);
  const [shareInfo, setShareInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');

  // Prevent duplicate API calls in React StrictMode
  const hasLoadedRef = useRef(false);

  /**
   * Load shared file on mount
   */
  useEffect(() => {
    if (token && !hasLoadedRef.current) {
      hasLoadedRef.current = true;
      loadShare();
    }
  }, [token]);

  /**
   * Fetch shared file data (view only, no download)
   */
  const loadShare = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await shareAPI.getShareByToken(token);
      const { file: fileData, share } = response.data;

      setFile(fileData);
      setShareInfo(share);

      toast.success('File loaded successfully');
    } catch (err) {
      const errorMessage =
        err.response?.data?.error || 'Failed to load shared file';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle file download (increments access count and logs download)
   */
  const handleDownload = async () => {
    if (downloading) return; // Prevent duplicate clicks

    setDownloading(true);

    try {
      const response = await shareAPI.downloadSharedFile(token);
      const { downloadUrl, remainingAccesses } = response.data;

      // Update remaining accesses in UI
      if (remainingAccesses !== null && shareInfo) {
        setShareInfo({
          ...shareInfo,
          accessCount: shareInfo.accessCount + 1,
        });
      }

      // Open download URL
      window.open(downloadUrl, '_blank');
      toast.success(`Downloading ${file.filename}`);
    } catch (err) {
      const errorMessage =
        err.response?.data?.error || 'Failed to download file';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setDownloading(false);
    }
  };

  // Loading State
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-bg-primary via-bg-secondary to-bg-tertiary flex items-center justify-center p-4">
        <div className="card max-w-md text-center">
          <Loader2
            className="w-12 h-12 animate-spin text-primary mx-auto mb-4 glow-orange"
            aria-hidden="true"
          />
          <p className="text-lg text-text">Loading shared file...</p>
        </div>
      </div>
    );
  }

  // Error State
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-bg-primary via-bg-secondary to-bg-tertiary flex items-center justify-center p-4">
        <div className="card max-w-md fade-in">
          <div className="text-center">
            <Lock
              className="w-16 h-16 text-error mx-auto mb-4"
              aria-hidden="true"
            />
            <h2 className="text-2xl font-bold text-text mb-4">Access Denied</h2>
            <div
              className="bg-error/10 border border-error/30 text-error p-3 rounded-lg mb-6"
              role="alert"
            >
              {error}
            </div>
            <p className="text-text-secondary mb-6">
              This link may have expired or reached its maximum number of
              accesses.
            </p>
            <Link
              to="/"
              className="btn-primary inline-flex items-center gap-2 glow-hover-orange"
            >
              <Home className="w-[1.125rem] h-[1.125rem]" aria-hidden="true" />
              <span>Go to FileTrace</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Success State - Display File
  return (
    <div className="min-h-screen bg-gradient-to-br from-bg-primary via-bg-secondary to-bg-tertiary flex items-center justify-center p-4">
      <div className="card max-w-2xl w-full slide-in">
        {/* Header */}
        <div className="text-center mb-6">
          <FileText
            className="w-16 h-16 text-primary mx-auto mb-4"
            aria-hidden="true"
          />
          <h1 className="text-3xl font-bold text-text mb-2">Shared File</h1>
          <p className="text-text-secondary">
            Someone shared this file with you
          </p>
        </div>

        {/* File Information */}
        <div className="space-y-4 mb-6">
          {/* Filename */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              Filename
            </label>
            <p className="text-lg font-semibold text-text">{file.filename}</p>
          </div>

          {/* Description */}
          {file.description && (
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">
                Description
              </label>
              <p className="text-text">{file.description}</p>
            </div>
          )}

          {/* File Details Grid */}
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">
                File Size
              </label>
              <p className="text-text font-medium">
                {formatFileSize(file.size)}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">
                File Type
              </label>
              <p className="text-text font-medium">
                {file.mimetype || 'Unknown'}
              </p>
            </div>

            {shareInfo?.maxAccessCount && (
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  Remaining Accesses
                </label>
                <p className="text-text font-medium">
                  {shareInfo.maxAccessCount - shareInfo.accessCount} /{' '}
                  {shareInfo.maxAccessCount}
                </p>
              </div>
            )}

            {shareInfo?.expiresAt && (
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  Expires
                </label>
                <p className="text-text font-medium">
                  {formatDate(shareInfo.expiresAt)}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Download Button */}
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="btn-primary w-full flex items-center justify-center gap-2 text-lg py-3 glow-hover-orange"
          aria-label={
            downloading ? 'Downloading...' : `Download ${file.filename}`
          }
        >
          {downloading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
              <span>Downloading...</span>
            </>
          ) : (
            <>
              <Download className="w-5 h-5" aria-hidden="true" />
              <span>Download File</span>
            </>
          )}
        </button>

        {/* Footer */}
        <div className="mt-6 pt-6 border-t border-border-primary text-center">
          <p className="text-text-secondary text-sm mb-2">
            This file was shared using FileTrace
          </p>
          <Link
            to="/"
            className="text-primary hover:text-accent-light font-medium transition-colors focus:outline-none focus:underline"
          >
            Create your own FileTrace account
          </Link>
        </div>
      </div>
    </div>
  );
}
