/**
 * Register Page
 * User registration with comprehensive validation
 */

import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { authAPI } from '../utils/api';
import { registerSchema, extractValidationErrors } from '../utils/validation';

/**
 * Register Component
 * @returns {React.ReactElement} Registration page
 */
export default function Register() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

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
    const result = registerSchema.safeParse(formData);
    if (!result.success) {
      setErrors(extractValidationErrors(result.error));
      toast.error('Please fix the form errors');
      return;
    }

    setLoading(true);

    try {
      await authAPI.register({
        username: formData.username,
        email: formData.email,
        password: formData.password,
        confirmPassword: formData.confirmPassword,
      });

      // Show success message
      toast.success('Registration successful! Please login.');

      // Redirect to login page
      navigate('/login');
    } catch (error) {
      const errorMessage =
        error.response?.data?.error || 'Registration failed. Please try again.';
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
        <div className="absolute top-20 right-20 w-72 h-72 bg-primary rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 left-20 w-96 h-96 bg-accent-primary rounded-full blur-3xl"></div>
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
            Create an account to start managing your files securely
          </p>
        </div>

        {/* Register Card */}
        <div className="card slide-in">
          <h2 className="text-2xl font-bold text-center mb-6 text-text">
            Create Your Account
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

          {/* Registration Form */}
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {/* Username Field */}
            <div>
              <label
                htmlFor="username"
                className="block text-sm font-medium text-text mb-2"
              >
                Username
              </label>
              <input
                id="username"
                type="text"
                name="username"
                value={formData.username}
                onChange={handleChange}
                className={`input-field ${errors.username ? 'error' : ''}`}
                placeholder="Choose a username"
                disabled={loading}
                autoComplete="username"
                aria-required="true"
                aria-invalid={errors.username ? 'true' : 'false'}
                aria-describedby={
                  errors.username ? 'username-error' : undefined
                }
              />
              {errors.username && (
                <p
                  id="username-error"
                  className="text-error text-sm mt-1"
                  role="alert"
                >
                  {errors.username}
                </p>
              )}
            </div>

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
                placeholder="Create a password"
                disabled={loading}
                autoComplete="new-password"
                aria-required="true"
                aria-invalid={errors.password ? 'true' : 'false'}
                aria-describedby={
                  errors.password ? 'password-error' : 'password-help'
                }
              />
              {errors.password ? (
                <p
                  id="password-error"
                  className="text-error text-sm mt-1"
                  role="alert"
                >
                  {errors.password}
                </p>
              ) : (
                <p id="password-help" className="text-text-muted text-xs mt-1">
                  Min 8 characters with uppercase, lowercase, and number
                </p>
              )}
            </div>

            {/* Confirm Password Field */}
            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-medium text-text mb-2"
              >
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                className={`input-field ${
                  errors.confirmPassword ? 'error' : ''
                }`}
                placeholder="Confirm your password"
                disabled={loading}
                autoComplete="new-password"
                aria-required="true"
                aria-invalid={errors.confirmPassword ? 'true' : 'false'}
                aria-describedby={
                  errors.confirmPassword ? 'confirm-password-error' : undefined
                }
              />
              {errors.confirmPassword && (
                <p
                  id="confirm-password-error"
                  className="text-error text-sm mt-1"
                  role="alert"
                >
                  {errors.confirmPassword}
                </p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2 glow-hover-orange"
              aria-label={loading ? 'Creating account...' : 'Sign up'}
            >
              {loading ? (
                <>
                  <Loader2
                    className="w-[1.125rem] h-[1.125rem] animate-spin"
                    aria-hidden="true"
                  />
                  <span>Creating account...</span>
                </>
              ) : (
                <span>Sign Up</span>
              )}
            </button>
          </form>

          {/* Login Link */}
          <div className="mt-6 text-center">
            <p className="text-text-secondary">
              Already have an account?{' '}
              <Link
                to="/login"
                className="text-primary hover:text-accent-light font-semibold transition-colors focus:outline-none focus:underline"
              >
                Login
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
