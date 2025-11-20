/**
 * Files List Page
 * Display and manage files with search, filter, and sort
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Upload,
  Download,
  Share2,
  FileText,
  Loader2,
  FileSearch,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import Navbar from '../components/layout/Navbar';
import ViewSharesModal from '../components/ShareManagement/ViewSharesModal';
import MoveFileModal from '../components/FileManagement/MoveFileModal';
import RenameModal from '../components/FileManagement/RenameModal';
import FileActionsMenu from '../components/FileManagement/FileActionsMenu';
import FileInformationModal from '../components/FileManagement/FileInformationModal';
import { fileAPI } from '../utils/api';
import { formatFileSize, formatDate, formatRelativeTime } from '../utils/auth';

/**
 * Truncate filename in the middle to show beginning and end
 * @param {string} str - Filename to truncate
 * @param {number} maxLength - Maximum length before truncation
 * @returns {string} Truncated filename
 *
 * @example
 * truncateMiddle('very-long-filename-document.pdf', 30)
 * // Returns: 'very-long-f...cument.pdf'
 */
const truncateMiddle = (str, maxLength = 40) => {
  if (!str || str.length <= maxLength) return str;

  // Separate filename and extension
  const lastDotIndex = str.lastIndexOf('.');
  const ext = lastDotIndex !== -1 ? str.substring(lastDotIndex) : '';
  const name = lastDotIndex !== -1 ? str.substring(0, lastDotIndex) : str;

  // If extension itself is too long, truncate at end
  if (ext.length > maxLength - 10) {
    return str.slice(0, maxLength - 3) + '...';
  }

  // Calculate characters to show on each side
  const charsToShow = Math.floor((maxLength - 3 - ext.length) / 2);

  // If name is shorter than needed, return as-is
  if (name.length <= charsToShow * 2) {
    return str;
  }

  return name.slice(0, charsToShow) + '...' + name.slice(-charsToShow) + ext;
};

/**
 * FilesList Component
 * @returns {React.ReactElement} Files list page
 */
