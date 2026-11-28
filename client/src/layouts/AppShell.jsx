import { useState, useEffect } from 'react';
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
  WifiOff,
  PanelLeftClose,
  PanelLeftOpen,
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [notificationsPath, setNotificationsPath] = useState(null);
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean'
      ? navigator.onLine
      : true
  );
  const location = useLocation();
  const notificationsOpen = notificationsPath === location.pathname;

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
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
  const isMemberPortal = userRole === 'member';
  const displayName =
    profile?.displayName || user?.displayName || user?.email?.split('@')[0] || 'Member';
  const memberInitial = (displayName[0] || 'M').toUpperCase();

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
    <div
      className={`app-shell ${isMemberPortal ? 'is-member-shell' : ''} ${
        isMemberPortal && sidebarCollapsed ? 'is-sidebar-collapsed' : ''
      }`.trim()}
    >
      {/* Mobile Backdrop */}
      {mobileMenuOpen && (
        <div className="sidebar-backdrop" onClick={closeMobileMenu} aria-hidden="true" />
      )}

      {/* Sidebar Navigation */}
      <aside className={`app-sidebar ${mobileMenuOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <div className="brand-logo-wrap" aria-hidden="true">
            <Dumbbell className="brand-icon" size={18} strokeWidth={1.75} />
          </div>
          {!sidebarCollapsed && (
            <div className="brand-text">
              <span className="brand-title">IRONCORE</span>
              <span className="brand-subtitle">
                {isMemberPortal ? 'Member' : 'Gym Management'}
              </span>
            </div>
          )}
          {isMemberPortal && (
            <button
              type="button"
              className="sidebar-collapse-btn"
              onClick={() => setSidebarCollapsed((prev) => !prev)}
              aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-expanded={!sidebarCollapsed}
              title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {sidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
            </button>
          )}
          <button
            className="mobile-close-btn"
            onClick={closeMobileMenu}
            aria-label="Close navigation"
          >
            <X size={20} />
          </button>
        </div>

        {/* Non-member portals retain workspace banner until their dedicated redesign */}
        {!isMemberPortal && (
          <div className="sidebar-workspace-header">
            <div className="workspace-welcome-badge">
              <span className="welcome-role-tag">
                {userRole === 'owner'
                  ? 'Owner Workspace'
                  : userRole === 'reception'
                  ? 'Reception Workspace'
                  : 'Trainer Workspace'}
              </span>
            </div>
            <div className="workspace-greeting">
              <span className="workspace-hello">
                {userRole === 'owner'
                  ? 'Welcome, Owner'
                  : userRole === 'reception'
                  ? 'Welcome, Reception'
                  : 'Welcome, Trainer'}
              </span>
              <span className="workspace-user-name">{displayName}</span>
            </div>
          </div>
        )}

        {/* Navigation Links for Authenticated Role */}
        <nav className="sidebar-nav" aria-label={currentNavGroup.label}>
          {!sidebarCollapsed && (
            <div className="nav-group-title">
              <span>{isMemberPortal ? 'Navigation' : currentNavGroup.label}</span>
              {!isMemberPortal && (
                <span className="badge badge-accent">{currentNavGroup.badge}</span>
              )}
            </div>
          )}

          <ul className="nav-list">
            {currentNavGroup.items.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.to} className="nav-item">
                  <NavLink
                    to={item.to}
                    onClick={closeMobileMenu}
                    title={sidebarCollapsed ? item.label : undefined}
                    className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                  >
                    <Icon size={17} strokeWidth={1.65} className="nav-icon" />
                    {!sidebarCollapsed && <span className="nav-label">{item.label}</span>}
                  </NavLink>
                </li>
              );
            })}
          </ul>

          {!isAuthenticated && (
            <>
              <div className="nav-divider" />
              {!sidebarCollapsed && (
                <div className="nav-group-title">
                  <span>Account</span>
                </div>
              )}
              <ul className="nav-list">
                <li className="nav-item">
                  <Link to="/login" onClick={closeMobileMenu} className="nav-link">
                    <LogOut size={17} strokeWidth={1.65} className="nav-icon" />
                    {!sidebarCollapsed && <span className="nav-label">Sign In</span>}
                  </Link>
                </li>
              </ul>
            </>
          )}
        </nav>

        {/* Sidebar Footer */}
        <div className="sidebar-footer">
          {isMemberPortal ? (
            <Link
              to="/member/profile"
              onClick={closeMobileMenu}
              className="user-profile-badge user-profile-link"
              title={sidebarCollapsed ? `${displayName} — My Membership` : undefined}
            >
              <div className="avatar-circle is-member-avatar">{memberInitial}</div>
              {!sidebarCollapsed && (
                <div className="user-info">
                  <span className="user-name">{displayName}</span>
                  <span className="user-email-meta">
                    {profile?.email || user?.email || 'Member account'}
                  </span>
                </div>
              )}
            </Link>
          ) : (
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
          )}
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
              <Menu size={20} strokeWidth={1.75} />
            </button>
            <div className="header-breadcrumbs">
              {isMemberPortal ? (
                <>
                  <Link to="/member/profile" className="breadcrumb-root">
                    IRONCORE
                  </Link>
                  <ChevronRight size={14} className="breadcrumb-sep" />
                  <span className="breadcrumb-current">{currentTitle}</span>
                </>
              ) : (
                <>
                  <span className="breadcrumb-root">Gym</span>
                  <ChevronRight size={14} className="breadcrumb-sep" />
                  <span className="breadcrumb-role">{currentNavGroup.badge}</span>
                  <ChevronRight size={14} className="breadcrumb-sep" />
                  <span className="breadcrumb-current">{currentTitle}</span>
                </>
              )}
            </div>
          </div>

          <div className="header-right">
            {canPromptInstall && (
              <button
                type="button"
                className="btn btn-secondary btn-sm header-login-btn"
                onClick={promptInstall}
                disabled={isPrompting}
                aria-label="Install IRONCORE app"
              >
                <Download size={15} strokeWidth={1.65} />
                <span>Install</span>
              </button>
            )}
            <div className={`status-indicator ${isOnline ? '' : 'is-offline'}`}>
              <span className="status-ping"></span>
              <span className="status-text">
                {!isOnline ? 'Offline' : isAuthenticated ? 'Online' : 'Signed out'}
              </span>
            </div>
            <div className="header-notification-wrap">
              <button
                type="button"
                className={`icon-btn ${notificationsOpen ? 'is-open' : ''}`}
                aria-label="Notifications"
                aria-expanded={notificationsOpen}
                onClick={() =>
                  setNotificationsPath((prev) =>
                    prev === location.pathname ? null : location.pathname
                  )
                }
              >
                <Bell size={16} strokeWidth={1.65} />
              </button>
              {notificationsOpen && (
                <div className="header-popover" role="dialog" aria-label="Notifications">
                  <div className="header-popover-title">Notifications</div>
                  <p className="header-popover-empty">
                    {isOnline
                      ? 'You are caught up. No unread gym alerts right now.'
                      : 'Connection offline. Check-in and payment alerts pause until online.'}
                  </p>
                </div>
              )}
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm header-login-btn"
              onClick={handleLogout}
            >
              <LogOut size={15} strokeWidth={1.65} />
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
          {!isOnline && (
            <div className="offline-status-banner" role="status" data-testid="offline-banner">
              <WifiOff size={16} strokeWidth={1.75} />
              <span>
                You are offline. QR attendance check-ins and Razorpay payments require a live connection.
              </span>
            </div>
          )}
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
