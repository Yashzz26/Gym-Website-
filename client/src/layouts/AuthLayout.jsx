import { Outlet, Link } from 'react-router-dom';
import { Dumbbell } from 'lucide-react';
import './AuthLayout.css';

export default function AuthLayout() {
  return (
    <div className="auth-layout">
      <div className="auth-container">
        <div className="auth-header">
          <Link to="/" className="auth-brand">
            <div className="auth-brand-icon">
              <Dumbbell size={28} />
            </div>
            <div className="auth-brand-text">
              <h1>IRONCORE</h1>
              <span>Gym Management System</span>
            </div>
          </Link>
        </div>

        <div className="auth-card">
          <Outlet />
        </div>

        <div className="auth-footer">
          <p>© 2026 Ironcore Gym Systems. Secure Cloud Authentication.</p>
          <Link to="/" className="auth-back-link">
            ← Return to Application
          </Link>
        </div>
      </div>
    </div>
  );
}
