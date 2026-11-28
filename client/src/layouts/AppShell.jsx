import { useState } from 'react';
import { NavLink, Outlet, useLocation, Link } from 'react-router-dom';
import {
  Menu,
  X,
  Dumbbell,
  CreditCard,
  QrCode,
  CalendarCheck,
  Receipt,
  Clock,
  UserPlus,
  Users,
  Utensils,
  Activity,
  BarChart3,
  LayoutDashboard,
  UserX,
  Layers,
  ShieldCheck,
  Settings,
  User,
  LogOut,
  Bell,
  ChevronRight,
  Download,
} from 'lucide-react';
import { logout } from '../services/auth';
import { useAuth } from '../context/AuthContext';
import { usePwaInstall } from '../hooks/usePwaInstall';
import PwaInstallBanner from '../components/PwaInstallBanner';
import './AppShell.css';

/**
 * Navigation items grouped by role as defined in the product blueprint.
 */
const ROLE_NAV_CONFIG = {
  owner: {
    label: 'Owner Portal',
    badge: 'Owner',
    items: [
      { to: '/owner/dashboard', label: 'Owner Dashboard', icon: LayoutDashboard },
      { to: '/owner/qr', label: 'Entrance QR Display', icon: QrCode },
      { to: '/owner/staff', label: 'Staff Approvals', icon: ShieldCheck },
      { to: '/owner/plans', label: 'Membership Plans', icon: Layers },
      { to: '/owner/inactive', label: 'Inactive Members', icon: UserX },
      { to: '/owner/reports', label: 'Daily Report', icon: BarChart3 },
      { to: '/owner/settings', label: 'Gym Settings', icon: Settings },
    ],
  },
  reception: {
    label: 'Reception Portal',
    badge: 'Reception',
    items: [
      { to: '/reception/attendance', label: "Today's Attendance", icon: CalendarCheck },
      { to: '/reception/qr', label: 'Entrance QR Display', icon: QrCode },
      { to: '/reception/fees', label: 'Fees Entry', icon: Receipt },
      { to: '/reception/renewals', label: 'Renewal List', icon: Clock },
      { to: '/reception/register', label: 'New Member', icon: UserPlus },
    ],
  },
  trainer: {
    label: 'Trainer Portal',
    badge: 'Trainer',
    items: [
      { to: '/trainer/members', label: 'My Members', icon: Users },
      { to: '/trainer/diet', label: 'Diet Plans', icon: Utensils },
      { to: '/trainer/workouts', label: 'Workout Builder', icon: Activity },
    ],
  },
  member: {
    label: 'Member Portal',
    badge: 'Member',
    items: [
      { to: '/member/join', label: 'Online Joining', icon: CreditCard },
      { to: '/member/attendance', label: 'QR Attendance', icon: QrCode },
      { to: '/member/workout', label: 'Workout Plan', icon: Dumbbell },
      { to: '/member/diet', label: 'Diet Plan', icon: Utensils },
      { to: '/member/profile', label: 'My Membership', icon: User },
    ],
  },
};

