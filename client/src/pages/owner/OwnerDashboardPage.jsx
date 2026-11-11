import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  CalendarCheck,
  IndianRupee,
  ShieldCheck,
  Layers,
  Settings,
  UserX,
  UserPlus,
  ArrowRight,
  Sparkles,
  RefreshCw,
  Clock,
  BarChart3,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getPendingStaff } from '../../services/userService';
import './OwnerDashboardPage.css';

/**
 * Format integer paise into INR currency display (e.g., 150000 paise -> ₹1,500.00).
 * Conforms to ADR 001.
 */
function formatPaiseToINR(paise = 0) {
  const rupees = (Number(paise) || 0) / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(rupees);
}

export default function OwnerDashboardPage({ initialStats = null }) {
  const { user, profile } = useAuth();
  const [stats, setStats] = useState(
    initialStats || {
      activeMembers: 0,
      todayAttendance: 0,
      monthlyRevenuePaise: 0,
      pendingStaffCount: 0,
    }
  );
  const [loading, setLoading] = useState(!initialStats);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboardData = async () => {
    try {
      setRefreshing(true);
      const token = user?.getIdToken ? await user.getIdToken() : null;

      // Fetch pending staff queue if token is available
      let pendingCount = 0;
      if (token) {
        try {
          const pending = await getPendingStaff(token);
          pendingCount = Array.isArray(pending) ? pending.length : 0;
        } catch {
          // Fallback if offline or mock
          pendingCount = 0;
        }
      }

      setStats((prev) => ({
        ...prev,
        pendingStaffCount: pendingCount,
      }));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!initialStats) {
      fetchDashboardData();
    }
  }, [initialStats]);

  const todayStr = new Intl.DateTimeFormat('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date());

  const quickActions = [
    {
      title: 'Membership Plans',
      desc: 'Define 1-month, 3-month and annual tiers with benefits and fees.',
      to: '/owner/plans',
      icon: Layers,
      actionText: 'Manage Plans',
    },
    {
      title: 'Staff Approvals',
      desc: 'Review pending trainer/reception self-registrations or create staff.',
      to: '/owner/staff',
      icon: ShieldCheck,
      actionText: 'Review Queue',
      badge: stats.pendingStaffCount > 0 ? `${stats.pendingStaffCount} Pending` : null,
    },
    {
      title: 'Gym Settings',
      desc: 'Update gym address, session operating hours, UPI ID and QR rotation.',
      to: '/owner/settings',
      icon: Settings,
      actionText: 'Configure Settings',
    },
    {
      title: 'Inactive Members',
      desc: 'Track expired memberships and trigger WhatsApp renewal follow-ups.',
      to: '/owner/inactive',
      icon: UserX,
      actionText: 'View Inactive',
    },
    {
      title: 'New Member Registration',
      desc: 'Enroll walk-in members directly at reception with photo and membership.',
      to: '/reception/register',
      icon: UserPlus,
      actionText: 'Register Member',
    },
    {
      title: 'Daily Report & Revenue',
      desc: 'Audit daily cash vs UPI breakdown and view weekly attendance trends.',
      to: '/owner/reports',
      icon: BarChart3,
      actionText: 'View Reports',
    },
  ];

  return (
    <div className="owner-dashboard">
      {/* 1. Header & Welcome Banner */}
      <section className="dashboard-header" aria-label="Dashboard Overview">
        <div className="dashboard-title-group">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
            <span className="dashboard-role-badge">Owner Portal</span>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
              Executive Hub
            </span>
          </div>
          <h1>
            Welcome back, {profile?.displayName || user?.displayName || 'Gym Owner'}
          </h1>
          <p>Real-time metrics, operational oversight, and business management controls.</p>
        </div>

        <div className="dashboard-meta-actions">
          <div className="date-chip">
            <Clock size={14} color="var(--color-accent)" />
            <span>{todayStr}</span>
          </div>

          <button
            type="button"
            className="refresh-button"
            onClick={fetchDashboardData}
            disabled={refreshing}
            aria-label="Refresh Dashboard Metrics"
          >
            <RefreshCw size={14} className={refreshing ? 'spin' : ''} />
            <span>{refreshing ? 'Updating…' : 'Refresh'}</span>
          </button>
        </div>
      </section>

      {/* 2. Key Metrics & Report Cards with Clear Empty States */}
      <section aria-label="Key Performance Indicators">
        <h2 className="section-title">
          <Sparkles size={18} color="var(--color-accent)" />
          <span>Operational Snapshot</span>
        </h2>

        <div className="metrics-grid">
          {/* Metric 1: Total Active Members */}
          <article className="metric-card">
            <div className="metric-card-top">
              <span className="metric-label">Active Members</span>
              <div className="metric-icon-wrap">
                <Users size={18} />
              </div>
            </div>
            <div className="metric-value-group">
              <div className="metric-value">{stats.activeMembers}</div>
              {stats.activeMembers === 0 ? (
                <span className="metric-empty-badge">
                  <AlertCircle size={12} /> 0 active members
                </span>
              ) : (
                <span className="metric-subtext">Currently enrolled and active</span>
              )}
            </div>
            <p className="metric-subtext">
              {stats.activeMembers === 0
                ? 'No active members yet. Enroll your first member to start tracking.'
                : 'Verified memberships in good standing.'}
            </p>
          </article>

          {/* Metric 2: Today's Attendance */}
          <article className="metric-card">
            <div className="metric-card-top">
              <span className="metric-label">Today's Check-ins</span>
              <div className="metric-icon-wrap">
                <CalendarCheck size={18} />
              </div>
            </div>
            <div className="metric-value-group">
              <div className="metric-value">{stats.todayAttendance}</div>
              {stats.todayAttendance === 0 ? (
                <span className="metric-empty-badge">
                  <AlertCircle size={12} /> No check-ins today
                </span>
              ) : (
                <span className="metric-subtext">Morning & Evening sessions</span>
              )}
            </div>
            <p className="metric-subtext">
              {stats.todayAttendance === 0
                ? 'QR scanner active. Check-ins will update live as members arrive.'
                : 'Members checked in at the door.'}
            </p>
          </article>

          {/* Metric 3: Monthly Revenue */}
          <article className="metric-card accent">
            <div className="metric-card-top">
              <span className="metric-label">Monthly Revenue</span>
              <div className="metric-icon-wrap">
                <IndianRupee size={18} />
              </div>
            </div>
            <div className="metric-value-group">
              <div className="metric-value">
                {formatPaiseToINR(stats.monthlyRevenuePaise)}
              </div>
              {stats.monthlyRevenuePaise === 0 ? (
                <span className="metric-empty-badge">
                  <AlertCircle size={12} /> No collections recorded
                </span>
              ) : (
                <span className="metric-subtext">Cash & Razorpay online</span>
              )}
            </div>
            <p className="metric-subtext">
              {stats.monthlyRevenuePaise === 0
                ? 'No payments received this month yet.'
                : 'Gross collections for current calendar month.'}
            </p>
          </article>

          {/* Metric 4: Pending Staff Approvals */}
          <article className="metric-card">
            <div className="metric-card-top">
              <span className="metric-label">Pending Staff</span>
              <div className="metric-icon-wrap">
                <ShieldCheck size={18} />
              </div>
            </div>
            <div className="metric-value-group">
              <div className="metric-value">{stats.pendingStaffCount}</div>
              {stats.pendingStaffCount > 0 ? (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    fontSize: 'var(--font-size-xs)',
                    color: 'var(--color-warning)',
                    backgroundColor: 'var(--color-warning-bg)',
                    padding: '0.15rem 0.5rem',
                    borderRadius: 'var(--radius-full)',
                    width: 'fit-content',
                  }}
                >
                  Action required
                </span>
              ) : (
                <span className="metric-subtext">All requests reviewed</span>
              )}
            </div>
            <p className="metric-subtext">
              {stats.pendingStaffCount > 0 ? (
                <Link to="/owner/staff" style={{ color: 'var(--color-accent)', textDecoration: 'underline' }}>
                  Review {stats.pendingStaffCount} staff request(s) →
                </Link>
              ) : (
                'No pending staff self-registrations waiting for approval.'
              )}
            </p>
          </article>
        </div>
      </section>

      {/* 3. Setup / Launch Checklist for Empty State */}
      {stats.activeMembers === 0 && (
        <section className="setup-guide-card" aria-label="Gym Onboarding Checklist">
          <div className="setup-guide-header">
            <div>
              <h2>Gym Launch & Quick Setup Guide</h2>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                Complete these four foundational steps to activate your gym operations:
              </p>
            </div>
            <span
              style={{
                fontSize: 'var(--font-size-xs)',
                color: 'var(--color-accent)',
                backgroundColor: 'var(--color-accent-subtle)',
                padding: '0.25rem 0.6rem',
                borderRadius: 'var(--radius-full)',
                fontWeight: 'var(--font-weight-bold)',
              }}
            >
              Setup Mode
            </span>
          </div>

          <div className="setup-steps-list">
            <Link to="/owner/settings" className="setup-step-item" aria-label="Setup: Configure Gym Profile & Sessions">
              <span className="step-number">1</span>
              <span className="step-text">Configure Gym Profile & Sessions</span>
            </Link>

            <Link to="/owner/plans" className="setup-step-item" aria-label="Setup: Create Membership Plans">
              <span className="step-number">2</span>
              <span className="step-text">Create Membership Plans</span>
            </Link>

            <Link to="/owner/staff" className="setup-step-item" aria-label="Setup: Approve Staff or Trainers">
              <span className="step-number">3</span>
              <span className="step-text">Approve Staff or Trainers</span>
            </Link>

            <Link to="/reception/register" className="setup-step-item" aria-label="Setup: Enroll Your First Member">
              <span className="step-number">4</span>
              <span className="step-text">Enroll Your First Member</span>
            </Link>
          </div>
        </section>
      )}

      {/* 4. Quick Actions Grid */}
      <section aria-label="Owner Quick Actions">
        <h2 className="section-title">
          <span>Quick Actions & Administration</span>
        </h2>

        <div className="quick-actions-grid">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.to}
                to={action.to}
                className="quick-action-card"
                aria-label={`Action: ${action.title}`}
              >
                <div className="action-header">
                  <div className="action-icon">
                    <Icon size={20} />
                  </div>
                  <div className="action-info">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                      <h3>{action.title}</h3>
                      {action.badge && (
                        <span
                          style={{
                            fontSize: '0.7rem',
                            padding: '0.1rem 0.4rem',
                            borderRadius: 'var(--radius-full)',
                            backgroundColor: 'var(--color-warning-bg)',
                            color: 'var(--color-warning)',
                            fontWeight: 'var(--font-weight-bold)',
                          }}
                        >
                          {action.badge}
                        </span>
                      )}
                    </div>
                    <p>{action.desc}</p>
                  </div>
                </div>

                <div className="action-footer">
                  <span>{action.actionText}</span>
                  <ArrowRight size={14} className="action-arrow" />
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
