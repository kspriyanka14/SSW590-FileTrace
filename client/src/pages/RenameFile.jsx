/**
 * Rename File Page
 * Edit filename while preserving the extension
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Edit, ArrowLeft, Loader2, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import Navbar from '../components/layout/Navbar';
import { fileAPI } from '../utils/api';
import { renameFileSchema, extractValidationErrors } from '../utils/validation';
import { formatDate } from '../utils/auth';

/**
 * RenameFile Component
 * @returns {React.ReactElement} Rename file page
 */
export default function RenameFile() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newFilename, setNewFilename] = useState('');
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

      // Extract filename without extension
      const lastDotIndex = fileData.filename.lastIndexOf('.');
      const nameWithoutExt =
        lastDotIndex > 0
          ? fileData.filename.substring(0, lastDotIndex)
          : fileData.filename;

      setNewFilename(nameWithoutExt);
    } catch (error) {
      console.error('Failed to load file:', error);
      toast.error('Failed to load file');
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle rename submission
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});

    // Validate new filename
    const result = renameFileSchema.safeParse({ filename: newFilename });

    if (!result.success) {
      setErrors(extractValidationErrors(result.error));
      return;
    }

    // Get file extension
    const lastDotIndex = file.filename.lastIndexOf('.');
    const extension =
      lastDotIndex > 0 ? file.filename.substring(lastDotIndex) : '';

    // Combine new name with original extension
    const fullFilename = `${newFilename}${extension}`;

    // Check if filename actually changed
    if (fullFilename === file.filename) {
      toast.info('Filename is unchanged');
      return;
    }

    setSaving(true);

    try {
      await fileAPI.renameFile(id, fullFilename);
      toast.success('File renamed successfully!');

      // Navigate back to files list
      setTimeout(() => {
        navigate(`/files/${file.category}`);
      }, 500);
    } catch (error) {
      const errorMessage =
        error.response?.data?.error || 'Failed to rename file';
      toast.error(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  /**
   * Handle cancel button
   */
  const handleCancel = () => {
    navigate(`/files/${file.category}`);
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

  // Extract extension for display
  const lastDotIndex = file.filename.lastIndexOf('.');
  const extension =
    lastDotIndex > 0 ? file.filename.substring(lastDotIndex) : '';

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
            <h1 className="text-3xl font-bold text-text">Rename File</h1>
            <p className="text-text-secondary mt-1">
              Update the filename while keeping the original extension
            </p>
          </div>
        </div>

        {/* Rename Form */}
        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Current Filename Display */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Current Filename
              </label>
              <div className="px-4 py-3 bg-bg-tertiary border border-border-primary rounded-lg">
                <p className="text-text font-medium break-all">
                  {file.filename}
                </p>
              </div>
            </div>

            {/* New Filename Input */}
            <div>
              <label
                htmlFor="filename"
                className="block text-sm font-medium text-text mb-2"
              >
                New Filename <span className="text-error">*</span>
              </label>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <input
                    type="text"
                    id="filename"
                    value={newFilename}
                    onChange={(e) => setNewFilename(e.target.value)}
                    className={`input-field ${
                      errors.filename ? 'border-error' : ''
                    }`}
                    placeholder="Enter new filename"
                    aria-required="true"
                    aria-invalid={!!errors.filename}
                    aria-describedby={
                      errors.filename ? 'filename-error' : undefined
                    }
                    autoFocus
                  />
                  {errors.filename && (
                    <p
                      id="filename-error"
                      className="text-error text-sm mt-1"
                      role="alert"
                    >
                      {errors.filename}
                    </p>
                  )}
                </div>
                {extension && (
                  <div className="px-4 py-3 bg-bg-tertiary border border-border-primary rounded-lg">
                    <p className="text-text-secondary font-medium">
                      {extension}
                    </p>
                  </div>
                )}
              </div>
              <p className="text-sm text-text-secondary mt-2">
                Extension{' '}
                <strong className="text-text">{extension || '(none)'}</strong>{' '}
                will be preserved automatically
              </p>
            </div>

            {/* File Info */}
            <div className="p-4 bg-primary/10 border border-primary/30 rounded-lg">
              <h3 className="font-semibold text-primary mb-2">
                File Information
              </h3>
              <div className="text-sm text-text-secondary space-y-1">
                <p>
                  <strong>Category:</strong>{' '}
                  <span className="capitalize">{file.category}</span>
                </p>
                {file.description && (
                  <p>
                    <strong>Description:</strong> {file.description}
                  </p>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="submit"
                disabled={saving || !newFilename.trim()}
                className="btn-primary flex items-center justify-center gap-2 flex-1 glow-hover-orange"
              >
                {saving ? (
                  <>
                    <Loader2
                      className="w-[1.125rem] h-[1.125rem] animate-spin"
                      aria-hidden="true"
                    />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save
                      className="w-[1.125rem] h-[1.125rem]"
                      aria-hidden="true"
                    />
                    <span>Save Changes</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleCancel}
                disabled={saving}
                className="btn-secondary flex items-center justify-center gap-2 flex-1"
              >
                <X className="w-[1.125rem] h-[1.125rem]" aria-hidden="true" />
                <span>Cancel</span>
              </button>
            </div>
          </form>
        </div>

        {/* Help Text */}
        <div className="mt-6 p-4 bg-primary/10 border border-primary/30 rounded-lg">
          <h3 className="font-semibold text-primary mb-2">Renaming Tips:</h3>
          <ul className="list-disc list-inside text-sm text-text-secondary space-y-1">
            <li>
              Only the filename will be changed, the extension stays the same
            </li>
            <li>Filename cannot be empty or contain only whitespace</li>
            <li>Changes will be reflected immediately after saving</li>
            <li>All file shares and audit logs will remain intact</li>
          </ul>
        </div>
      </main>
    </div>
  );
}