export default function AppShell() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const { user, profile, isAuthenticated } = useAuth();
  const {
    canPromptInstall,
    isIosInstallable,
    isPrompting,
    showInstallBanner,
    promptInstall,
    dismissBanner,
  } = usePwaInstall();

  // Active role group is strictly derived from the authenticated profile role
  const userRole = profile?.role || 'member';

  const toggleMobileMenu = () => setMobileMenuOpen((prev) => !prev);
  const closeMobileMenu = () => setMobileMenuOpen(false);

  // Find current screen title across known routes
  const currentNavGroup = ROLE_NAV_CONFIG[userRole] || ROLE_NAV_CONFIG.member;
  const allNavItems = Object.values(ROLE_NAV_CONFIG).flatMap((g) => g.items);
  const currentItem = allNavItems.find((item) => item.to === location.pathname);
  const currentTitle = currentItem ? currentItem.label : 'Gym Management System';
  const [logoutError, setLogoutError] = useState('');

  const handleLogout = async () => {
    setLogoutError('');

    try {
      await logout();
    } catch {
      setLogoutError('Unable to sign out. Please try again.');
    }
  };

  return (
    <div className="app-shell">
      {/* Mobile Backdrop */}
      {mobileMenuOpen && (
        <div className="sidebar-backdrop" onClick={closeMobileMenu} aria-hidden="true" />
      )}

      {/* Sidebar Navigation */}
      <aside className={`app-sidebar ${mobileMenuOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <div className="brand-logo-wrap">
            <Dumbbell className="brand-icon" size={24} />
          </div>
          <div className="brand-text">
            <span className="brand-title">IRONCORE</span>
            <span className="brand-subtitle">Gym Management</span>
          </div>
          <button
            className="mobile-close-btn"
            onClick={closeMobileMenu}
            aria-label="Close navigation"
          >
            <X size={20} />
          </button>
        </div>

        {/* Authenticated Role Workspace Welcome Banner (Replaces 4-button switcher) */}
        <div className="sidebar-workspace-header">
          <div className="workspace-welcome-badge">
            <span className="welcome-role-tag">
              {userRole === 'owner'
                ? 'Owner Workspace'
                : userRole === 'reception'
                ? 'Reception Workspace'
                : userRole === 'trainer'
                ? 'Trainer Workspace'
                : 'Member Workspace'}
            </span>
          </div>
          <div className="workspace-greeting">
            <span className="workspace-hello">
              {userRole === 'owner'
                ? 'Welcome, Owner'
                : userRole === 'reception'
                ? 'Welcome, Reception'
                : userRole === 'trainer'
                ? 'Welcome, Trainer'
                : 'Welcome, Member'}
            </span>
            <span className="workspace-user-name">
              {profile?.displayName || user?.displayName || user?.email?.split('@')[0] || 'Fitness Member'}
            </span>
          </div>
        </div>

        {/* Navigation Links for Authenticated Role */}
        <nav className="sidebar-nav">
          <div className="nav-group-title">
            <span>{currentNavGroup.label}</span>
            <span className="badge badge-accent">{currentNavGroup.badge}</span>
          </div>

          <ul className="nav-list">
            {currentNavGroup.items.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.to} className="nav-item">
                  <NavLink
                    to={item.to}
                    onClick={closeMobileMenu}
                    className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                  >
                    <Icon size={18} className="nav-icon" />
                    <span className="nav-label">{item.label}</span>
                  </NavLink>
                </li>
              );
            })}
          </ul>

          {!isAuthenticated && (
            <>
              <div className="nav-divider" />
              <div className="nav-group-title">
                <span>Account</span>
              </div>
              <ul className="nav-list">
                <li className="nav-item">
                  <Link to="/login" onClick={closeMobileMenu} className="nav-link">
                    <LogOut size={18} className="nav-icon" />
                    <span className="nav-label">Sign In</span>
                  </Link>
                </li>
              </ul>
            </>
          )}
        </nav>

        {/* Sidebar Footer */}
        <div className="sidebar-footer">
          <div className="user-profile-badge">
            <div className="avatar-circle">
              <User size={16} />
            </div>
            <div className="user-info">
              <span className="user-name">
                {profile?.displayName || user?.displayName || user?.email || 'Member'}
              </span>
              <span className="user-role-tag">
                {isAuthenticated ? userRole.toUpperCase() : 'VISITOR'}
              </span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="app-main">
        {/* Top Header */}
        <header className="app-header">
          <div className="header-left">
            <button
              className="hamburger-btn"
              onClick={toggleMobileMenu}
              aria-label="Toggle navigation menu"
            >
              <Menu size={22} />
            </button>
            <div className="header-breadcrumbs">
              <span className="breadcrumb-root">Gym</span>
              <ChevronRight size={14} className="breadcrumb-sep" />
              <span className="breadcrumb-role">{currentNavGroup.badge}</span>
              <ChevronRight size={14} className="breadcrumb-sep" />
              <span className="breadcrumb-current">{currentTitle}</span>
            </div>
          </div>

          <div className="header-right">
            {canPromptInstall && (
              <button
                type="button"
                className="btn btn-secondary header-login-btn"
                onClick={promptInstall}
                disabled={isPrompting}
                aria-label="Install IRONCORE app"
              >
                <Download size={15} />
                <span>Install</span>
              </button>
            )}
            <div className="status-indicator">
              <span className="status-ping"></span>
              <span className="status-text">{isAuthenticated ? 'Online' : 'Signed out'}</span>
            </div>
            <button className="icon-btn" aria-label="Notifications">
              <Bell size={18} />
            </button>
            <button
              type="button"
              className="btn btn-secondary header-login-btn"
              onClick={handleLogout}
            >
              <LogOut size={16} />
              <span>Log out</span>
            </button>
          </div>
        </header>

        {logoutError && (
          <p
            role="alert"
            className="text-danger"
            style={{ padding: 'var(--spacing-2) var(--spacing-6)' }}
          >
            {logoutError}
          </p>
        )}

        {/* Routed Page Content */}
        <main className="content-container">
          {showInstallBanner && (
            <PwaInstallBanner
              canPromptInstall={canPromptInstall}
              isIosInstallable={isIosInstallable}
              isPrompting={isPrompting}
              onInstall={promptInstall}
              onDismiss={dismissBanner}
            />
          )}
          <Outlet />
        </main>
      </div>
    </div>
  );
}
