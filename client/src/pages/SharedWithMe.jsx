/**
 * SharedWithMe Page
 * Displays files that have been shared with the current user
 * Shows: File Name, Shared By, Size, Downloads Left, Expires, Download/Status
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Users, Loader2, X } from 'lucide-react';
import Navbar from '../components/layout/Navbar';
import SharedFileDetailsModal from '../components/ShareManagement/SharedFileDetailsModal';
import { shareAPI, fileAPI, getErrorMessage } from '../utils/api';
import {
  formatFileSize,
  formatRelativeTime,
  formatDate,
  getUser,
} from '../utils/auth';
import { toast } from 'sonner';

/**
 * Truncate filename in the middle to preserve extension
 */
const truncateMiddle = (str, maxLength = 40) => {
  if (!str || str.length <= maxLength) return str;

  // Separate filename and extension
  const lastDotIndex = str.lastIndexOf('.');
  const ext = lastDotIndex !== -1 ? str.substring(lastDotIndex) : '';
  const name = lastDotIndex !== -1 ? str.substring(0, lastDotIndex) : str;

  // If extension is too long, just truncate normally
  if (ext.length > 10) {
    return str.slice(0, maxLength - 3) + '...';
  }

  // Calculate characters to show on each side
  const charsToShow = Math.floor((maxLength - 3 - ext.length) / 2);

  return name.slice(0, charsToShow) + '...' + name.slice(-charsToShow) + ext;
};

/**
 * SharedWithMe Component
 * @returns {React.ReactElement} Shared files page
 */
