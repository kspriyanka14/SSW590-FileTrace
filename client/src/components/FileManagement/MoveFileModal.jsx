/**
 * MoveFileModal Component
 * Modal for moving a file to a different category
 */

import { useState } from 'react';
import {
  X,
  FolderInput,
  Loader2,
  User,
  Briefcase,
  FileText,
  Archive,
} from 'lucide-react';
import { toast } from 'sonner';
import { fileAPI, getErrorMessage } from '../../utils/api.js';

/**
 * Available categories - Lucide React Icons
 * Gradients match Dashboard category styling
 */
const CATEGORIES = [
  {
    value: 'Personal',
    label: 'Personal',
    Icon: User,
    gradient: 'bg-gradient-personal',
  },
  {
    value: 'Work',
    label: 'Work',
    Icon: Briefcase,
    gradient: 'bg-gradient-work',
  },
  {
    value: 'Documents',
    label: 'Documents',
    Icon: FileText,
    gradient: 'bg-gradient-documents',
  },
  {
    value: 'Archive',
    label: 'Archive',
    Icon: Archive,
    gradient: 'bg-gradient-archive',
  },
];

/**
 * MoveFileModal Component
 *
 * @param {Object} props - Component props
 * @param {boolean} props.isOpen - Whether modal is open
 * @param {Function} props.onClose - Callback to close modal
 * @param {Object} props.file - File object to move
 * @param {string} props.file._id - File ID
 * @param {string} props.file.filename - File name
 * @param {string} props.file.category - Current category
 * @param {Function} props.onMoveSuccess - Callback after successful move
 * @returns {JSX.Element}
 */
export default function MoveFileModal({
  isOpen,
  onClose,
  file,
  onMoveSuccess,
}) {
  const [selectedCategory, setSelectedCategory] = useState('');
  const [isMoving, setIsMoving] = useState(false);

  /**
   * Handle category selection
   */
  const handleCategoryClick = (category) => {
    // Don't allow selecting current category
    if (category === file?.category) {
      toast.error('File is already in this category');
      return;
    }
    setSelectedCategory(category);
  };

  /**
   * Handle move file submission
   */
  const handleMove = async () => {
    if (!selectedCategory) {
      toast.error('Please select a category');
      return;
    }

    if (selectedCategory === file?.category) {
      toast.error('File is already in this category');
      return;
    }

    try {
      setIsMoving(true);
      await fileAPI.moveFile(file._id, selectedCategory);

      toast.success(`File moved to ${selectedCategory}`);

      // Call success callback
      if (onMoveSuccess) {
        onMoveSuccess(selectedCategory);
      }

      // Close modal
      onClose();
    } catch (error) {
      console.error('Move file error:', error);
      toast.error(getErrorMessage(error));
    } finally {
      setIsMoving(false);
    }
  };

  /**
   * Handle modal close
   */
  const handleClose = () => {
    if (!isMoving) {
      setSelectedCategory('');
      onClose();
    }
  };

  if (!isOpen || !file) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
      onClick={(e) => {
        // Close modal when clicking overlay
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
    >
      <div className="modal-content max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between pb-6 border-b border-border-primary">
          <div className="flex items-center gap-2">
            <FolderInput className="w-6 h-6 text-primary" />
            <h2 className="text-2xl font-bold text-text">Move File</h2>
          </div>
          <button
            onClick={handleClose}
            disabled={isMoving}
            className="text-text-secondary hover:text-text transition-colors disabled:cursor-not-allowed"
            aria-label="Close modal"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* File Info */}
          <div className="mb-6">
            <p className="text-sm text-text-secondary mb-1">Moving file:</p>
            <p className="text-lg font-semibold text-text truncate">
              {file.filename}
            </p>
            <p className="text-sm text-text-secondary mt-1">
              Current category:{' '}
              <span className="font-medium text-primary">{file.category}</span>
            </p>
          </div>

          {/* Category Selection */}
          <div>
            <label className="block text-sm font-medium text-text mb-3">
              Select New Category
            </label>
            <div className="grid grid-cols-2 gap-3">
              {CATEGORIES.map((category) => {
                const isCurrentCategory = category.value === file.category;
                const isSelected = category.value === selectedCategory;
                const IconComponent = category.Icon;

                return (
                  <button
                    key={category.value}
                    onClick={() => handleCategoryClick(category.value)}
                    disabled={isCurrentCategory || isMoving}
                    className={`
                      p-4 rounded-lg border-2 transition-all text-left group
                      ${
                        isSelected
                          ? 'border-primary bg-accent-primary/10'
                          : isCurrentCategory
                          ? 'border-border-primary cursor-not-allowed opacity-50'
                          : 'border-border-primary hover:border-primary'
                      }
                      ${isMoving ? 'cursor-not-allowed opacity-60' : ''}
                    `}
                    aria-pressed={isSelected}
                    aria-disabled={isCurrentCategory || isMoving}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`${category.gradient} w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110`}
                      >
                        <IconComponent className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p
                          className={`font-semibold ${
                            isSelected ? 'text-primary' : 'text-text'
                          }`}
                        >
                          {category.label}
                        </p>
                        {isCurrentCategory && (
                          <p className="text-xs text-text-muted mt-0.5">
                            Current
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 pt-6 mt-6 border-t border-border-primary">
          <button
            onClick={handleClose}
            disabled={isMoving}
            className="btn-secondary"
          >
            Cancel
          </button>
          <button
            onClick={handleMove}
            disabled={
              !selectedCategory ||
              isMoving ||
              selectedCategory === file.category
            }
            className="btn-primary flex items-center gap-2"
          >
            {isMoving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Moving...</span>
              </>
            ) : (
              <>
                <FolderInput className="w-4 h-4" />
                <span>Move File</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
