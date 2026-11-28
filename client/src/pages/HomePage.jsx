import { Link } from 'react-router-dom';
import {
  CreditCard,
  QrCode,
  CalendarCheck,
  Receipt,
  Clock,
  Users,
  Utensils,
  BarChart3,
  UserX,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import './HomePage.css';

export default function HomePage() {
  const { profile } = useAuth();

  const allPortals = [
    {
      title: 'Member Portal',
      desc: 'Join online, scan gate QR for attendance, and track daily trainer-assigned workouts.',
      badge: 'Member',
      badgeClass: 'badge-accent',
      links: [
        { to: '/member/join', label: 'Online Joining', icon: CreditCard },
        { to: '/member/attendance', label: 'QR Attendance', icon: QrCode },
        { to: '/member/workout', label: 'Workout Plan', icon: CreditCard },
      ],
    },
    {
      title: 'Reception Desk',
      desc: 'Monitor real-time check-ins, record cash/UPI fee payments, and view expiring memberships.',
      badge: 'Reception',
      badgeClass: 'badge-warning',
      links: [
        { to: '/reception/attendance', label: "Today's Attendance", icon: CalendarCheck },
        { to: '/reception/fees', label: 'Fees Entry', icon: Receipt },
        { to: '/reception/renewals', label: 'Renewal List', icon: Clock },
      ],
    },
    {
      title: 'Trainer Portal',
      desc: 'Manage assigned fitness clients, track weight progress, and design customized diet plans.',
      badge: 'Trainer',
      badgeClass: 'badge-info',
      links: [
        { to: '/trainer/members', label: 'My Members', icon: Users },
        { to: '/trainer/diet', label: 'Diet Plan', icon: Utensils },
      ],
    },
    {
      title: 'Owner Dashboard',
      desc: 'Track daily revenue collections, inspect inactive members, and configure gym settings.',
      badge: 'Owner',
      badgeClass: 'badge-danger',
      links: [
        { to: '/owner/dashboard', label: 'Daily Analytics', icon: BarChart3 },
        { to: '/owner/inactive', label: 'Inactive Members', icon: UserX },
      ],
    },
  ];

  const userRole = profile?.role || 'member';
  const portals = allPortals.filter((portal) => {
    if (!profile?.role) return true;
    if (userRole === 'owner') return true;
    if (userRole === 'reception') return portal.badge === 'Reception';
    if (userRole === 'trainer') return portal.badge === 'Trainer';
    if (userRole === 'member') return portal.badge === 'Member';
    return true;
  });

  return (
    <div className="home-page">
      {profile?.approvalStatus === 'pending' && (
        <div
          role="status"
          style={{
            backgroundColor: 'var(--color-warning-bg)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            borderRadius: 'var(--radius-lg)',
            padding: '14px 18px',
            marginBottom: 'var(--spacing-6)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-3)',
            color: 'var(--color-warning)',
          }}
        >
          <ShieldAlert size={20} strokeWidth={1.75} style={{ flexShrink: 0 }} />
          <div>
            <strong style={{ display: 'block', marginBottom: '2px', fontWeight: 'var(--font-weight-semibold)' }}>
              Account Awaiting Approval
            </strong>
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
              Your staff account is pending gym owner activation. You can view gym plans below.
            </span>
          </div>
        </div>
      )}

      {profile?.approvalStatus === 'suspended' && (
        <div
          role="alert"
          style={{
            backgroundColor: 'var(--color-danger-bg)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 'var(--radius-lg)',
            padding: '14px 18px',
            marginBottom: 'var(--spacing-6)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-3)',
            color: 'var(--color-danger)',
          }}
        >
          <ShieldAlert size={20} strokeWidth={1.75} style={{ flexShrink: 0 }} />
          <div>
            <strong style={{ display: 'block', marginBottom: '2px', fontWeight: 'var(--font-weight-semibold)' }}>
              Account Suspended
            </strong>
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
              Your account has been suspended. Contact gym management for assistance.
            </span>
          </div>
        </div>
      )}

      <div className="home-hero">
        <span className="badge badge-accent">IRONCORE Workspace</span>
        <h1 className="home-title">
          Ironcore <span className="text-accent">Gym Management</span>
        </h1>
        <p className="home-subtitle">
          Unified workspace for gym owners, front-desk reception, trainers, and members.
        </p>
      </div>

      <div className="portals-grid">
        {portals.map((portal) => (
          <div key={portal.title} className="card portal-card">
            <div className="portal-header">
              <span className={`badge ${portal.badgeClass}`}>{portal.badge}</span>
              <h2 className="portal-title">{portal.title}</h2>
              <p className="portal-desc">{portal.desc}</p>
            </div>

            <div className="portal-links">
              {portal.links.map((link) => {
                const Icon = link.icon;
                return (
                  <Link key={link.to} to={link.to} className="portal-link-item">
                    <div className="portal-link-left">
                      <Icon size={16} className="text-accent" />
                      <span>{link.label}</span>
                    </div>
                    <div className="portal-link-right">
                      <ArrowRight size={14} className="portal-arrow" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
