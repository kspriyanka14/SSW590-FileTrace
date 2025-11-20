/**
 * Landing Page (Login)
 * Combined home and login page with FileTrace description
 */

import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { authAPI } from '../utils/api';
import { saveAuth } from '../utils/auth';
import { loginSchema, extractValidationErrors } from '../utils/validation';

/**
 * Landing Component
 * @returns {React.ReactElement} Landing page with login form
 */
export default function Landing() {
  const navigate = useNavigate();
  const location = useLocation();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const messageShown = useRef(false);

  /**
   * Show message from navigation state (e.g., after password change)
   * Use ref to ensure message only shows once
   */
  useEffect(() => {
    if (location.state?.message && !messageShown.current) {
      messageShown.current = true;
      toast.info(location.state.message, { duration: 5000 });
      // Clear the message from state to avoid showing it again on refresh
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  /**
   * Handle input field changes
   */
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    // Clear error for this field
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  /**
   * Handle form submission
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});

    // Client-side validation with Zod
    const result = loginSchema.safeParse(formData);
    if (!result.success) {
      setErrors(extractValidationErrors(result.error));
      toast.error('Please fix the form errors');
      return;
    }

    setLoading(true);

    try {
      const response = await authAPI.login(formData);
      const { token, user } = response.data;

      // Save authentication data
      saveAuth(token, user);

      // Show success message
      toast.success(`Welcome back, ${user.username}!`);

      // Redirect to dashboard
      navigate('/dashboard');
    } catch (error) {
      const errorMessage =
        error.response?.data?.error || 'Login failed. Please try again.';
      setErrors({ general: errorMessage });
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-bg-primary via-bg-secondary to-bg-tertiary flex items-center justify-center p-4 relative overflow-hidden">
      {/* Futuristic background effect */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-20 left-20 w-72 h-72 bg-primary rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-accent-primary rounded-full blur-3xl"></div>
      </div>

      <div className="max-w-md w-full relative z-10">
        {/* App Description */}
        <div className="text-center text-text mb-8 fade-in">
          <div className="flex justify-center mb-4">
            <div className="bg-gradient-ember w-20 h-20 rounded-full flex items-center justify-center glow-orange-strong">
              <FileText className="w-12 h-12 text-white" aria-hidden="true" />
            </div>
          </div>
          <h1 className="text-4xl font-bold mb-4 text-primary">FileTrace</h1>
          <p className="text-lg text-text-secondary leading-relaxed">
            Audit-first file management platform with comprehensive tracking and
            secure sharing
          </p>
        </div>

        {/* Login Card */}
        <div className="card slide-in">
          <h2 className="text-2xl font-bold text-center mb-6 text-text">
            Login to Your Account
          </h2>

          {/* General Error Message */}
          {errors.general && (
            <div
              className="bg-red-50 border border-error text-error p-3 rounded-lg mb-4"
              role="alert"
              aria-live="polite"
            >
              {errors.general}
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {/* Email Field */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-text mb-2"
              >
                Email Address
              </label>
              <input
                id="email"
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className={`input-field ${errors.email ? 'error' : ''}`}
                placeholder="Enter your email"
                disabled={loading}
                autoComplete="email"
                aria-required="true"
                aria-invalid={errors.email ? 'true' : 'false'}
                aria-describedby={errors.email ? 'email-error' : undefined}
              />
              {errors.email && (
                <p
                  id="email-error"
                  className="text-error text-sm mt-1"
                  role="alert"
                >
                  {errors.email}
                </p>
              )}
            </div>

            {/* Password Field */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-text mb-2"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                className={`input-field ${errors.password ? 'error' : ''}`}
                placeholder="Enter your password"
                disabled={loading}
                autoComplete="current-password"
                aria-required="true"
                aria-invalid={errors.password ? 'true' : 'false'}
                aria-describedby={
                  errors.password ? 'password-error' : undefined
                }
              />
              {errors.password && (
                <p
                  id="password-error"
                  className="text-error text-sm mt-1"
                  role="alert"
                >
                  {errors.password}
                </p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2 glow-hover-orange"
              aria-label={loading ? 'Logging in...' : 'Login'}
            >
              {loading ? (
                <>
                  <Loader2
                    className="w-[1.125rem] h-[1.125rem] animate-spin"
                    aria-hidden="true"
                  />
                  <span>Logging in...</span>
                </>
              ) : (
                <span>Login</span>
              )}
            </button>
          </form>

          {/* Register Link */}
          <div className="mt-6 text-center">
            <p className="text-text-secondary">
              Don't have an account?{' '}
              <Link
                to="/register"
                className="text-primary hover:text-accent-light font-semibold transition-colors focus:outline-none focus:underline"
              >
                Sign up
              </Link>
            </p>
          </div>
        </div>

        {/* Footer Note */}
        <p className="text-center text-text-muted text-sm mt-6">
          SSW 590 DevOps Principles and Practices Project
        </p>
      </div>
    </div>
  );
}
