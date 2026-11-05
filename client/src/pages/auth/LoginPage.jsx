import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Lock, Mail, ArrowRight } from 'lucide-react';
import { loginWithEmail } from '../../services/auth';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState({ type: '', message: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus({ type: '', message: '' });
    setIsSubmitting(true);

    try {
      await loginWithEmail({ email, password });
      setStatus({ type: 'success', message: 'Signed in successfully.' });
    } catch (error) {
      setStatus({
        type: 'error',
        message:
          error.code === 'auth/email-not-verified'
            ? error.message
            : 'Unable to sign in. Check your email and password and try again.',
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
          Enter your email and password to access your gym portal.
        </p>
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
