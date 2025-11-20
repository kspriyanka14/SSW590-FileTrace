/**
 * Main App Component
 * React Router configuration with all routes and Sonner toast integration
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import ProtectedRoute from './components/layout/ProtectedRoute';
import Landing from './pages/Landing';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import UserProfile from './pages/UserProfile';
import FilesList from './pages/FilesList';
import SharedWithMe from './pages/SharedWithMe';
import FileUpload from './pages/FileUpload';
import RenameFile from './pages/RenameFile';
import ShareFile from './pages/ShareFile';
import AuditLogs from './pages/AuditLogs';
import PublicShare from './pages/PublicShare';

/**
 * App Component
 * @returns {React.ReactElement} Main application with routing
 */
export default function App() {
  return (
    <BrowserRouter>
      {/* Sonner Toast Notifications */}
      <Toaster
        position="top-right"
        richColors
        closeButton
        duration={4000}
        toastOptions={{
          style: {
            background: 'white',
            color: '#111827',
            border: '1px solid #e5e7eb',
          },
        }}
      />

      {/* Routes Configuration */}
      <Routes>
        {/* Public Routes - No Authentication Required */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Landing />} />
        <Route path="/register" element={<Register />} />
        <Route path="/share/:token" element={<PublicShare />} />

        {/* Protected Routes - Authentication Required */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <UserProfile />
            </ProtectedRoute>
          }
        />

        <Route
          path="/files/shared-with-me"
          element={
            <ProtectedRoute>
              <SharedWithMe />
            </ProtectedRoute>
          }
        />

        <Route
          path="/files/:category"
          element={
            <ProtectedRoute>
              <FilesList />
            </ProtectedRoute>
          }
        />

        <Route
          path="/upload"
          element={
            <ProtectedRoute>
              <FileUpload />
            </ProtectedRoute>
          }
        />

        <Route
          path="/file/:id/rename"
          element={
            <ProtectedRoute>
              <RenameFile />
            </ProtectedRoute>
          }
        />

        <Route
          path="/file/:id/share"
          element={
            <ProtectedRoute>
              <ShareFile />
            </ProtectedRoute>
          }
        />

        <Route
          path="/file/:id/audit"
          element={
            <ProtectedRoute>
              <AuditLogs />
            </ProtectedRoute>
          }
        />

        {/* Catch-All Route - Redirect to Login */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
