import { useState } from 'react';
import { Link } from 'react-router-dom';
import { User, Mail, Lock, ArrowRight, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { registerWithEmail } from '../../services/auth';

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'member',
  });
  const [status, setStatus] = useState({ type: '', message: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

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
          ? 'Account created. Check your email to verify it before signing in. Membership plans can be selected upon signing in.'
          : 'Staff registration submitted! Check your email to verify it. Your account is pending gym owner approval before activation.';

      setStatus({
        type: 'success',
        message: successMsg,
      });
      setFormData({ name: '', email: '', password: '', role: 'member' });
    } catch (error) {
      setStatus({
        type: 'error',
        message:
          error.code === 'auth/email-already-in-use'
            ? 'An account already exists for this email.'
            : 'Unable to create your account. Check the details and try again.',
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

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-3)' }}>
        {/* Registration Profile Type */}
        <div>
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
