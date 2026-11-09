import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, Mail, Lock, ArrowRight, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { registerWithEmail, loginWithGoogle } from '../../services/auth';

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
  const [status, setStatus] = useState({ type: '', message: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
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
          ? 'Account created! Please check your email for the verification link before signing in.'
          : 'Staff registration submitted! Please check your email for the verification link. Your account is pending gym owner approval before activation.';

      setStatus({
        type: 'success',
        message: successMsg,
      });
      setFormData({ name: '', email: '', password: '', role: 'member' });
    } catch (error) {
      setStatus({
        type: 'error',
        message: formatRegisterError(error),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
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
    <div className="register-page">
      <div style={{ marginBottom: 'var(--spacing-6)', textAlign: 'center' }}>
        <span className="badge badge-accent" style={{ marginBottom: 'var(--spacing-2)' }}>
          Account Registration
        </span>
        <h2 style={{ fontSize: 'var(--font-size-2xl)', margin: 'var(--spacing-2) 0' }}>
          Create Account
        </h2>
        <p className="text-secondary" style={{ fontSize: 'var(--font-size-sm)' }}>
          Register as a member or apply for staff access.
        </p>
      </div>

      {/* Registration Profile Type Selector */}
      <div style={{ marginBottom: 'var(--spacing-3)' }}>
        <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', marginBottom: 'var(--spacing-1)', color: 'var(--color-text-secondary)' }}>
          Registration Type
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--spacing-2)' }}>
          {[
            { id: 'member', label: 'Member' },
            { id: 'trainer', label: 'Trainer' },
            { id: 'reception', label: 'Reception' },
          ].map((option) => (
            <button
              key={option.id}
              type="button"
              className={`btn ${formData.role === option.id ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: 'var(--font-size-xs)', padding: 'var(--spacing-2)' }}
              onClick={() => setFormData({ ...formData, role: option.id })}
            >
              {option.label}
            </button>
          ))}
        </div>
        {formData.role !== 'member' ? (
          <p style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: 'var(--font-size-xs)', color: 'var(--color-warning, #f59e0b)', marginTop: 'var(--spacing-1)' }}>
            <ShieldAlert size={14} />
            Staff registrations require owner approval before access is granted.
          </p>
        ) : (
          <p style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: 'var(--spacing-1)' }}>
            <CheckCircle2 size={14} />
            Members become active upon membership plan selection.
          </p>
        )}
      </div>

      {/* Google Sign-up Button */}
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
        <span>Sign up with Google</span>
      </button>

      <div style={{ display: 'flex', alignItems: 'center', margin: 'var(--spacing-3) 0', color: 'var(--color-text-muted)' }}>
        <div style={{ flex: 1, height: '1px', background: 'var(--color-border)' }} />
        <span style={{ padding: '0 var(--spacing-2)', fontSize: 'var(--font-size-xs)', textTransform: 'uppercase' }}>or with email</span>
        <div style={{ flex: 1, height: '1px', background: 'var(--color-border)' }} />
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-3)' }}>
        <div>
          <label htmlFor="register-name" style={{ display: 'block', fontSize: 'var(--font-size-xs)', marginBottom: 'var(--spacing-1)', color: 'var(--color-text-secondary)' }}>
            Full Name
          </label>
          <div style={{ position: 'relative' }}>
            <input
              id="register-name"
              type="text"
              placeholder="Full Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              style={{ width: '100%', paddingLeft: '36px' }}
              required
            />
            <User size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
          </div>
        </div>

        <div>
          <label htmlFor="register-email" style={{ display: 'block', fontSize: 'var(--font-size-xs)', marginBottom: 'var(--spacing-1)', color: 'var(--color-text-secondary)' }}>
            Email Address
          </label>
          <div style={{ position: 'relative' }}>
            <input
              id="register-email"
              type="email"
              placeholder="name@example.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              style={{ width: '100%', paddingLeft: '36px' }}
              required
            />
            <Mail size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
          </div>
        </div>

        <div>
          <label htmlFor="register-password" style={{ display: 'block', fontSize: 'var(--font-size-xs)', marginBottom: 'var(--spacing-1)', color: 'var(--color-text-secondary)' }}>
            Password
          </label>
          <div style={{ position: 'relative' }}>
            <input
              id="register-password"
              type="password"
              placeholder="••••••••"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
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
          <span>{isSubmitting ? 'Creating account…' : 'Register'}</span>
          <ArrowRight size={16} />
        </button>

        <div style={{ textAlign: 'center', marginTop: 'var(--spacing-2)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
          <span>Already registered? </span>
          <Link to="/login" style={{ color: 'var(--color-accent)', fontWeight: 'var(--font-weight-medium)' }}>
            Sign in
          </Link>
        </div>
      </form>
    </div>
  );
}
