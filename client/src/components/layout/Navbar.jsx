/**
 * Navbar Component
 * Navigation bar with user info and logout functionality
 */

import { Link, useNavigate } from 'react-router-dom';
import { FileText, LogOut, User } from 'lucide-react';
import { getUser, logout } from '../../utils/auth';

/**
 * Navbar Component
 * Displays app name, user greeting, and logout button
 * @returns {React.ReactElement} Navbar component
 */
export default function Navbar() {
  const navigate = useNavigate();
  const user = getUser();

  /**
   * Handle user logout
   */
  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav
      className="bg-bg-secondary border-b border-border-primary shadow-lg"
      role="navigation"
      aria-label="Main navigation"
    >
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* App Logo and Name */}
          <Link
            to="/dashboard"
            className="flex items-center gap-3 text-2xl font-bold group"
            aria-label="FileTrace Home"
          >
            <div className="logo-icon-container bg-gradient-primary w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-300 group-hover:scale-105">
              <FileText
                className="w-6 h-6 text-white drop-shadow-icon"
                aria-hidden="true"
              />
            </div>
            <span className="logo-text relative">
              FileTrace
              <span className="logo-underline"></span>
            </span>
          </Link>

          {/* User Info and Actions */}
          {user && (
            <div className="flex items-center gap-3">
              {/* User Greeting */}
              <span
                className="text-sm text-text-secondary hidden sm:inline"
                aria-label={`Logged in as ${user.username}`}
              >
                Welcome,{' '}
                <span className="font-semibold text-primary">
                  {user.username}
                </span>
              </span>

              {/* Profile Button */}
              <Link
                to="/profile"
                className="btn-secondary flex items-center gap-2"
                aria-label="My Profile"
              >
                <User
                  className="w-[1.125rem] h-[1.125rem]"
                  aria-hidden="true"
                />
                <span className="hidden sm:inline">Profile</span>
              </Link>

              {/* Logout Button */}
              <button
                onClick={handleLogout}
                className="btn-secondary flex items-center gap-2"
                aria-label="Logout"
              >
                <LogOut
                  className="w-[1.125rem] h-[1.125rem]"
                  aria-hidden="true"
                />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
