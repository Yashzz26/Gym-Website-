import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Lock, Mail, ArrowRight } from 'lucide-react';
import { loginWithEmail, loginWithGoogle } from '../../services/auth';

function formatAuthError(error) {
  if (!error) return 'An unknown error occurred.';
  if (error.code === 'auth/email-not-verified') {
    return error.message;
  }
  if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
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
    <div className="login-page">
      <div style={{ marginBottom: 'var(--spacing-6)', textAlign: 'center' }}>
        <span className="badge badge-accent" style={{ marginBottom: 'var(--spacing-2)' }}>
          Screen 11 · Authentication
        </span>
        <h2 style={{ fontSize: 'var(--font-size-2xl)', margin: 'var(--spacing-2) 0' }}>
          Sign In
        </h2>
        <p className="text-secondary" style={{ fontSize: 'var(--font-size-sm)' }}>
          Enter your credentials or continue with Google to access your portal.
        </p>
      </div>

      {/* Google Sign-in Button */}
      <button
        type="button"
        className="btn btn-secondary"
        onClick={handleGoogleSignIn}
        disabled={isSubmitting}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 'var(--spacing-2)',
          padding: '10px 16px',
          fontWeight: 500,
        }}
      >
        <svg width="18" height="18" viewBox="0 0 18 18">
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
        <span>Continue with Google</span>
      </button>

      <div style={{ display: 'flex', alignItems: 'center', margin: 'var(--spacing-4) 0', color: 'var(--color-text-muted)' }}>
        <div style={{ flex: 1, height: '1px', background: 'var(--color-border)' }} />
        <span style={{ padding: '0 var(--spacing-2)', fontSize: 'var(--font-size-xs)', textTransform: 'uppercase' }}>or with email</span>
        <div style={{ flex: 1, height: '1px', background: 'var(--color-border)' }} />
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-4)' }}>
        <div>
          <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', marginBottom: 'var(--spacing-1)', color: 'var(--color-text-secondary)' }}>
            Email Address
          </label>
          <div style={{ position: 'relative' }}>
            <input
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ width: '100%', paddingLeft: '36px' }}
              required
            />
            <Mail size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
          </div>
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--spacing-1)' }}>
            <label htmlFor="login-password" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
              Password
            </label>
            <Link to="/forgot-password" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-accent)' }}>
              Forgot password?
            </Link>
          </div>
          <div style={{ position: 'relative' }}>
            <input
              id="login-password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ width: '100%', paddingLeft: '36px' }}
              required
            />
            <Lock size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
          </div>
        </div>

        {status.message && (
          <p role="alert" className={status.type === 'error' ? 'text-danger' : 'text-accent'}>
            {status.message}
          </p>
        )}

        <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 'var(--spacing-2)' }} disabled={isSubmitting}>
          <span>{isSubmitting ? 'Signing in…' : 'Sign In'}</span>
          <ArrowRight size={16} />
        </button>

        <div style={{ textAlign: 'center', marginTop: 'var(--spacing-2)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
          <span>Need an account? </span>
          <Link to="/register" style={{ color: 'var(--color-accent)', fontWeight: 'var(--font-weight-medium)' }}>
            Register here
          </Link>
        </div>
      </form>
    </div>
  );
}
