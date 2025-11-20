/**
 * File Actions Menu Component
 * Dropdown menu with all file operations grouped by category
 * Uses Floating UI for automatic viewport positioning and z-index management
 */

import { useState, useEffect } from 'react';
import {
  useFloating,
  offset,
  flip,
  shift,
  autoUpdate,
  size,
  FloatingPortal,
} from '@floating-ui/react';
import {
  MoreVertical,
  Download,
  Edit,
  FolderInput,
  Share2,
  Eye,
  FileSearch,
  Info,
  Trash2,
} from 'lucide-react';

/**
 * FileActionsMenu Component
 * Displays a dropdown menu with file actions organized in 3 groups:
 * - Group 1: Download, Rename, Move
 * - Group 2: Share, View Shares, Audit Logs, File Information
 * - Group 3: Delete (red, destructive)
 *
 * Features:
 * - Automatic viewport boundary detection (flips above/below)
 * - Portal rendering (z-index issues resolved)
 * - Click-outside-to-close
 * - Keyboard navigation (Escape to close)
 *
 * @param {Object} props - Component props
 * @param {Object} props.file - File object
 * @param {Function} props.onAction - Callback function (action, file) => void
 * @returns {React.ReactElement} File actions dropdown menu
 */
export default function FileActionsMenu({ file, onAction }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(null);

  /**
   * Floating UI configuration
   * - offset: 8px spacing from button
   * - flip: Auto-flip above/below based on viewport space
   * - shift: Keep dropdown in viewport horizontally
   * - size: Constrain max height if needed
   * - autoUpdate: Reposition on scroll/resize
   */
  const { refs, floatingStyles } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    middleware: [
      offset(8),
      flip({
        fallbackPlacements: [
          'top-end',
          'bottom-end',
          'top-start',
          'bottom-start',
        ],
      }),
      shift({ padding: 8 }),
      size({
        apply({ availableHeight, elements }) {
          Object.assign(elements.floating.style, {
            maxHeight: `${Math.max(200, availableHeight - 16)}px`,
            overflow: 'auto',
          });
        },
        padding: 8,
      }),
    ],
    placement: 'bottom-end',
    whileElementsMounted: autoUpdate,
  });

  /**
   * Handle menu item click
   */
  const handleMenuClick = (action, event) => {
    event.stopPropagation(); // Prevent event bubbling
    setIsOpen(false); // Close menu
    onAction(action, file);
  };

  /**
   * Handle button click (toggle menu)
   */
  const handleButtonClick = (event) => {
    event.stopPropagation(); // Prevent card click when opening menu
    setIsOpen(!isOpen);
  };

  /**
   * Close menu on outside click
   */
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event) => {
      // Check if click is outside both button and menu
      if (
        refs.reference.current &&
        !refs.reference.current.contains(event.target) &&
        refs.floating.current &&
        !refs.floating.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };

    // Add slight delay to avoid immediate close when opening
    setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, refs.reference, refs.floating]);

  /**
   * Close menu on Escape key
   */
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        refs.reference.current?.focus(); // Return focus to button
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, refs.reference]);

  /**
   * Menu items configuration
   */
  const menuItems = [
    // Group 1: File Operations
    {
      action: 'download',
      icon: Download,
      label: 'Download',
      className: 'menu-item',
    },
    {
      action: 'rename',
      icon: Edit,
      label: 'Rename',
      className: 'menu-item',
    },
    {
      action: 'move',
      icon: FolderInput,
      label: 'Move to Category',
      className: 'menu-item',
    },
    { separator: true },
    // Group 2: Sharing & Information
    {
      action: 'share',
      icon: Share2,
      label: 'Share',
      className: 'menu-item',
    },
    {
      action: 'viewShares',
      icon: Eye,
      label: 'View Shares',
      className: 'menu-item',
    },
    {
      action: 'auditLogs',
      icon: FileSearch,
      label: 'Audit Logs',
      className: 'menu-item',
    },
    {
      action: 'fileInfo',
      icon: Info,
      label: 'File Information',
      className: 'menu-item',
    },
    { separator: true },
    // Group 3: Destructive Action
    {
      action: 'delete',
      icon: Trash2,
      label: 'Delete',
      className: 'menu-item menu-item-danger',
    },
  ];

  return (
    <div className="relative">
      {/* Menu Button */}
      <button
        ref={refs.setReference}
        onClick={handleButtonClick}
        className="btn-secondary text-sm h-9 w-9 flex items-center justify-center menu-button-no-ring p-0"
        aria-label={`More actions for ${file.filename}`}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <MoreVertical className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
      </button>

      {/* Dropdown Menu - Rendered in Portal (outside card hierarchy) */}
      {isOpen && (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            style={floatingStyles}
            className="w-56 bg-white rounded-lg shadow-lg border border-border-primary z-[9999] py-1 focus:outline-none"
            role="menu"
            aria-orientation="vertical"
          >
            {menuItems.map((item, index) => {
              if (item.separator) {
                return (
                  <div key={`separator-${index}`} className="menu-separator" />
                );
              }

              const Icon = item.icon;
              const isActive = activeIndex === index;

              return (
                <button
                  key={item.action}
                  onClick={(e) => handleMenuClick(item.action, e)}
                  onMouseEnter={() => setActiveIndex(index)}
                  onMouseLeave={() => setActiveIndex(null)}
                  className={`${item.className} ${
                    isActive ? 'bg-bg-tertiary' : ''
                  }`}
                  role="menuitem"
                  aria-label={item.label}
                >
                  <Icon className="w-4 h-4" aria-hidden="true" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </FloatingPortal>
      )}
    </div>
  );
}
