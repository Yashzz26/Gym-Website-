import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff, AlertCircle } from 'lucide-react';
import { loginWithEmail, loginWithGoogle } from '../../services/auth';
import './AuthPages.css';

function formatAuthError(error) {
  if (!error) return 'An unknown error occurred.';
  if (error.code === 'auth/email-not-verified') {
    return error.message;
  }
  if (
    error.code === 'auth/invalid-credential' ||
    error.code === 'auth/user-not-found' ||
    error.code === 'auth/wrong-password'
  ) {
    return 'Invalid email or password. Please check your credentials and try again.';
  }
  if (error.code === 'auth/invalid-email') {
    return 'Please enter a valid email address.';
  }
  if (error.code === 'auth/too-many-requests') {
    return 'Too many failed login attempts. Please reset your password or try again later.';
  }
  if (error.code === 'auth/popup-closed-by-user') {
    return 'Google sign-in popup was closed before completing.';
  }
  if (error.code === 'auth/operation-not-allowed') {
    return 'This sign-in provider is not enabled in your Firebase console.';
  }
  if (error.message && error.message.includes('Firebase is not configured')) {
    return error.message;
  }
  return error.message || 'Unable to sign in. Please try again.';
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState({ type: '', message: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const redirectPath = location.state?.from?.pathname || '/';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus({ type: '', message: '' });
    setIsSubmitting(true);

    try {
      await loginWithEmail({ email, password });
      setStatus({ type: 'success', message: 'Signed in successfully.' });
      navigate(redirectPath, { replace: true });
    } catch (error) {
      setStatus({
        type: 'error',
        message: formatAuthError(error),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setStatus({ type: '', message: '' });
    setIsSubmitting(true);

    try {
      await loginWithGoogle();
      setStatus({ type: 'success', message: 'Signed in with Google successfully.' });
      navigate(redirectPath, { replace: true });
    } catch (error) {
      setStatus({
        type: 'error',
        message: formatAuthError(error),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-form-card">
      <h2 className="auth-title">Sign In</h2>
      <p className="auth-subtitle">Hi! Welcome back, you&apos;ve been missed</p>

      <form onSubmit={handleSubmit} className="auth-form">
        <div className="auth-field">
          <label htmlFor="login-email" className="auth-label">
            Email
          </label>
          <div className="auth-input-wrapper">
            <input
              id="login-email"
              type="email"
              placeholder="example@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="auth-input"
              autoComplete="email"
              required
            />
          </div>
        </div>

        <div className="auth-field">
          <label htmlFor="login-password" className="auth-label">
            Password
          </label>
          <div className="auth-input-wrapper">
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="auth-input"
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              className="auth-password-toggle"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label="Toggle visibility"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          <div className="auth-forgot-link-wrapper">
            <Link to="/forgot-password" className="auth-forgot-link">
              Forgot Password?
            </Link>
          </div>
        </div>

        {status.message && (
          <div
            role="alert"
            className={`auth-alert ${
              status.type === 'error' ? 'auth-alert-error' : 'auth-alert-success'
            }`}
          >
            <AlertCircle size={16} />
            <span>{status.message}</span>
          </div>
        )}

        <button
          type="submit"
          className="auth-submit-btn"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Signing in…' : 'Sign In'}
        </button>

        <div className="auth-divider">Or sign in with</div>

        <div className="auth-social-row">
          <button
            type="button"
            className="auth-social-circle"
            onClick={handleGoogleSignIn}
            disabled={isSubmitting}
            aria-label="Continue with Google"
            title="Sign in with Google"
          >
            <svg width="22" height="22" viewBox="0 0 18 18">
              <path
                fill="#4285F4"
                d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.616z"
              />
              <path
                fill="#34A853"
                d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
              />
              <path
                fill="#FBBC05"
                d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z"
              />
              <path
                fill="#EA4335"
                d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z"
              />
            </svg>
          </button>
        </div>

        <div className="auth-switch-footer">
          Don&apos;t have an account?
          <Link to="/register" className="auth-switch-link">
            Sign Up
          </Link>
        </div>
      </form>
    </div>
  );
}