export default function SharedWithMe() {
  const navigate = useNavigate();
  const [files, setFiles] = useState([]);
  const [filteredFiles, setFilteredFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [detailsModal, setDetailsModal] = useState({
    isOpen: false,
    file: null,
  });

  /**
   * Load files shared with the current user
   */
  useEffect(() => {
    const user = getUser();
    if (!user) {
      navigate('/login');
      return;
    }

    loadSharedFiles();
  }, [navigate]);

  /**
   * Fetch shared files from API
   */
  const loadSharedFiles = async () => {
    try {
      setLoading(true);
      const response = await shareAPI.getSharedWithMe();

      // Normalize data structure: attach share info to file object
      const filesData = (response.data.files || [])
        .filter((item) => item.file !== null) // Filter out deleted files
        .map((item) => ({
          ...item.file,
          shareInfo: item.share, // Attach share metadata
        }));

      setFiles(filesData);
      setFilteredFiles(filesData);
    } catch (error) {
      console.error('Load shared files error:', error);
      toast.error(getErrorMessage(error) || 'Failed to load shared files');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle search input change
   */
  const handleSearch = (query) => {
    setSearchQuery(query);

    if (!query.trim()) {
      setFilteredFiles(files);
      return;
    }

    const filtered = files.filter((file) =>
      file.filename.toLowerCase().includes(query.toLowerCase())
    );

    setFilteredFiles(filtered);
  };

  /**
   * Clear search
   */
  const handleClearSearch = () => {
    setSearchQuery('');
    setFilteredFiles(files);
  };

  /**
   * Handle file download
   */
  const handleDownload = async (file) => {
    try {
      const response = await fileAPI.downloadFile(file._id);
      const url = response.data.url;

      // Open pre-signed URL in new window
      window.location.href = url;

      toast.success('Download started');

      // Refresh file list to update access counts
      setTimeout(() => {
        loadSharedFiles();
      }, 1000);
    } catch (error) {
      console.error('Download error:', error);
      toast.error(getErrorMessage(error) || 'Failed to download file');
    }
  };

  /**
   * Open file details modal
   */
  const handleFilenameClick = (file) => {
    setDetailsModal({ isOpen: true, file });
  };

  /**
   * Close file details modal
   */
  const handleCloseDetailsModal = () => {
    setDetailsModal({ isOpen: false, file: null });
  };

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Navigation Bar */}
      <Navbar />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-7xl" id="main-content">
        {/* Skip to main content link (accessibility) */}
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>

        {/* Page Header */}
        <div className="mb-8 fade-in">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-lg bg-gradient-shared flex items-center justify-center">
              <Users
                className="w-6 h-6 text-white icon-glow-shared"
                aria-hidden="true"
              />
            </div>
            <h1 className="text-4xl font-bold category-title-shared">
              Files Shared to Me
            </h1>
          </div>
          <p className="text-text-secondary text-lg">
            Files that other users have shared with you
          </p>
        </div>

        {/* Search Bar - Full Width */}
        <div className="card mb-6">
          <div className="relative w-full">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search files by name..."
              className="input-field pr-10 w-full"
              aria-label="Search files by name"
            />
            {searchQuery && (
              <button
                onClick={handleClearSearch}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-text-secondary hover:text-text transition-colors"
                aria-label="Clear search"
                type="button"
              >
                <X className="w-[1.125rem] h-[1.125rem]" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        {/* Files List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <Loader2
                className="w-12 h-12 text-primary animate-spin mx-auto mb-4"
                aria-hidden="true"
              />
              <p className="text-text-secondary">Loading shared files...</p>
            </div>
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className="card text-center py-16">
            <Users
              className="w-16 h-16 text-text-muted mx-auto mb-4"
              aria-hidden="true"
            />
            {searchQuery ? (
              <>
                <h2 className="text-2xl font-bold text-text mb-2">
                  No files found
                </h2>
                <p className="text-text-secondary mb-4">
                  No files match your search query &quot;{searchQuery}&quot;
                </p>
                <button onClick={handleClearSearch} className="btn-primary">
                  Clear Search
                </button>
              </>
            ) : (
              <>
                <h2 className="text-2xl font-bold text-text mb-2">
                  No shared files yet
                </h2>
                <p className="text-text-secondary">
                  Files shared with you by other users will appear here
                </p>
              </>
            )}
          </div>
        ) : (
          <>
            {/* Results Count */}
            <div className="mb-4 text-sm text-text-secondary">
              {searchQuery && (
                <p>
                  Found {filteredFiles.length} of {files.length} file
                  {filteredFiles.length !== 1 ? 's' : ''}
                </p>
              )}
              {!searchQuery && (
                <p>
                  {files.length} shared file{files.length !== 1 ? 's' : ''}
                </p>
              )}
            </div>

            {/* File Cards - NO COLUMN HEADERS */}
            <div className="space-y-3" role="list" aria-label="Shared files">
              {filteredFiles.map((file) => {
                const isExpired = file.shareInfo?.isExpired || false;
                const cardClass = isExpired
                  ? 'card-hover p-3 file-card-expired'
                  : 'card-hover p-3';

                return (
                  <div key={file._id} className={cardClass} role="listitem">
                    {/* Desktop Grid Layout */}
                    <div className="shared-file-grid">
                      {/* Column 1: Filename + Mobile Metadata */}
                      <div>
                        <h3
                          onClick={() =>
                            !isExpired && handleFilenameClick(file)
                          }
                          className={`!text-sm font-semibold text-text transition-colors whitespace-nowrap overflow-hidden text-ellipsis ${
                            !isExpired
                              ? 'cursor-pointer hover:text-primary'
                              : 'cursor-default'
                          }`}
                          title={file.filename}
                        >
                          {truncateMiddle(file.filename, 40)}
                        </h3>

                        {/* Mobile: Metadata below name */}
                        <div className="shared-file-grid-mobile-meta md:hidden">
                          <span>
                            <span className="font-medium">Shared by:</span>{' '}
                            {file.shareInfo?.ownerUsername || 'Unknown'}
                          </span>
                          <span>
                            <span className="font-medium">Size:</span>{' '}
                            {formatFileSize(file.size)}
                          </span>
                          <span>
                            <span className="font-medium">Downloads left:</span>{' '}
                            {file.shareInfo?.remainingAccesses !== null &&
                            file.shareInfo?.remainingAccesses !== undefined
                              ? file.shareInfo.remainingAccesses
                              : 'Unlimited'}
                          </span>
                          <span>
                            <span className="font-medium">Expires:</span>{' '}
                            {file.shareInfo?.expiresAt
                              ? formatDate(file.shareInfo.expiresAt)
                              : '-'}
                          </span>
                        </div>
                      </div>

                      {/* Column 2: Shared By (Desktop/Tablet Only) */}
                      <div className="min-w-0 text-sm text-text-secondary hidden md:block whitespace-nowrap overflow-hidden text-ellipsis">
                        <span className="font-medium">Shared by:</span>{' '}
                        {file.shareInfo?.ownerUsername || 'Unknown'}
                      </div>

                      {/* Column 3: Size (Desktop/Tablet Only) */}
                      <div className="min-w-0 text-sm text-text-secondary hidden md:block whitespace-nowrap overflow-hidden text-ellipsis">
                        <span className="font-medium">Size:</span>{' '}
                        {formatFileSize(file.size)}
                      </div>

                      {/* Column 4: Downloads Left (Desktop/Tablet Only) */}
                      <div
                        className={`min-w-0 text-sm hidden md:block whitespace-nowrap overflow-hidden text-ellipsis ${
                          file.shareInfo?.remainingAccesses === 0
                            ? 'text-error font-medium'
                            : 'text-text-secondary'
                        }`}
                      >
                        <span className="font-medium">Downloads left:</span>{' '}
                        {file.shareInfo?.remainingAccesses !== null &&
                        file.shareInfo?.remainingAccesses !== undefined
                          ? file.shareInfo.remainingAccesses
                          : 'Unlimited'}
                      </div>

                      {/* Column 5: Expires (Desktop/Tablet Only) */}
                      <div className="min-w-0 text-sm text-text-secondary hidden md:block whitespace-nowrap overflow-hidden text-ellipsis">
                        <span className="font-medium">Expires:</span>{' '}
                        {file.shareInfo?.expiresAt
                          ? formatDate(file.shareInfo.expiresAt)
                          : '-'}
                      </div>

                      {/* Column 6: Action Buttons */}
                      <div className="flex gap-2 items-center justify-end flex-wrap">
                        {isExpired ? (
                          <div className="text-sm h-9 w-36 flex items-center justify-center rounded-lg bg-error/10 border border-error/30">
                            <span className="text-error font-medium">
                              EXPIRED
                            </span>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleDownload(file)}
                            className="btn-primary text-sm h-9 w-36 flex items-center justify-center gap-1"
                            aria-label={`Download ${file.filename}`}
                          >
                            <Download className="w-4 h-4" aria-hidden="true" />
                            <span className="hidden sm:inline">Download</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </main>

      {/* File Details Modal */}
      {detailsModal.isOpen && (
        <SharedFileDetailsModal
          isOpen={detailsModal.isOpen}
          onClose={handleCloseDetailsModal}
          file={detailsModal.file}
        />
      )}
    </div>
  );
}
