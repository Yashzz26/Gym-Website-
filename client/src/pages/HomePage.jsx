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
  Shield,
} from 'lucide-react';
import './HomePage.css';

export default function HomePage() {
  const portals = [
    {
      title: 'Member Portal',
      desc: 'Join online, scan gate QR for attendance, and track daily trainer-assigned workouts.',
      badge: 'Member',
      badgeClass: 'badge-accent',
      links: [
        { to: '/member/join', label: 'Online Joining', icon: CreditCard, tag: 'Screen 1' },
        { to: '/member/attendance', label: 'QR Attendance', icon: QrCode, tag: 'Screen 2' },
        { to: '/member/workout', label: 'Workout Plan', icon: CreditCard, tag: 'Screen 3' },
      ],
    },
    {
      title: 'Reception Desk',
      desc: 'Monitor real-time check-ins, record cash/UPI fee payments, and view expiring memberships.',
      badge: 'Reception',
      badgeClass: 'badge-warning',
      links: [
        { to: '/reception/attendance', label: "Today's Attendance", icon: CalendarCheck, tag: 'Screen 4' },
        { to: '/reception/fees', label: 'Fees Entry', icon: Receipt, tag: 'Screen 5' },
        { to: '/reception/renewals', label: 'Renewal List', icon: Clock, tag: 'Screen 6' },
      ],
    },
    {
      title: 'Trainer Portal',
      desc: 'Manage assigned fitness clients, track weight progress, and design customized diet plans.',
      badge: 'Trainer',
      badgeClass: 'badge-info',
      links: [
        { to: '/trainer/members', label: 'My Members', icon: Users, tag: 'Screen 7' },
        { to: '/trainer/diet', label: 'Diet Plan', icon: Utensils, tag: 'Screen 8' },
      ],
    },
    {
      title: 'Owner Dashboard',
      desc: 'Track daily revenue collections, inspect inactive members, and configure gym settings.',
      badge: 'Owner',
      badgeClass: 'badge-danger',
      links: [
        { to: '/owner/dashboard', label: 'Daily Analytics', icon: BarChart3, tag: 'Screen 9' },
        { to: '/owner/inactive', label: 'Inactive Members', icon: UserX, tag: 'Screen 10' },
      ],
    },
  ];

  return (
    <div className="home-page">
      <div className="home-hero">
        <span className="badge badge-accent">React Router & App Shell Configured</span>
        <h1 className="home-title">
          Ironcore <span className="text-accent">Gym Management</span>
        </h1>
        <p className="home-subtitle">
          Single gym management application serving 4 distinct user roles across 11 blueprint screens.
          Explore the workspace below:
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
                      <span className="portal-screen-tag">{link.tag}</span>
                      <ArrowRight size={14} className="portal-arrow" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="card architecture-banner">
        <div className="arch-left">
          <Shield size={24} className="text-accent" />
          <div>
            <h3>Security & Routing Architecture</h3>
            <p>
              Front-end route groups configured for Auth, Member, Reception, Trainer, and Owner.
              Role-based backend enforcement via Firebase token verification will be attached in Days 4–7.
            </p>
          </div>
        </div>
        <Link to="/login" className="btn btn-primary">
          <span>Go to Auth Screen</span>
          <ArrowRight size={16} />
        </Link>
      </div>
    </div>
  );
}