export default function FilesList() {
  const { category } = useParams();
  const navigate = useNavigate();

  const [files, setFiles] = useState([]);
  const [filteredFiles, setFilteredFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [availableFileTypes, setAvailableFileTypes] = useState([]);
  const [filters, setFilters] = useState({
    search: '',
    sortBy: 'activity-recent', // Consolidated sort: name-asc, name-desc, activity-recent, activity-oldest, upload-newest, upload-oldest
    fileType: 'all',
  });

  // View Shares Modal state
  const [viewSharesModal, setViewSharesModal] = useState({
    isOpen: false,
    fileId: null,
    filename: null,
  });

  // Move File Modal state
  const [moveFileModal, setMoveFileModal] = useState({
    isOpen: false,
    file: null,
  });

  // File Information Modal state
  const [fileInfoModal, setFileInfoModal] = useState({
    isOpen: false,
    file: null,
  });

  // Rename File Modal state
  const [renameModal, setRenameModal] = useState({
    isOpen: false,
    file: null,
  });

  /**
   * Load files once when category changes
   */
  useEffect(() => {
    loadFiles();
  }, [category]);

  /**
   * Apply filters and sorting whenever files or filters change
   */
  useEffect(() => {
    applyFiltersAndSort();
  }, [files, filters]);

  /**
   * Fetch files from API
   * Loads ALL files for category - filtering/sorting happens on frontend
   */
  const loadFiles = async () => {
    setLoading(true);
    try {
      // Get ALL files by category (no filters - we filter on frontend)
      const response = await fileAPI.getMyFiles(category);
      const filesData = response.data.files || [];

      setFiles(filesData);

      // Extract unique file types for filter dropdown
      const types = [
        ...new Set(filesData.map((f) => f.mimetype).filter(Boolean)),
      ].sort();
      setAvailableFileTypes(types);
    } catch (error) {
      console.error('Failed to load files:', error);
      toast.error('Failed to load files');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Apply search, filter, and sort to files list
   * Filters by filename search and file type, then sorts by selected criteria
   * All operations are compound (applied together)
   */
  const applyFiltersAndSort = () => {
    let result = [...files];

    // 1. Apply search filter
    if (filters.search) {
      result = result.filter((file) =>
        file.filename.toLowerCase().includes(filters.search.toLowerCase())
      );
    }

    // 2. Apply file type filter
    if (filters.fileType && filters.fileType !== 'all') {
      result = result.filter((file) => file.mimetype === filters.fileType);
    }

    // 3. Apply unified sorting
    result.sort((a, b) => {
      switch (filters.sortBy) {
        case 'name-asc':
          return a.filename.localeCompare(b.filename);

        case 'name-desc':
          return b.filename.localeCompare(a.filename);

        case 'activity-recent': {
          const aActivity = a.recentActivity?.timestamp || a.uploadedAt;
          const bActivity = b.recentActivity?.timestamp || b.uploadedAt;
          return new Date(bActivity) - new Date(aActivity);
        }

        case 'activity-oldest': {
          const aActivity = a.recentActivity?.timestamp || a.uploadedAt;
          const bActivity = b.recentActivity?.timestamp || b.uploadedAt;
          return new Date(aActivity) - new Date(bActivity);
        }

        case 'upload-newest':
          return new Date(b.uploadedAt) - new Date(a.uploadedAt);

        case 'upload-oldest':
          return new Date(a.uploadedAt) - new Date(b.uploadedAt);

        default:
          return 0;
      }
    });

    setFilteredFiles(result);
  };

  /**
   * Check if any filters are active (different from defaults)
   * @returns {boolean} True if user has modified search, sort, or filter
   */
  const hasActiveFilters = () => {
    return (
      filters.search !== '' ||
      filters.sortBy !== 'activity-recent' ||
      filters.fileType !== 'all'
    );
  };

  /**
   * Reset all filters to default state
   * Clears search, resets sort to Recent Activity, resets file type to All
   */
  const handleResetFilters = () => {
    setFilters({
      search: '',
      sortBy: 'activity-recent',
      fileType: 'all',
    });
  };

  /**
   * Clear search text only
   * Keeps sort and filter settings intact
   */
  const handleClearSearch = () => {
    setFilters((prev) => ({
      ...prev,
      search: '',
    }));
  };

  /**
   * Format activity action to readable text
   */
  const formatActivityText = (action) => {
    const actionMap = {
      UPLOAD: 'Uploaded',
      DOWNLOAD: 'Downloaded',
      NAME_CHANGE: 'Renamed',
      DELETE: 'Deleted',
      SHARE_CREATED: 'Share Link Created',
      EXPIRED_LINK_ATTEMPT: 'Expired Link Access Attempted',
    };
    return actionMap[action] || action;
  };

  /**
   * Handle file download
   */
  const handleDownload = async (file) => {
    try {
      const response = await fileAPI.getDownloadUrl(file._id);
      const { downloadUrl, shareInfo: updatedShareInfo } = response.data;

      // Open download URL in new tab
      window.open(downloadUrl, '_blank');

      toast.success(`Downloading ${file.filename}`);

      // Update UI for shared files (decrement remaining accesses)
      if (file.shareInfo && updatedShareInfo) {
        setFiles((prevFiles) =>
          prevFiles.map((f) => {
            if (f._id === file._id) {
              // Calculate new remaining accesses
              const newAccessCount = file.shareInfo.accessCount + 1;
              const newRemainingAccesses =
                file.shareInfo.maxAccessCount !== undefined
                  ? Math.max(0, file.shareInfo.maxAccessCount - newAccessCount)
                  : null;

              // Check if now expired
              const isNowExpired =
                (file.shareInfo.maxAccessCount !== undefined &&
                  newAccessCount >= file.shareInfo.maxAccessCount) ||
                (file.shareInfo.expiresAt &&
                  new Date() >= new Date(file.shareInfo.expiresAt));

              return {
                ...f,
                shareInfo: {
                  ...f.shareInfo,
                  accessCount: newAccessCount,
                  remainingAccesses: newRemainingAccesses,
                  isExpired: isNowExpired,
                },
              };
            }
            return f;
          })
        );
      }
    } catch (error) {
      const errorMessage =
        error.response?.data?.error || 'Failed to download file';
      toast.error(errorMessage);
    }
  };

  /**
   * Handle all file actions from menu and buttons
   * @param {string} action - Action type (download, rename, move, share, viewShares, auditLogs, fileInfo, delete)
   * @param {Object} file - File object
   */
  const handleAction = (action, file) => {
    switch (action) {
      case 'download':
        handleDownload(file);
        break;

      case 'rename':
        setRenameModal({
          isOpen: true,
          file: file,
        });
        break;

      case 'move':
        setMoveFileModal({
          isOpen: true,
          file: file,
        });
        break;

      case 'share':
        navigate(`/file/${file._id}/share`);
        break;

      case 'viewShares':
        setViewSharesModal({
          isOpen: true,
          fileId: file._id,
          filename: file.filename,
        });
        break;

      case 'auditLogs':
        navigate(`/file/${file._id}/audit`);
        break;

      case 'fileInfo':
        setFileInfoModal({
          isOpen: true,
          file: file,
        });
        break;

      case 'delete':
        handleDelete(file);
        break;

      default:
        console.error('Unknown action:', action);
    }
  };

  /**
   * Handle filename click (opens file information modal)
   */
  const handleFilenameClick = (file) => {
    setFileInfoModal({
      isOpen: true,
      file: file,
    });
  };

  /**
   * Handle file delete
   */
  const handleDelete = async (file) => {
    // Confirmation dialog
    const confirmed = window.confirm(
      `Are you sure you want to delete "${file.filename}"? This action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      await fileAPI.deleteFile(file._id);
      toast.success('File deleted successfully');
      loadFiles(); // Reload files
    } catch (error) {
      toast.error('Failed to delete file');
    }
  };

  /**
   * Handle file move success
   * @param {string} newCategory - The category the file was moved to
   */
  const handleMoveSuccess = (newCategory) => {
    // If file was moved out of current category, reload files
    // This will remove it from the current view
    loadFiles();
  };

  /**
   * Navigate to upload page
   */
  const handleUploadClick = () => {
    navigate('/upload', { state: { category } });
  };

  /**
   * Get page title based on category
   */
  const getPageTitle = () => {
    if (category === 'shared-with-me') return 'Files Shared to Me';
    return `${category.charAt(0).toUpperCase() + category.slice(1)} Files`;
  };

  /**
   * Get category-specific title styling with futuristic glow
   */
  const getCategoryTitleClass = () => {
    const categoryStyles = {
      Personal: 'category-title-personal',
      Work: 'category-title-work',
      Documents: 'category-title-documents',
      Archive: 'category-title-archive',
      'shared-with-me': 'category-title-shared',
    };
    return categoryStyles[category] || 'text-text';
  };

  return (
    <div className="min-h-screen bg-background-secondary">
      <Navbar />

      <main className="container mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <h1 className={`text-3xl font-bold ${getCategoryTitleClass()}`}>
            {getPageTitle()}
          </h1>

          <button
            onClick={handleUploadClick}
            className="btn-primary flex items-center gap-2 glow-hover-orange"
            aria-label="Upload new file"
          >
            <Upload className="w-[1.125rem] h-[1.125rem]" aria-hidden="true" />
            <span>Upload File</span>
          </button>
        </div>

        {/* Search and Filter Controls - Single Line */}
        <div className="card mb-6">
          {/* Desktop: Single row, Mobile: Stacks */}
          <div className="flex flex-col md:flex-row gap-3 md:gap-4">
            {/* Search Bar - 50% on desktop, full width on mobile */}
            <div className="relative w-full md:w-1/2">
              <input
                type="text"
                placeholder="Search files by name..."
                value={filters.search}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, search: e.target.value }))
                }
                className="input-field pr-10 w-full"
                aria-label="Search files by name"
              />

              {/* Clear Search Button - Only visible when search has text */}
              {filters.search && (
                <button
                  onClick={handleClearSearch}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-text-secondary hover:text-text transition-colors"
                  aria-label="Clear search"
                  type="button"
                >
                  <X className="w-[1.125rem] h-[1.125rem]" />
                </button>
              )}
            </div>

            {/* Sort and Filter Container - 50% on desktop, stacks on mobile */}
            <div className="flex flex-row gap-2 w-full md:w-1/2">
              {/* Sort By - flexible width */}
              <div className="flex-1 flex items-center gap-2">
                <label
                  htmlFor="sort-select"
                  className="text-sm font-medium text-text whitespace-nowrap"
                >
                  Sort:
                </label>
                <select
                  id="sort-select"
                  value={filters.sortBy}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, sortBy: e.target.value }))
                  }
                  className="input-field w-full text-sm"
                  aria-label="Sort files by"
                >
                  <optgroup label="By Name">
                    <option value="name-asc">Name (A to Z)</option>
                    <option value="name-desc">Name (Z to A)</option>
                  </optgroup>
                  <optgroup label="By Activity">
                    <option value="activity-recent">Recent Activity</option>
                    <option value="activity-oldest">Oldest Activity</option>
                  </optgroup>
                  <optgroup label="By Upload Date">
                    <option value="upload-newest">Newest Upload</option>
                    <option value="upload-oldest">Oldest Upload</option>
                  </optgroup>
                </select>
              </div>

              {/* Filter by Type - flexible width */}
              <div className="flex-1 flex items-center gap-2">
                <label
                  htmlFor="type-filter"
                  className="text-sm font-medium text-text whitespace-nowrap"
                >
                  Filter:
                </label>
                <select
                  id="type-filter"
                  value={filters.fileType}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      fileType: e.target.value,
                    }))
                  }
                  className="input-field w-full text-sm"
                  aria-label="Filter by file type"
                >
                  <option value="all">All File Types</option>
                  {availableFileTypes.map((type) => (
                    <option key={type} value={type}>
                      {type.split('/')[1]?.toUpperCase() || type}
                    </option>
                  ))}
                </select>
              </div>

              {/* Reset Filters Button - auto width */}
              <button
                onClick={handleResetFilters}
                disabled={!hasActiveFilters()}
                className="btn-outline text-sm px-3 py-2 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Reset all filters to defaults"
              >
                Reset Filters
              </button>
            </div>
          </div>
        </div>

        {/* Files List */}
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="w-12 h-12 animate-spin text-primary glow-orange" />
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className="card text-center py-16">
            <FileText
              className="w-16 h-16 mx-auto text-text-secondary mb-4"
              aria-hidden="true"
            />
            <h3 className="text-xl font-semibold text-text mb-2">
              No files found
            </h3>
            <p className="text-text-secondary mb-6">
              {category === 'shared-with-me'
                ? 'No files have been shared with you yet'
                : 'Upload your first file to get started'}
            </p>
            {category !== 'shared-with-me' && (
              <button
                onClick={handleUploadClick}
                className="btn-primary glow-hover-orange"
              >
                Upload File
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3" role="list" aria-label="Files">
            {filteredFiles.map((file) => {
              return (
                <div key={file._id} className="card-hover p-3" role="listitem">
                  {/* Grid Layout: Name | Size | Uploaded | Buttons */}
                  <div className="file-card-grid">
                    {/* Column 1: Filename (Clickable, Truncated) */}
                    <div className="min-w-0">
                      <h3
                        onClick={() => handleFilenameClick(file)}
                        className="!text-sm font-semibold text-text cursor-pointer hover:text-primary transition-colors whitespace-nowrap overflow-hidden text-ellipsis"
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleFilenameClick(file);
                          }
                        }}
                        aria-label={`${file.filename} - Click for details`}
                        title={file.filename} // Show full name on hover
                      >
                        {truncateMiddle(file.filename, 40)}
                      </h3>

                      {/* Mobile: Size + Activity + Uploaded below name */}
                      <div className="file-card-grid-mobile-meta md:hidden">
                        <span>
                          <span className="font-medium">Size:</span>{' '}
                          {formatFileSize(file.size)}
                        </span>
                        <span>
                          <span className="font-medium">Activity:</span>{' '}
                          {file.recentActivity
                            ? formatRelativeTime(file.recentActivity.timestamp)
                            : '-'}
                        </span>
                        <span>
                          <span className="font-medium">Uploaded:</span>{' '}
                          {formatRelativeTime(file.uploadedAt)}
                        </span>
                      </div>
                    </div>

                    {/* Column 2: Size (Desktop/Tablet Only) */}
                    <div className="min-w-0 text-sm text-text-secondary hidden md:block whitespace-nowrap overflow-hidden text-ellipsis">
                      <span className="font-medium">Size:</span>{' '}
                      {formatFileSize(file.size)}
                    </div>

                    {/* Column 3: Recent Activity (Desktop/Tablet Only) */}
                    <div className="min-w-0 text-sm text-primary hidden md:block whitespace-nowrap overflow-hidden text-ellipsis">
                      {file.recentActivity ? (
                        <>
                          <span className="font-medium">Activity:</span>{' '}
                          {formatRelativeTime(file.recentActivity.timestamp)}
                        </>
                      ) : (
                        <span className="text-text-secondary">-</span>
                      )}
                    </div>

                    {/* Column 4: Uploaded (Desktop/Tablet Only) */}
                    <div className="min-w-0 text-sm text-text-secondary hidden md:block whitespace-nowrap overflow-hidden text-ellipsis">
                      <span className="font-medium">Uploaded:</span>{' '}
                      {formatRelativeTime(file.uploadedAt)}
                    </div>

                    {/* Column 4: Action Buttons */}
                    <div className="flex gap-2 items-center justify-end flex-wrap">
                      {/* Audit Logs (Primary Blue) - Fixed Width */}
                      <button
                        onClick={() => handleAction('auditLogs', file)}
                        className="btn-primary text-sm h-9 w-36 flex items-center justify-center gap-1"
                        aria-label={`View audit logs for ${file.filename}`}
                      >
                        <FileSearch className="w-4 h-4" aria-hidden="true" />
                        <span className="hidden sm:inline">Audit Logs</span>
                      </button>

                      {/* Share (Outline) - Fixed Width */}
                      <button
                        onClick={() => handleAction('share', file)}
                        className="btn-outline text-sm h-9 w-36 flex items-center justify-center gap-1"
                        aria-label={`Share ${file.filename}`}
                      >
                        <Share2 className="w-4 h-4" aria-hidden="true" />
                        <span className="hidden sm:inline">Share</span>
                      </button>

                      {/* Download (Secondary Gray) - Fixed Width */}
                      <button
                        onClick={() => handleAction('download', file)}
                        className="btn-secondary text-sm h-9 w-36 flex items-center justify-center gap-1"
                        aria-label={`Download ${file.filename}`}
                      >
                        <Download className="w-4 h-4" aria-hidden="true" />
                        <span className="hidden sm:inline">Download</span>
                      </button>

                      {/* 3-Dots Menu - Square Button */}
                      <FileActionsMenu file={file} onAction={handleAction} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* View Shares Modal */}
      <ViewSharesModal
        isOpen={viewSharesModal.isOpen}
        onClose={() =>
          setViewSharesModal({
            isOpen: false,
            fileId: null,
            filename: null,
          })
        }
        fileId={viewSharesModal.fileId}
        filename={viewSharesModal.filename}
        onRevokeSuccess={() => {
          // Optionally reload files after revoke
          loadFiles();
        }}
      />

      {/* Move File Modal */}
      <MoveFileModal
        isOpen={moveFileModal.isOpen}
        onClose={() =>
          setMoveFileModal({
            isOpen: false,
            file: null,
          })
        }
        file={moveFileModal.file}
        onMoveSuccess={handleMoveSuccess}
      />

      {/* File Information Modal */}
      <FileInformationModal
        isOpen={fileInfoModal.isOpen}
        onClose={() =>
          setFileInfoModal({
            isOpen: false,
            file: null,
          })
        }
        file={fileInfoModal.file}
      />

      {/* Rename File Modal */}
      <RenameModal
        isOpen={renameModal.isOpen}
        onClose={() =>
          setRenameModal({
            isOpen: false,
            file: null,
          })
        }
        file={renameModal.file}
        onRenameSuccess={() => {
          loadFiles(); // Refresh file list
          toast.success('File renamed successfully');
        }}
      />
    </div>
  );
}
