/**
 * File Upload Page
 * Upload files with drag & drop using react-uploady
 */

import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Uploady, {
  useItemProgressListener,
  useItemFinishListener,
  useItemStartListener,
  useItemErrorListener,
  useUploady,
  useBatchAddListener,
  useRequestPreSend,
} from '@rpldy/uploady';
import UploadButton from '@rpldy/upload-button';
import {
  CloudUpload,
  File as FileIcon,
  X,
  CheckCircle,
  AlertCircle,
  ArrowLeft,
} from 'lucide-react';
import { toast } from 'sonner';
import Navbar from '../components/layout/Navbar';
import { getToken } from '../utils/auth';

/**
 * UploadZone Component - Inner component with upload hooks
 */
function UploadZone({ category, onSuccess }) {
  const [files, setFiles] = useState([]);

  // Staged upload state
  const [stagedFile, setStagedFile] = useState(null);
  const [description, setDescription] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(category);
  const [isUploading, setIsUploading] = useState(false);
  const uploady = useUploady();

  // Use refs to avoid closure issues in useRequestPreSend
  const descriptionRef = useRef(description);
  const categoryRef = useRef(selectedCategory);

  // Keep refs in sync with state
  useEffect(() => {
    descriptionRef.current = description;
  }, [description]);

  useEffect(() => {
    categoryRef.current = selectedCategory;
  }, [selectedCategory]);

  // Capture files when selected (before upload)
  useBatchAddListener((batch) => {
    const file = batch.items[0]?.file;

    if (file) {
      // Validate file size (10MB max)
      const maxSize = 10 * 1024 * 1024; // 10MB in bytes
      if (file.size > maxSize) {
        toast.error(
          `File size must be less than 10MB. Your file is ${(
            file.size /
            1024 /
            1024
          ).toFixed(2)}MB`
        );
        uploady.clearPending();
        return false; // Prevent file from being added
      }

      // Stage the file for user review
      setStagedFile(file);
    }
  });

  // Inject description and category before upload
  useRequestPreSend(({ options }) => {
    // Use refs to get current values (avoid stale closure)
    const currentDescription = descriptionRef.current;
    const currentCategory = categoryRef.current;
    const trimmedDescription = currentDescription.trim();

    return {
      options: {
        ...options,
        params: {
          ...options.params,
          category: currentCategory,
          description: trimmedDescription,
        },
      },
    };
  });

  // Listen to upload start - add files to tracking
  useItemStartListener((item) => {
    setFiles((prev) => [
      ...prev,
      {
        id: item.id,
        file: item.file,
        progress: 0,
        status: 'uploading',
      },
    ]);
  });

  // Listen to upload progress
  useItemProgressListener((item) => {
    setFiles((prev) =>
      prev.map((f) =>
        f.id === item.id ? { ...f, progress: item.completed } : f
      )
    );
  });

  // Listen to upload errors (400, 500, etc.)
  useItemErrorListener((item) => {
    console.error('Upload error:', item);
    setIsUploading(false);

    // Extract error message from response
    const errorMessage =
      item.uploadResponse?.data?.error ||
      item.uploadResponse?.data?.message ||
      item.uploadResponse?.data?.details?.[0] ||
      'Upload failed. Please try again.';

    toast.error(errorMessage, {
      duration: 5000,
    });

    // Clear the files array (remove progress bars)
    setFiles([]);

    // Reset state so user can try again
    setStagedFile(null);
    setDescription('');
    uploady.clearPending();
  });

  // Listen to upload completion (success only)
  useItemFinishListener((item) => {
    setIsUploading(false);

    if (item.uploadResponse?.data?.file) {
      setFiles((prev) =>
        prev.map((f) =>
          f.id === item.id ? { ...f, status: 'complete', progress: 100 } : f
        )
      );
      toast.success(`${item.file.name} uploaded successfully!`);

      // Reset staged file and description
      setStagedFile(null);
      setDescription('');

      // Redirect to the category of the uploaded file (from the form, not the original route)
      const uploadedCategory = categoryRef.current;
      onSuccess(uploadedCategory);
    } else {
      // This shouldn't happen as errors are caught by useItemErrorListener
      setFiles((prev) =>
        prev.map((f) => (f.id === item.id ? { ...f, status: 'error' } : f))
      );
      toast.error(`Failed to upload ${item.file.name}`);

      // Reset state on error too
      setStagedFile(null);
      setDescription('');
    }
  });

  const removeFile = (id) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  return (
    <div className="space-y-6">
      {/* File Selection Button - Show only when no file staged */}
      {!stagedFile && (
        <UploadButton className="w-full">
          <div className="border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-all duration-200 border-border-primary hover:border-primary hover:bg-bg-tertiary glow-hover-orange">
            <CloudUpload
              className="w-16 h-16 mx-auto mb-4 text-text-muted"
              aria-hidden="true"
            />
            <p className="text-xl font-medium text-text mb-2">
              Choose a file to upload
            </p>
            <p className="text-text-secondary mb-4">
              Click to browse from your device
            </p>
            <p className="text-sm text-text-secondary">
              Maximum file size: 10MB
            </p>
          </div>
        </UploadButton>
      )}

      {/* Staged File Preview - Show when file is selected */}
      {stagedFile && !isUploading && (
        <div className="space-y-4">
          {/* File Info Card */}
          <div className="card p-4 bg-primary/10 border border-primary/30">
            <div className="flex items-center gap-3">
              <FileIcon className="w-8 h-8 text-primary flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-text truncate">
                  {stagedFile.name}
                </p>
                <p className="text-sm text-text-secondary">
                  {(stagedFile.size / 1024).toFixed(1)} KB •{' '}
                  {stagedFile.type || 'Unknown type'}
                </p>
              </div>
              <button
                onClick={() => {
                  setStagedFile(null);
                  setDescription('');
                  uploady.clearPending();
                }}
                className="text-text-secondary hover:text-error transition-colors p-1"
                aria-label="Remove file"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Description Field */}
          <div>
            <label
              htmlFor="description"
              className="block text-sm font-medium text-text mb-2"
            >
              Description (optional)
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter a description for this file (optional)"
              rows={4}
              maxLength={250}
              className="input-field w-full resize-none"
            />
            <p
              className={`text-xs mt-1 ${
                description.length > 250
                  ? 'text-error font-semibold'
                  : 'text-text-secondary'
              }`}
            >
              {description.length}/250 characters
            </p>
          </div>

          {/* Category Dropdown */}
          <div>
            <label
              htmlFor="category"
              className="block text-sm font-medium text-text mb-2"
            >
              Category <span className="text-error">*</span>
            </label>
            <select
              id="category"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="input-field w-full"
              required
            >
              <option value="Personal">Personal</option>
              <option value="Work">Work</option>
              <option value="Documents">Documents</option>
              <option value="Archive">Archive</option>
            </select>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={() => {
                // Validate description length (optional field, but if provided must be <= 250)
                if (description.length > 250) {
                  toast.error(
                    `Description is ${description.length} characters. Maximum is 250 characters.`
                  );
                  return;
                }

                // Start upload
                setIsUploading(true);
                uploady.processPending();
              }}
              disabled={description.length > 250}
              className="btn-primary flex-1 flex items-center justify-center gap-2 glow-hover-orange"
            >
              <CloudUpload className="w-[1.125rem] h-[1.125rem]" />
              <span>Confirm Upload</span>
            </button>

            <button
              onClick={() => {
                setStagedFile(null);
                setDescription('');
                uploady.clearPending();
                toast.info('Upload cancelled');
              }}
              className="btn-secondary flex-1"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Files List with Progress */}
      {files.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-text">Uploading Files</h3>
          {files.map((fileObj) => (
            <div key={fileObj.id} className="card p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {fileObj.status === 'complete' ? (
                    <CheckCircle className="w-5 h-5 text-success flex-shrink-0" />
                  ) : fileObj.status === 'error' ? (
                    <AlertCircle className="w-5 h-5 text-error flex-shrink-0" />
                  ) : (
                    <FileIcon className="w-5 h-5 text-primary flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-text truncate">
                      {fileObj.file.name}
                    </p>
                    <p className="text-sm text-text-secondary">
                      {(fileObj.file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => removeFile(fileObj.id)}
                  className="text-text-secondary hover:text-error transition-colors p-1"
                  aria-label={`Remove ${fileObj.file.name}`}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Progress Bar */}
              {fileObj.status === 'uploading' && (
                <div className="space-y-1">
                  <div className="w-full bg-bg-tertiary rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-primary h-full transition-all duration-300 ease-out glow-orange"
                      style={{ width: `${fileObj.progress}%` }}
                      role="progressbar"
                      aria-valuenow={fileObj.progress}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    />
                  </div>
                  <p className="text-xs text-text-secondary" aria-live="polite">
                    {fileObj.progress}% uploaded
                  </p>
                </div>
              )}

              {fileObj.status === 'error' && (
                <p className="text-sm text-error mt-2">Upload failed</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Loading Overlay - Blocks UI during upload */}
      {isUploading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="card p-8 shadow-xl flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-primary glow-orange"></div>
            <div className="text-center">
              <p className="text-xl font-semibold text-text mb-1">
                Uploading...
              </p>
              <p className="text-sm text-text-secondary">
                Please wait while your file is being uploaded
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * FileUpload Component
 */
export default function FileUpload() {
  const navigate = useNavigate();
  const location = useLocation();
  const category = location.state?.category || 'Personal';

  const handleSuccess = (uploadedCategory) => {
    // Redirect to the actual category of the uploaded file
    setTimeout(() => {
      navigate(`/files/${uploadedCategory}`);
    }, 1500);
  };

  const token = getToken();

  return (
    <div className="min-h-screen bg-bg-primary">
      <Navbar />

      <main className="container mx-auto px-4 py-8 max-w-3xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate(`/files/${category}`)}
            className="btn-secondary flex items-center justify-center w-10 h-10 p-0"
            aria-label="Go back"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-text">Upload Files</h1>
            <p className="text-text-secondary">
              Category: <span className="font-semibold">{category}</span>
            </p>
          </div>
        </div>

        {/* Upload Form */}
        <div className="card">
          <Uploady
            autoUpload={false}
            multiple={false}
            clearPendingOnAdd={true}
            destination={{
              url: `${
                import.meta.env.VITE_API_URL || 'http://localhost:3001/api'
              }/files/upload`,
              headers: {
                Authorization: `Bearer ${token}`,
              },
              method: 'POST',
            }}
            inputFieldName="file"
            params={{ category }}
            maxConcurrent={3}
          >
            <UploadZone category={category} onSuccess={handleSuccess} />
          </Uploady>
        </div>

        {/* Instructions */}
        <div className="mt-6 p-4 bg-primary/10 border border-primary/30 rounded-lg">
          <h3 className="font-semibold text-primary mb-2">
            Upload Instructions:
          </h3>
          <ul className="list-disc list-inside text-sm text-text-secondary space-y-1">
            <li>Click the upload zone to browse and select a file</li>
            <li>
              Enter a description for your file (optional, max 250 characters)
            </li>
            <li>Select or change the category if needed</li>
            <li>Click "Confirm Upload" to start uploading</li>
            <li>Maximum file size: 10MB</li>
            <li>
              Default category:{' '}
              <strong className="text-text">{category}</strong>
            </li>
          </ul>
        </div>
      </main>
    </div>
  );
}
