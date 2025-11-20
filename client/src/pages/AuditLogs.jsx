/**
 * Audit Logs Page
 * View comprehensive audit trail for a specific file
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Loader2,
  FileText,
  Activity,
  Info,
  RotateCcw,
} from 'lucide-react';
import { toast } from 'sonner';
import Navbar from '../components/layout/Navbar';
import AuditLogDetailsModal from '../components/AuditLogs/AuditLogDetailsModal';
import { fileAPI, auditAPI } from '../utils/api';
import { formatDate } from '../utils/auth';

/**
 * Get action type badge styling (Modern Earth light mode)
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
      label: 'Expired Link',
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
 * AuditLogs Component
 * @returns {React.ReactElement} Audit logs page
 */
export default function AuditLogs() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [file, setFile] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortOrder, setSortOrder] = useState('desc'); // 'asc' or 'desc'
  const [filterActivity, setFilterActivity] = useState('all'); // Filter by action type
  const [detailsModal, setDetailsModal] = useState({
    isOpen: false,
    log: null,
  });

  /**
   * Load file and audit logs on mount
   */
  useEffect(() => {
    loadFileAndLogs();
  }, [id]);

  /**
   * Fetch file details and audit logs
   */
  const loadFileAndLogs = async () => {
    setLoading(true);
    try {
      // Load file details
      const filesResponse = await fileAPI.getFileDetails(id);
      const fileData = filesResponse.data.file;

      if (!fileData) {
        toast.error('File not found');
        navigate('/dashboard');
        return;
      }

      setFile(fileData);

      // Load audit logs
      const logsResponse = await auditAPI.getFileAuditLogs(id);
      setLogs(logsResponse.data.logs || []);
    } catch (error) {
      console.error('Failed to load audit logs:', error);
      toast.error('Failed to load audit logs');
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle sort toggle
   */
  const handleSortToggle = () => {
    setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'));
  };

  /**
   * Get unique action types from logs for filter dropdown
   */
  const getUniqueActionTypes = () => {
    const actionTypes = [...new Set(logs.map((log) => log.action))];
    return actionTypes.sort();
  };

  /**
   * Get filtered and sorted logs (compound filtering)
   */
  const getFilteredAndSortedLogs = () => {
    // First, filter by action type
    let filtered = logs;
    if (filterActivity !== 'all') {
      filtered = logs.filter((log) => log.action === filterActivity);
    }

    // Then, sort by timestamp
    const sorted = [...filtered].sort((a, b) => {
      const dateA = new Date(a.timestamp);
      const dateB = new Date(b.timestamp);
      return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });

    return sorted;
  };

  /**
   * Reset all filters to default
   */
  const handleResetFilters = () => {
    setSortOrder('desc');
    setFilterActivity('all');
  };

  /**
   * Open details modal for a log entry
   */
  const handleOpenDetails = (log) => {
    setDetailsModal({ isOpen: true, log });
  };

  /**
   * Close details modal
   */
  const handleCloseDetails = () => {
    setDetailsModal({ isOpen: false, log: null });
  };

  /**
   * Handle back button
   */
  const handleBack = () => {
    navigate(`/files/${file.category}`);
  };

  // Loading State
  if (loading) {
    return (
      <div className="min-h-screen bg-bg-primary">
        <Navbar />
        <main className="container mx-auto px-4 py-8">
          <div className="flex justify-center items-center py-20">
            <Loader2
              className="w-12 h-12 animate-spin text-primary glow-orange"
              aria-hidden="true"
            />
          </div>
        </main>
      </div>
    );
  }

  // File not found (shouldn't reach here due to redirect)
  if (!file) {
    return null;
  }

  const filteredLogs = getFilteredAndSortedLogs();
  const uniqueActionTypes = getUniqueActionTypes();

  return (
    <div className="min-h-screen bg-bg-primary">
      <Navbar />

      <main className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={handleBack}
            className="btn-secondary flex items-center justify-center w-10 h-10 p-0"
            aria-label="Go back"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-text">Audit Logs</h1>
            <p className="text-text-secondary mt-1">
              Complete activity history for{' '}
              <strong className="text-text">{file.filename}</strong>
            </p>
          </div>
        </div>

        {/* File Info Card */}
        <div className="card mb-6">
          <div className="flex items-start gap-4 mb-3">
            <FileText
              className="w-12 h-12 text-primary flex-shrink-0"
              aria-hidden="true"
            />
            <div className="flex-1 min-w-0">
              {/* File Header Grid: Filename | Uploaded | Total Actions */}
              <div className="file-header-grid mb-2">
                <h2
                  className="text-xl font-bold text-text whitespace-nowrap overflow-hidden text-ellipsis"
                  title={file.filename}
                >
                  {file.filename}
                </h2>
                <span className="text-sm text-text-secondary whitespace-nowrap">
                  <strong className="text-text">Uploaded:</strong>{' '}
                  {formatDate(file.uploadedAt)}
                </span>
                <span className="text-sm text-text-secondary whitespace-nowrap">
                  <strong className="text-text">Total Actions:</strong>{' '}
                  {logs.length}
                </span>
              </div>
              {/* Description (if present) */}
              {file.description && (
                <p className="text-text-secondary text-sm">
                  {file.description}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Filter Controls - Full Width Distribution */}
        <div className="card mb-6">
          <div className="flex flex-row gap-2 w-full">
            {/* Results Count - flexible width */}
            <div className="flex-1 flex items-center">
              <span className="text-sm text-text-secondary whitespace-nowrap">
                Showing {filteredLogs.length} of {logs.length} log
                {logs.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Sort Dropdown - flexible width */}
            <div className="flex-1 flex items-center gap-2">
              <label
                htmlFor="sort-order"
                className="text-sm font-medium text-text whitespace-nowrap"
              >
                Sort:
              </label>
              <select
                id="sort-order"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className="input-field w-full text-sm"
                aria-label="Sort audit logs"
              >
                <option value="desc">Newest First</option>
                <option value="asc">Oldest First</option>
              </select>
            </div>

            {/* Filter by Activity Dropdown - flexible width */}
            <div className="flex-1 flex items-center gap-2">
              <label
                htmlFor="filter-activity"
                className="text-sm font-medium text-text whitespace-nowrap"
              >
                Filter by:
              </label>
              <select
                id="filter-activity"
                value={filterActivity}
                onChange={(e) => setFilterActivity(e.target.value)}
                className="input-field w-full text-sm"
                aria-label="Filter by activity type"
              >
                <option value="all">All Activities</option>
                {uniqueActionTypes.map((actionType) => {
                  const badge = getActionBadge(actionType);
                  return (
                    <option key={actionType} value={actionType}>
                      {badge.label}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Reset Filters Button - auto width */}
            <button
              onClick={handleResetFilters}
              disabled={sortOrder === 'desc' && filterActivity === 'all'}
              className="btn-outline text-sm px-3 py-2 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Reset all filters to defaults"
            >
              Reset Filters
            </button>
          </div>
        </div>

        {/* Audit Logs Card Grid */}
        <div className="card">
          <h3 className="text-lg font-semibold text-text mb-4">
            Activity Timeline
          </h3>

          {logs.length === 0 ? (
            /* Empty State */
            <div className="text-center py-12">
              <Activity
                className="w-12 h-12 mx-auto text-text-secondary mb-3"
                aria-hidden="true"
              />
              <p className="text-text-secondary">
                No audit logs found for this file
              </p>
            </div>
          ) : filteredLogs.length === 0 ? (
            /* No Results from Filter */
            <div className="text-center py-12">
              <Activity
                className="w-12 h-12 mx-auto text-text-secondary mb-3"
                aria-hidden="true"
              />
              <p className="text-text mb-2">No logs match the current filter</p>
              <button
                onClick={handleResetFilters}
                className="btn-primary text-sm"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            /* Logs Card Grid */
            <div className="space-y-3" role="list" aria-label="Audit logs">
              {filteredLogs.map((log, index) => {
                const badge = getActionBadge(log.action);

                return (
                  <div
                    key={log._id || index}
                    className="card-hover p-3"
                    role="listitem"
                  >
                    {/* Desktop Grid Layout */}
                    <div className="audit-log-grid">
                      {/* Column 1: Action Badge (Left Aligned in 1fr column) */}
                      <div className="flex justify-start">
                        <span
                          className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${badge.bg} ${badge.text}`}
                        >
                          <Activity
                            className="w-3.5 h-3.5"
                            aria-hidden="true"
                          />
                          {badge.label}
                        </span>
                      </div>

                      {/* Column 2: Date/Time (Centered auto column, Desktop/Tablet Only) */}
                      <div className="text-sm text-text-secondary text-center hidden md:block whitespace-nowrap">
                        {formatDate(log.timestamp)}
                      </div>

                      {/* Column 3: Details Button (Right Aligned in 1fr column) */}
                      <div className="flex justify-end">
                        <button
                          onClick={() => handleOpenDetails(log)}
                          className="btn-outline text-sm px-3 py-1.5 flex items-center gap-1"
                          aria-label={`View details for ${badge.label} action`}
                        >
                          <Info className="w-4 h-4" aria-hidden="true" />
                          <span className="hidden sm:inline">Details</span>
                        </button>
                      </div>

                      {/* Mobile: Date/Time below action badge */}
                      <div className="audit-log-grid-mobile-meta md:hidden">
                        <span className="text-text-secondary">
                          <strong className="text-text">Date/Time:</strong>{' '}
                          {formatDate(log.timestamp)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Info Banner */}
        <div className="mt-6 p-4 bg-primary/10 border border-primary/30 rounded-lg">
          <h3 className="font-semibold text-primary mb-2">About Audit Logs:</h3>
          <ul className="list-disc list-inside text-sm text-text-secondary space-y-1">
            <li>
              Every action performed on this file is logged with timestamp and
              IP address
            </li>
            <li>
              Logs include uploads, downloads, renames, category changes,
              shares, and access attempts
            </li>
            <li>
              Audit logs help you track file usage and maintain security
              compliance
            </li>
            <li>Logs are permanent and cannot be deleted or modified</li>
          </ul>
        </div>
      </main>

      {/* Audit Log Details Modal */}
      {detailsModal.isOpen && (
        <AuditLogDetailsModal
          isOpen={detailsModal.isOpen}
          onClose={handleCloseDetails}
          log={detailsModal.log}
        />
      )}
    </div>
  );
}
