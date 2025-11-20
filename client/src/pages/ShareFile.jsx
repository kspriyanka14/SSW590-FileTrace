/**
 * Share File Page
 * Create shareable links or share with specific users
 */

import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Share2,
  ArrowLeft,
  Loader2,
  Link as LinkIcon,
  User,
  Copy,
  CheckCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import Navbar from '../components/layout/Navbar';
import { fileAPI, shareAPI } from '../utils/api';
import { shareSchema, extractValidationErrors } from '../utils/validation';
import { copyToClipboard } from '../utils/auth';

/**
 * ShareFile Component
 * @returns {React.ReactElement} Share file page
 */
export default function ShareFile() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const isCreatingRef = useRef(false); // Synchronous blocking for duplicate prevention
  const [shareCreated, setShareCreated] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const [copied, setCopied] = useState(false);

  // Form state
  const [shareType, setShareType] = useState('link'); // 'user' or 'link'
  const [recipientIdentifier, setRecipientIdentifier] = useState('');

  // Expiration method: 'duration' or 'date'
  const [expirationMethod, setExpirationMethod] = useState('duration');

  // Duration-based expiration (number + unit)
  const [expirationInput, setExpirationInput] = useState('');
  const [expirationUnit, setExpirationUnit] = useState('hours'); // 'minutes', 'hours', 'days', 'weeks'

  // Date-based expiration
  const [expirationDate, setExpirationDate] = useState('');

  const [maxAccessCount, setMaxAccessCount] = useState('');
  const [errors, setErrors] = useState({});

  /**
   * Load file details on mount
   */
  useEffect(() => {
    loadFile();
  }, [id]);

  /**
   * Fetch file details
   */
  const loadFile = async () => {
    setLoading(true);
    try {
      const response = await fileAPI.getFileDetails(id);
      const fileData = response.data.file;

      if (!fileData) {
        toast.error('File not found');
        navigate('/dashboard');
        return;
      }

      setFile(fileData);
    } catch (error) {
      console.error('Failed to load file:', error);
      toast.error('Failed to load file');
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Convert user input to minutes
   * Handles both duration (number + unit) and date selection
   * @returns {number|undefined} Minutes from now, or undefined if no expiration set
   */
  const convertToMinutes = () => {
    if (expirationMethod === 'duration') {
      const value = parseInt(expirationInput, 10);
      if (isNaN(value) || value <= 0) return undefined;

      const multipliers = {
        minutes: 1,
        hours: 60,
        days: 1440, // 24 * 60
        weeks: 10080, // 7 * 24 * 60
      };

      return value * multipliers[expirationUnit];
    } else if (expirationMethod === 'date') {
      if (!expirationDate) return undefined;

      const selectedDate = new Date(expirationDate);
      const now = new Date();
      const diffMs = selectedDate - now;
      const diffMinutes = Math.floor(diffMs / 60000); // Convert milliseconds to minutes

      return diffMinutes > 0 ? diffMinutes : undefined;
    }

    return undefined;
  };

  /**
   * Validate that the expiration time is within allowed range (10 min - 1 year)
   * @param {number|undefined} minutes - Minutes to validate
   * @returns {boolean} true if valid, false if invalid
   */
  const validateExpirationRange = (minutes) => {
    if (minutes === undefined) return true; // Optional field

    if (minutes < 10) {
      setErrors((prev) => ({
        ...prev,
        expiration: 'Minimum expiration is 10 minutes',
      }));
      return false;
    }

    if (minutes > 525960) {
      setErrors((prev) => ({
        ...prev,
        expiration: 'Maximum expiration is 1 year (525960 minutes)',
      }));
      return false;
    }

    return true;
  };

  /**
   * Validate date selection (must be future and within 1 year)
   * @param {string} dateString - Date string from datetime-local input
   * @returns {boolean} true if valid, false if invalid
   */
  const validateDateSelection = (dateString) => {
    if (!dateString) return true; // Optional

    const selectedDate = new Date(dateString);
    const now = new Date();
    const oneYearFromNow = new Date(now.getTime() + 525960 * 60000); // 1 year in milliseconds

    if (selectedDate <= now) {
      setErrors((prev) => ({
        ...prev,
        expirationDate: 'Date must be in the future',
      }));
      return false;
    }

    if (selectedDate > oneYearFromNow) {
      setErrors((prev) => ({
        ...prev,
        expirationDate: 'Date cannot be more than 1 year from now',
      }));
      return false;
    }

    return true;
  };

  /**
   * Handle share creation
   */
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Prevent multiple submissions (check ref for synchronous blocking)
    if (isCreatingRef.current) {
      return;
    }

    // Set ref immediately (synchronous - blocks next click instantly)
    isCreatingRef.current = true;

    // Set creating state for UI updates (async - triggers re-render)
    setCreating(true);

    setErrors({});

    // Convert user input to minutes
    const expirationMinutes = convertToMinutes();

    // Validate expiration range (10 min - 1 year)
    if (!validateExpirationRange(expirationMinutes)) {
      isCreatingRef.current = false;
      setCreating(false);
      return;
    }

    // Prepare data for validation
    const shareData = {
      shareType,
      recipientIdentifier:
        shareType === 'user' ? recipientIdentifier.trim() : undefined,
      expirationMinutes,
      maxAccessCount: maxAccessCount ? parseInt(maxAccessCount, 10) : undefined,
    };

    // Validate with Zod
    const result = shareSchema.safeParse(shareData);

    if (!result.success) {
      setErrors(extractValidationErrors(result.error));
      isCreatingRef.current = false;
      setCreating(false);
      return;
    }

    // Additional validation: at least one expiration method
    if (!shareData.expirationMinutes && !shareData.maxAccessCount) {
      setErrors({
        general:
          'Please set at least one expiration method (time limit or access count)',
      });
      isCreatingRef.current = false;
      setCreating(false);
      return;
    }

    // For user share, ensure recipient is provided
    if (shareType === 'user' && !recipientIdentifier.trim()) {
      setErrors({ recipientIdentifier: 'Please enter username or email' });
      isCreatingRef.current = false;
      setCreating(false);
      return;
    }

    try {
      // Create share via API
      const response = await shareAPI.createShare({
        fileId: id,
        ...shareData,
      });

      const { share } = response.data;

      // Store share link
      if (shareData.shareType === 'link' && share.shareUrl) {
        setShareLink(share.shareUrl);
        setShareCreated(true);
        toast.success('Shareable link created successfully!');
      } else if (shareData.shareType === 'user') {
        toast.success(`File shared with ${recipientIdentifier} successfully!`);
        // Redirect back to files list after a brief delay
        setTimeout(() => {
          navigate(`/files/${file.category}`);
        }, 1500);
      }
    } catch (error) {
      const errorMessage =
        error.response?.data?.error || 'Failed to create share';
      toast.error(errorMessage);
    } finally {
      isCreatingRef.current = false;
      setCreating(false);
    }
  };

  /**
   * Handle copy link to clipboard
   */
  const handleCopyLink = async () => {
    const success = await copyToClipboard(shareLink);
    if (success) {
      setCopied(true);
      toast.success('Link copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast.error('Failed to copy link');
    }
  };

  /**
   * Handle cancel button
   */
  const handleCancel = () => {
    navigate(`/files/${file.category}`);
  };

  /**
   * Reset form after successful share creation
   */
  const handleCreateAnother = () => {
    setShareCreated(false);
    setShareLink('');
    setRecipientIdentifier('');
    setExpirationHours('');
    setMaxAccessCount('');
    setCopied(false);
  };

  // Loading State
  if (loading) {
    return (
      <div className="min-h-screen bg-bg-primary">
        <Navbar />
        <main className="container mx-auto px-4 py-8 max-w-2xl">
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

  return (
    <div className="min-h-screen bg-bg-primary">
      <Navbar />

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={handleCancel}
            className="btn-secondary flex items-center justify-center w-10 h-10 p-0"
            aria-label="Go back"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-text">Share File</h1>
            <p className="text-text-secondary mt-1">
              Share <strong className="text-text">{file.filename}</strong> with
              others
            </p>
          </div>
        </div>

        {/* Share Created Success State */}
        {shareCreated && shareLink ? (
          <div className="card space-y-6">
            <div className="text-center">
              <CheckCircle
                className="w-16 h-16 text-success mx-auto mb-4"
                aria-hidden="true"
              />
              <h2 className="text-2xl font-bold text-text mb-2">
                Share Link Created!
              </h2>
              <p className="text-text-secondary">
                Anyone with this link can access the file
              </p>
            </div>

            {/* Share Link Display */}
            <div>
              <label className="block text-sm font-medium text-text mb-2">
                Shareable Link
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={shareLink}
                  readOnly
                  className="input-field flex-1 font-mono text-sm"
                  aria-label="Share link"
                />
                <button
                  onClick={handleCopyLink}
                  className="btn-primary flex items-center gap-2 whitespace-nowrap glow-hover-orange"
                  aria-label="Copy link to clipboard"
                >
                  {copied ? (
                    <>
                      <CheckCircle
                        className="w-[1.125rem] h-[1.125rem]"
                        aria-hidden="true"
                      />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy
                        className="w-[1.125rem] h-[1.125rem]"
                        aria-hidden="true"
                      />
                      <span>Copy Link</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Share Details */}
            <div className="p-4 bg-primary/10 border border-primary/30 rounded-lg">
              <h3 className="font-semibold text-primary mb-2">
                Share Details:
              </h3>
              <ul className="text-sm text-text-secondary space-y-1">
                {(expirationInput || expirationDate) && (
                  <li>
                    <strong>Expires in:</strong>{' '}
                    {expirationMethod === 'duration'
                      ? `${expirationInput} ${expirationUnit}`
                      : new Date(expirationDate).toLocaleString()}
                  </li>
                )}
                {maxAccessCount && (
                  <li>
                    <strong>Maximum accesses:</strong> {maxAccessCount} times
                  </li>
                )}
              </ul>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleCreateAnother}
                className="btn-secondary flex-1"
              >
                Create Another Share
              </button>
              <button onClick={handleCancel} className="btn-outline flex-1">
                Back to Files
              </button>
            </div>
          </div>
        ) : (
          /* Share Creation Form */
          <div className="card">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* General Error */}
              {errors.general && (
                <div
                  className="bg-red-50 border border-error text-error p-3 rounded-lg"
                  role="alert"
                >
                  {errors.general}
                </div>
              )}

              {/* Share Type Selection */}
              <div>
                <label className="block text-sm font-medium text-text mb-3">
                  Share Type <span className="text-error">*</span>
                </label>
                <div className="space-y-3">
                  {/* Public Link Option */}
                  <label className="flex items-start gap-3 p-4 border-2 border-border-primary rounded-lg cursor-pointer transition-colors hover:bg-bg-tertiary hover:border-primary">
                    <input
                      type="radio"
                      name="shareType"
                      value="link"
                      checked={shareType === 'link'}
                      onChange={(e) => setShareType(e.target.value)}
                      className="mt-1 focus:ring-2 focus:ring-primary"
                      aria-describedby="link-description"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <LinkIcon
                          className="w-[1.125rem] h-[1.125rem] text-primary"
                          aria-hidden="true"
                        />
                        <span className="font-semibold text-text">
                          Create Shareable Link
                        </span>
                      </div>
                      <p
                        id="link-description"
                        className="text-sm text-text-secondary"
                      >
                        Generate a public link that anyone can use to access
                        this file
                      </p>
                    </div>
                  </label>

                  {/* Share with User Option */}
                  <label className="flex items-start gap-3 p-4 border-2 border-border-primary rounded-lg cursor-pointer transition-colors hover:bg-bg-tertiary hover:border-primary">
                    <input
                      type="radio"
                      name="shareType"
                      value="user"
                      checked={shareType === 'user'}
                      onChange={(e) => setShareType(e.target.value)}
                      className="mt-1 focus:ring-2 focus:ring-primary"
                      aria-describedby="user-description"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <User
                          className="w-[1.125rem] h-[1.125rem] text-primary"
                          aria-hidden="true"
                        />
                        <span className="font-semibold text-text">
                          Share with FileTrace User
                        </span>
                      </div>
                      <p
                        id="user-description"
                        className="text-sm text-text-secondary"
                      >
                        Share with a specific user by their username or email
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Recipient Input (Conditional - Only for User Share) */}
              {shareType === 'user' && (
                <div>
                  <label
                    htmlFor="recipient"
                    className="block text-sm font-medium text-text mb-2"
                  >
                    Username or Email <span className="text-error">*</span>
                  </label>
                  <input
                    type="text"
                    id="recipient"
                    value={recipientIdentifier}
                    onChange={(e) => setRecipientIdentifier(e.target.value)}
                    className={`input-field ${
                      errors.recipientIdentifier ? 'border-error' : ''
                    }`}
                    placeholder="Enter username or email"
                    aria-required="true"
                    aria-invalid={!!errors.recipientIdentifier}
                    aria-describedby={
                      errors.recipientIdentifier ? 'recipient-error' : undefined
                    }
                  />
                  {errors.recipientIdentifier && (
                    <p
                      id="recipient-error"
                      className="text-error text-sm mt-1"
                      role="alert"
                    >
                      {errors.recipientIdentifier}
                    </p>
                  )}
                </div>
              )}

              {/* Expiration Options */}
              <div className="border-t border-border pt-6">
                <h3 className="font-semibold text-text mb-4">
                  Expiration Settings <span className="text-error">*</span>
                </h3>
                <p className="text-sm text-text-secondary mb-4">
                  Set at least one expiration method to limit access
                </p>

                {/* Time-Based Expiration */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-text mb-3">
                    Time Limit
                  </label>

                  {/* Expiration Method Selector */}
                  <div className="flex gap-6 mb-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        value="duration"
                        checked={expirationMethod === 'duration'}
                        onChange={(e) => {
                          setExpirationMethod(e.target.value);
                          setErrors((prev) => ({
                            ...prev,
                            expiration: '',
                            expirationDate: '',
                          }));
                        }}
                        className="w-4 h-4 text-primary focus:ring-primary"
                      />
                      <span className="text-sm text-text">
                        Duration (e.g., 24 hours)
                      </span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        value="date"
                        checked={expirationMethod === 'date'}
                        onChange={(e) => {
                          setExpirationMethod(e.target.value);
                          setErrors((prev) => ({
                            ...prev,
                            expiration: '',
                            expirationDate: '',
                          }));
                        }}
                        className="w-4 h-4 text-primary focus:ring-primary"
                      />
                      <span className="text-sm text-text">
                        Specific Date/Time
                      </span>
                    </label>
                  </div>

                  {/* Duration Input (Conditional) */}
                  {expirationMethod === 'duration' && (
                    <div className="grid grid-cols-2 gap-3">
                      {/* Number Input */}
                      <div>
                        <label
                          htmlFor="expirationInput"
                          className="block text-xs font-medium text-text-secondary mb-1"
                        >
                          Duration Value
                        </label>
                        <input
                          type="number"
                          id="expirationInput"
                          value={expirationInput}
                          onChange={(e) => {
                            setExpirationInput(e.target.value);
                            if (errors.expiration) {
                              setErrors((prev) => ({
                                ...prev,
                                expiration: '',
                              }));
                            }
                          }}
                          className="input-field"
                          placeholder="e.g., 24"
                          min="1"
                        />
                      </div>

                      {/* Unit Selector */}
                      <div>
                        <label
                          htmlFor="expirationUnit"
                          className="block text-xs font-medium text-text-secondary mb-1"
                        >
                          Unit
                        </label>
                        <select
                          id="expirationUnit"
                          value={expirationUnit}
                          onChange={(e) => setExpirationUnit(e.target.value)}
                          className="input-field"
                        >
                          <option value="minutes">Minutes</option>
                          <option value="hours">Hours</option>
                          <option value="days">Days</option>
                          <option value="weeks">Weeks</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {/* Date Picker Input (Conditional) */}
                  {expirationMethod === 'date' && (
                    <div>
                      <label
                        htmlFor="expirationDate"
                        className="block text-xs font-medium text-text-secondary mb-1"
                      >
                        Expiration Date & Time
                      </label>
                      <input
                        type="datetime-local"
                        id="expirationDate"
                        value={expirationDate}
                        onChange={(e) => {
                          setExpirationDate(e.target.value);
                          validateDateSelection(e.target.value);
                        }}
                        className={`input-field ${
                          errors.expirationDate ? 'border-error' : ''
                        }`}
                        min={new Date().toISOString().slice(0, 16)} // Now
                        max={new Date(Date.now() + 525960 * 60000)
                          .toISOString()
                          .slice(0, 16)} // 1 year from now
                      />
                      {errors.expirationDate && (
                        <p className="text-error text-sm mt-1" role="alert">
                          {errors.expirationDate}
                        </p>
                      )}
                    </div>
                  )}

                  <p className="text-xs text-text-secondary mt-2">
                    {expirationMethod === 'duration'
                      ? 'Minimum: 10 minutes, Maximum: 1 year (365 days)'
                      : 'Select any date/time within the next year'}
                  </p>

                  {errors.expiration && (
                    <p className="text-error text-sm mt-1" role="alert">
                      {errors.expiration}
                    </p>
                  )}
                </div>

                {/* Access Count Limit */}
                <div>
                  <label
                    htmlFor="maxAccessCount"
                    className="block text-sm font-medium text-text mb-2"
                  >
                    Max Access Count (optional)
                  </label>
                  <input
                    type="number"
                    id="maxAccessCount"
                    value={maxAccessCount}
                    onChange={(e) => setMaxAccessCount(e.target.value)}
                    className={`input-field ${
                      errors.maxAccessCount ? 'border-error' : ''
                    }`}
                    placeholder="e.g., 10"
                    min="1"
                    aria-describedby="max-access-help"
                    aria-invalid={!!errors.maxAccessCount}
                  />
                  <p
                    id="max-access-help"
                    className="text-xs text-text-secondary mt-1"
                  >
                    Link expires after this many accesses
                  </p>
                  {errors.maxAccessCount && (
                    <p className="text-error text-sm mt-1" role="alert">
                      {errors.maxAccessCount}
                    </p>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="submit"
                  disabled={creating}
                  className="btn-primary flex items-center justify-center gap-2 flex-1 glow-hover-orange"
                >
                  {creating ? (
                    <>
                      <Loader2
                        className="w-[1.125rem] h-[1.125rem] animate-spin"
                        aria-hidden="true"
                      />
                      <span>Creating Share...</span>
                    </>
                  ) : (
                    <>
                      <Share2
                        className="w-[1.125rem] h-[1.125rem]"
                        aria-hidden="true"
                      />
                      <span>Create Share</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={creating}
                  className="btn-secondary flex items-center justify-center gap-2 flex-1"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Help Text */}
        <div className="mt-6 p-4 bg-primary/10 border border-primary/30 rounded-lg">
          <h3 className="font-semibold text-primary mb-2">Sharing Tips:</h3>
          <ul className="list-disc list-inside text-sm text-text-secondary space-y-1">
            <li>Public links can be accessed by anyone without logging in</li>
            <li>
              User shares require the recipient to have a FileTrace account
            </li>
            <li>
              At least one expiration method (time or access count) is required
            </li>
            <li>
              You can set both time limit AND access count for extra security
            </li>
            <li>All share accesses are logged in the audit trail</li>
          </ul>
        </div>
      </main>

      {/* Loading Overlay - Blocks UI during share creation */}
      {creating && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="card p-8 shadow-xl flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-primary glow-orange"></div>
            <div className="text-center">
              <p className="text-xl font-semibold text-text mb-1">
                Creating Share...
              </p>
              <p className="text-sm text-text-secondary">
                Please wait while your share is being created
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
