/**
 * Dashboard Page
 * File category selection screen
 */

import { useNavigate } from 'react-router-dom';
import {
  User,
  Briefcase,
  FileText,
  Archive,
  Users,
  Upload,
} from 'lucide-react';
import Navbar from '../components/layout/Navbar';

/**
 * File Categories Configuration - Modern Earth Futuristic
 */
const categories = [
  {
    name: 'Personal',
    slug: 'Personal',
    icon: User,
    iconBg: 'bg-gradient-personal',
    iconGlow: 'icon-glow-personal',
    borderClass: 'border-category-personal',
    borderBright: 'hover:border-category-personal-bright',
    description: 'Personal files and documents',
  },
  {
    name: 'Work',
    slug: 'Work',
    icon: Briefcase,
    iconBg: 'bg-gradient-work',
    iconGlow: 'icon-glow-work',
    borderClass: 'border-category-work',
    borderBright: 'hover:border-category-work-bright',
    description: 'Work-related files',
  },
  {
    name: 'Documents',
    slug: 'Documents',
    icon: FileText,
    iconBg: 'bg-gradient-documents',
    iconGlow: 'icon-glow-documents',
    borderClass: 'border-category-documents',
    borderBright: 'hover:border-category-documents-bright',
    description: 'Important documents',
  },
  {
    name: 'Archive',
    slug: 'Archive',
    icon: Archive,
    iconBg: 'bg-gradient-archive',
    iconGlow: 'icon-glow-archive',
    borderClass: 'border-category-archive',
    borderBright: 'hover:border-category-archive-bright',
    description: 'Archived files',
  },
  {
    name: 'Shared to Me',
    slug: 'shared-with-me',
    icon: Users,
    iconBg: 'bg-gradient-shared',
    iconGlow: 'icon-glow-shared',
    borderClass: 'border-category-shared',
    borderBright: 'hover:border-category-shared-bright',
    description: 'Files shared with you',
  },
];

/**
 * Dashboard Component
 * @returns {React.ReactElement} Dashboard page with category cards
 */
export default function Dashboard() {
  const navigate = useNavigate();

  /**
   * Navigate to category files page
   */
  const handleCategoryClick = (slug) => {
    navigate(`/files/${slug}`);
  };

  return (
    <div className="min-h-screen bg-background-secondary">
      {/* Navigation Bar */}
      <Navbar />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8" id="main-content">
        {/* Skip to main content link (accessibility) */}
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>

        {/* Page Header */}
        <div className="text-center mb-12 fade-in">
          <h1 className="text-4xl font-bold text-text mb-3">My FileTrace</h1>
        </div>

        {/* Category Cards Grid */}
        <div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto mb-12 slide-in"
          role="list"
          aria-label="File categories"
        >
          {categories.map((category) => {
            const IconComponent = category.icon;

            return (
              <button
                key={category.slug}
                onClick={() => handleCategoryClick(category.slug)}
                className={`card-futuristic text-center p-8 cursor-pointer focus:outline-none focus:ring-4 focus:ring-primary focus:ring-offset-2 group h-[200px] flex flex-col items-center justify-center border-2 ${category.borderClass} ${category.borderBright}`}
                role="listitem"
                aria-label={`Open ${category.name} files`}
              >
                {/* Icon Circle */}
                <div
                  className={`${category.iconBg} w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 transition-all duration-300 group-hover:scale-110 ${category.iconGlow}`}
                  aria-hidden="true"
                >
                  <IconComponent className="w-9 h-9 text-white drop-shadow-icon" />
                </div>

                {/* Category Name */}
                <h2 className="text-xl font-semibold text-text mb-2 group-hover:text-primary transition-colors">
                  {category.name}
                </h2>
              </button>
            );
          })}
        </div>

        {/* Upload New File Button */}
        <div
          className="max-w-md mx-auto mb-16 slide-in"
          style={{ animationDelay: '0.05s' }}
        >
          <button
            onClick={() =>
              navigate('/upload', { state: { category: 'Personal' } })
            }
            className="btn-primary-futuristic w-full flex items-center justify-center gap-2 py-4 text-lg"
            aria-label="Upload new file"
          >
            <Upload className="w-6 h-6 drop-shadow-icon" />
            <span>Upload New File</span>
          </button>
        </div>
      </main>
    </div>
  );
}
