/**
 * Protected Route Component
 * Redirects to login page if user is not authenticated
 * Wrapper for routes that require authentication
 */

import { Navigate } from 'react-router-dom';
import { isAuthenticated } from '../../utils/auth';

/**
 * ProtectedRoute Component
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Child components to render if authenticated
 * @returns {React.ReactElement} Children or redirect to login
 */
export default function ProtectedRoute({ children }) {
  // Check if user has valid authentication token
  if (!isAuthenticated()) {
    // Redirect to login page if not authenticated
    // replace=true prevents back button from returning here
    return <Navigate to="/login" replace />;
  }

  // Render protected content if authenticated
  return children;
}
