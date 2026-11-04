import { Link } from 'react-router-dom';
import { Compass, ArrowLeft } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '60vh',
      textAlign: 'center',
      gap: 'var(--spacing-4)',
      padding: 'var(--spacing-8)'
    }}>
      <div style={{
        width: '64px',
        height: '64px',
        borderRadius: 'var(--radius-xl)',
        backgroundColor: 'var(--color-bg-tertiary)',
        border: '1px solid var(--color-border-default)',
        color: 'var(--color-accent)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <Compass size={32} />
      </div>

      <span className="badge badge-danger">404 · Route Not Found</span>

      <h1 style={{ fontSize: 'var(--font-size-3xl)', margin: 0, color: 'var(--color-text-primary)' }}>
        Page Doesn't Exist
      </h1>

      <p className="text-secondary" style={{ maxWidth: '420px', lineHeight: 'var(--line-height-relaxed)' }}>
        The route you are trying to access does not exist or has been moved in the application shell.
      </p>

      <div style={{ display: 'flex', gap: 'var(--spacing-3)', marginTop: 'var(--spacing-2)' }}>
        <Link to="/" className="btn btn-primary">
          <ArrowLeft size={16} />
          <span>Return Home</span>
        </Link>
        <Link to="/login" className="btn btn-secondary">
          <span>Sign In</span>
        </Link>
      </div>
    </div>
  );
}
