import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, AlertCircle, CheckCircle2 } from 'lucide-react';
import { registerWithEmail, loginWithGoogle } from '../../services/auth';
import './AuthPages.css';

function formatRegisterError(error) {
  if (!error) return 'An unknown error occurred.';
  if (error.code === 'auth/email-already-in-use') {
    return 'An account already exists for this email address. Please sign in instead.';
  }
  if (error.code === 'auth/weak-password') {
    return 'Password is too weak. Please use at least 6 characters.';
  }
  if (error.code === 'auth/invalid-email') {
    return 'Please enter a valid email address.';
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
  return error.message || 'Unable to create your account. Please check your details and try again.';
}

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'member',
  });
  const [agreed, setAgreed] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState({ type: '', message: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!agreed) {
      setStatus({
        type: 'error',
        message: 'Please agree to the Terms & Conditions to create an account.',
      });
      return;
    }

    setStatus({ type: '', message: '' });
    setIsSubmitting(true);

    try {
      const payload = {
        name: formData.name,
        email: formData.email,
        password: formData.password,
      };

      if (formData.role && formData.role !== 'member') {
        payload.role = formData.role;
      }

      await registerWithEmail(payload);

      const successMsg =
        formData.role === 'member'
          ? 'Account created successfully! You can now sign in.'
          : 'Staff registration submitted! Your account is pending gym owner approval before activation.';

      setStatus({
        type: 'success',
        message: successMsg,
      });
      setFormData({ name: '', email: '', password: '', role: 'member' });
      setTimeout(() => navigate('/login'), 1500);
    } catch (error) {
      setStatus({
        type: 'error',
        message: formatRegisterError(error),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignUp = async () => {
    setStatus({ type: '', message: '' });
    setIsSubmitting(true);

    try {
      await loginWithGoogle(formData.role);
      setStatus({ type: 'success', message: 'Account registered and signed in with Google.' });
      navigate('/', { replace: true });
    } catch (error) {
      setStatus({
        type: 'error',
        message: formatRegisterError(error),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-form-card">
      <h2 className="auth-title">Create Account</h2>
      <p className="auth-subtitle">
        Fill your information below or register with your social account.
      </p>

      {/* Role Segmented Selector */}
      <div className="auth-role-tabs">
        <button
          type="button"
          className={`auth-role-tab ${formData.role === 'member' ? 'active' : ''}`}
          onClick={() => setFormData((prev) => ({ ...prev, role: 'member' }))}
        >
          Member
        </button>
        <button
          type="button"
          className={`auth-role-tab ${formData.role === 'trainer' ? 'active' : ''}`}
          onClick={() => setFormData((prev) => ({ ...prev, role: 'trainer' }))}
        >
          Trainer
        </button>
        <button
          type="button"
          className={`auth-role-tab ${formData.role === 'reception' ? 'active' : ''}`}
          onClick={() => setFormData((prev) => ({ ...prev, role: 'reception' }))}
        >
          Reception
        </button>
      </div>

      {formData.role !== 'member' && (
        <div
          style={{
            fontSize: '0.8rem',
            color: '#f59e0b',
            textAlign: 'center',
            marginTop: '-0.75rem',
            marginBottom: '1rem',
          }}
        >
          Staff registrations require owner approval before activation.
        </div>
      )}

      <form onSubmit={handleSubmit} className="auth-form">
        <div className="auth-field">
          <label htmlFor="reg-name" className="auth-label">
            Full Name
          </label>
          <div className="auth-input-wrapper">
            <input
              id="reg-name"
              type="text"
              placeholder="Ex. John Doe"
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              className="auth-input"
              autoComplete="name"
              required
            />
          </div>
        </div>

        <div className="auth-field">
          <label htmlFor="reg-email" className="auth-label">
            Email Address
          </label>
          <div className="auth-input-wrapper">
            <input
              id="reg-email"
              type="email"
              placeholder="example@gmail.com"
              value={formData.email}
              onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
              className="auth-input"
              autoComplete="email"
              required
            />
          </div>
        </div>

        <div className="auth-field">
          <label htmlFor="reg-password" className="auth-label">
            Password
          </label>
          <div className="auth-input-wrapper">
            <input
              id="reg-password"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••••••"
              value={formData.password}
              onChange={(e) => setFormData((prev) => ({ ...prev, password: e.target.value }))}
              className="auth-input"
              autoComplete="new-password"
              minLength={6}
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
        </div>

        <label className="auth-checkbox-label">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="auth-checkbox"
          />
          <span>
            Agree with <span className="auth-checkbox-link">Terms &amp; Condition</span>
          </span>
        </label>

        {status.message && (
          <div
            role="alert"
            className={`auth-alert ${
              status.type === 'error' ? 'auth-alert-error' : 'auth-alert-success'
            }`}
          >
            {status.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
            <span>{status.message}</span>
          </div>
        )}

        <button
          type="submit"
          aria-label="Register account"
          className="auth-submit-btn"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Creating account…' : 'Sign Up'}
        </button>

        <div className="auth-divider">Or sign up with</div>

        <div className="auth-social-row">
          <button
            type="button"
            className="auth-social-circle"
            onClick={handleGoogleSignUp}
            disabled={isSubmitting}
            aria-label="Sign up with Google"
            title="Sign up with Google"
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
          Already have an account?
          <Link to="/login" className="auth-switch-link">
            Sign In
          </Link>
        </div>
      </form>
    </div>
  );
}
