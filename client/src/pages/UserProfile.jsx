/**
 * UserProfile Page
 * Displays user profile information with edit, security, and account deletion options
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Mail, Calendar, Edit, Lock, Trash2, Shield } from 'lucide-react';
import Navbar from '../components/layout/Navbar';
import { getUser } from '../utils/auth';
import { formatRelativeTime } from '../utils/auth';
import EditProfileModal from '../components/UserProfile/EditProfileModal';
import ChangePasswordModal from '../components/UserProfile/ChangePasswordModal';
import DeleteAccountModal from '../components/UserProfile/DeleteAccountModal';

/**
 * UserProfile Component
 * @returns {React.ReactElement} User profile page
 */
export default function UserProfile() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Load user data on mount
  useEffect(() => {
    const userData = getUser();
    if (!userData) {
      navigate('/login');
      return;
    }
    setUser(userData);
  }, [navigate]);

  /**
   * Handle successful profile update
   * Updates local state and localStorage
   */
  const handleProfileUpdate = (updatedUser) => {
    setUser(updatedUser);
    localStorage.setItem('user', JSON.stringify(updatedUser));
    setShowEditModal(false);
  };

  /**
   * Handle successful password change
   * Note: Modal now handles logout and redirect itself after server confirms
   */
  const handlePasswordChange = () => {
    // Modal handles everything - this is just a placeholder
    // The modal will close itself, logout, and redirect after server success
  };

  /**
   * Handle successful account deletion
   * Note: Modal now handles logout and redirect itself after server confirms
   */
  const handleAccountDeleted = () => {
    // Modal handles everything - this is just a placeholder
    // The modal will close itself, logout, and redirect after server success
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin glow-orange"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Navigation Bar */}
      <Navbar />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-4xl" id="main-content">
        {/* Skip to main content link (accessibility) */}
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>

        {/* Page Header */}
        <div className="mb-8 fade-in">
          <h1 className="text-4xl font-bold text-text mb-2">My Profile</h1>
          <p className="text-text-secondary text-lg">
            Manage your account settings and preferences
          </p>
        </div>

        {/* Profile Information Section */}
        <section
          className="card p-6 mb-6 slide-in"
          aria-labelledby="profile-info-heading"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center">
                <User className="w-6 h-6 text-primary" />
              </div>
              <h2
                id="profile-info-heading"
                className="text-2xl font-bold text-text"
              >
                Profile Information
              </h2>
            </div>
            <button
              onClick={() => setShowEditModal(true)}
              className="btn-outline flex items-center gap-2 glow-hover-orange"
              aria-label="Edit profile"
            >
              <Edit className="w-4 h-4" />
              Edit Profile
            </button>
          </div>

          <div className="space-y-4">
            {/* Username */}
            <div className="flex items-center gap-3 p-4 bg-bg-tertiary rounded-lg">
              <User
                className="w-5 h-5 text-text-secondary"
                aria-hidden="true"
              />
              <div className="flex-1">
                <p className="text-sm text-text-secondary">Username</p>
                <p className="text-lg font-medium text-text">{user.username}</p>
              </div>
            </div>

            {/* Email */}
            <div className="flex items-center gap-3 p-4 bg-bg-tertiary rounded-lg">
              <Mail
                className="w-5 h-5 text-text-secondary"
                aria-hidden="true"
              />
              <div className="flex-1">
                <p className="text-sm text-text-secondary">Email</p>
                <p className="text-lg font-medium text-text">{user.email}</p>
              </div>
            </div>

            {/* Member Since */}
            <div className="flex items-center gap-3 p-4 bg-bg-tertiary rounded-lg">
              <Calendar
                className="w-5 h-5 text-text-secondary"
                aria-hidden="true"
              />
              <div className="flex-1">
                <p className="text-sm text-text-secondary">Member Since</p>
                <p className="text-lg font-medium text-text">
                  {new Date(user.createdAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                  <span className="text-sm text-text-secondary ml-2">
                    ({formatRelativeTime(user.createdAt)})
                  </span>
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Security Section */}
        <section
          className="card p-6 mb-6 slide-in"
          style={{ animationDelay: '0.1s' }}
          aria-labelledby="security-heading"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center">
              <Shield className="w-6 h-6 text-primary" />
            </div>
            <h2 id="security-heading" className="text-2xl font-bold text-text">
              Security
            </h2>
          </div>

          <div className="flex items-center justify-between p-4 bg-bg-tertiary rounded-lg">
            <div className="flex items-center gap-3">
              <Lock
                className="w-5 h-5 text-text-secondary"
                aria-hidden="true"
              />
              <div>
                <p className="text-lg font-medium text-text">Password</p>
                <p className="text-sm text-text-secondary">
                  Change your password to keep your account secure
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowPasswordModal(true)}
              className="btn-outline whitespace-nowrap"
              aria-label="Change password"
            >
              Change Password
            </button>
          </div>
        </section>

        {/* Danger Zone Section */}
        <section
          className="card p-6 border-2 border-error slide-in"
          style={{ animationDelay: '0.2s' }}
          aria-labelledby="danger-zone-heading"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-error rounded-full flex items-center justify-center">
              <Trash2 className="w-6 h-6 text-white" />
            </div>
            <h2
              id="danger-zone-heading"
              className="text-2xl font-bold text-error"
            >
              Danger Zone
            </h2>
          </div>

          <div className="bg-error/10 border border-error/30 rounded-lg p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-error mb-2">
                  Delete Account
                </h3>
                <p className="text-sm text-text-secondary mb-2">
                  Once you delete your account, there is no going back.
                </p>
                <p className="text-sm text-text-secondary">
                  This action will permanently delete:
                </p>
                <ul className="list-disc list-inside text-sm text-text-secondary mt-2 space-y-1">
                  <li>Your account and profile</li>
                  <li>All your uploaded files (MongoDB and S3)</li>
                  <li>All share links you created</li>
                  <li>All user shares you created</li>
                  <li>All audit logs for your files</li>
                </ul>
              </div>
              <button
                onClick={() => setShowDeleteModal(true)}
                className="px-4 py-2 bg-error text-white rounded-lg hover:bg-red-700 transition-colors focus:outline-none focus:ring-4 focus:ring-error focus:ring-opacity-30 whitespace-nowrap"
                aria-label="Delete account"
              >
                Delete Account
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* Modals */}
      {showEditModal && (
        <EditProfileModal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          currentUser={user}
          onSuccess={handleProfileUpdate}
        />
      )}

      {showPasswordModal && (
        <ChangePasswordModal
          isOpen={showPasswordModal}
          onClose={() => setShowPasswordModal(false)}
        />
      )}

      {showDeleteModal && (
        <DeleteAccountModal
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          user={user}
        />
      )}
    </div>
  );
}
