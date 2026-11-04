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
  UserX,
  Layers,
  ShieldCheck,
  Settings,
  User,
  LogOut,
  Bell,
  ChevronRight,
} from 'lucide-react';
import './AppShell.css';

/**
 * Navigation items grouped by role as defined in the product blueprint.
 */
const ROLE_NAV_CONFIG = {
  owner: {
    label: 'Owner Portal',
    badge: 'Owner',
    items: [
      { to: '/owner/dashboard', label: 'Daily Report', icon: BarChart3, screen: 'Screen 9' },
      { to: '/owner/inactive', label: 'Inactive Members', icon: UserX, screen: 'Screen 10' },
      { to: '/owner/plans', label: 'Membership Plans', icon: Layers, screen: 'Plans' },
      { to: '/owner/staff', label: 'Staff Approvals', icon: ShieldCheck, screen: 'Staff' },
      { to: '/owner/settings', label: 'Gym Settings', icon: Settings, screen: 'Settings' },
    ],
  },
  reception: {
    label: 'Reception Portal',
    badge: 'Reception',
    items: [
      { to: '/reception/attendance', label: "Today's Attendance", icon: CalendarCheck, screen: 'Screen 4' },
      { to: '/reception/fees', label: 'Fees Entry', icon: Receipt, screen: 'Screen 5' },
      { to: '/reception/renewals', label: 'Renewal List', icon: Clock, screen: 'Screen 6' },
      { to: '/reception/register', label: 'New Member', icon: UserPlus, screen: 'Register' },
    ],
  },
  trainer: {
    label: 'Trainer Portal',
    badge: 'Trainer',
    items: [
      { to: '/trainer/members', label: 'My Members', icon: Users, screen: 'Screen 7' },
      { to: '/trainer/diet', label: 'Diet Plans', icon: Utensils, screen: 'Screen 8' },
      { to: '/trainer/workouts', label: 'Workout Builder', icon: Activity, screen: 'Workouts' },
    ],
  },
  member: {
    label: 'Member Portal',
    badge: 'Member',
    items: [
      { to: '/member/join', label: 'Online Joining', icon: CreditCard, screen: 'Screen 1' },
      { to: '/member/attendance', label: 'QR Attendance', icon: QrCode, screen: 'Screen 2' },
      { to: '/member/workout', label: 'Workout Plan', icon: Dumbbell, screen: 'Screen 3' },
      { to: '/member/profile', label: 'My Membership', icon: User, screen: 'Profile' },
    ],
  },
};

export default function AppShell() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  // Active role group can be determined from current URL path or switched
  const currentPathRole = location.pathname.split('/')[1];
  const defaultRole = ['owner', 'reception', 'trainer', 'member'].includes(currentPathRole)
    ? currentPathRole
    : 'owner';

  const [activeRole, setActiveRole] = useState(defaultRole);

  const toggleMobileMenu = () => setMobileMenuOpen((prev) => !prev);
  const closeMobileMenu = () => setMobileMenuOpen(false);

  // Find current screen title
  const currentNavGroup = ROLE_NAV_CONFIG[activeRole] || ROLE_NAV_CONFIG.owner;
  const currentItem = currentNavGroup.items.find((item) => item.to === location.pathname);
  const currentTitle = currentItem ? currentItem.label : 'Gym Management System';

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

        {/* Role Selector Tabs (Preview mode for 4 distinct role portals) */}
        <div className="role-selector-wrap">
          <span className="role-selector-label">Role Workspace</span>
          <div className="role-tabs">
            {Object.keys(ROLE_NAV_CONFIG).map((roleKey) => (
              <button
                key={roleKey}
                type="button"
                className={`role-tab-btn ${activeRole === roleKey ? 'active' : ''}`}
                onClick={() => {
                  setActiveRole(roleKey);
                }}
              >
                {roleKey.charAt(0).toUpperCase() + roleKey.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Navigation Links for Active Role */}
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
                    <span className="nav-screen-tag">{item.screen}</span>
                  </NavLink>
                </li>
              );
            })}
          </ul>

          <div className="nav-divider" />

          {/* Quick link to Auth portal */}
          <div className="nav-group-title">
            <span>Authentication</span>
          </div>
          <ul className="nav-list">
            <li className="nav-item">
              <Link to="/login" onClick={closeMobileMenu} className="nav-link">
                <LogOut size={18} className="nav-icon" />
                <span className="nav-label">Sign In / Switch</span>
              </Link>
            </li>
          </ul>
        </nav>

        {/* Sidebar Footer */}
        <div className="sidebar-footer">
          <div className="user-profile-badge">
            <div className="avatar-circle">
              <User size={16} />
            </div>
            <div className="user-info">
              <span className="user-name">Active User</span>
              <span className="user-role-tag">{activeRole}</span>
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
            <div className="status-indicator">
              <span className="status-ping"></span>
              <span className="status-text">Online</span>
            </div>
            <button className="icon-btn" aria-label="Notifications">
              <Bell size={18} />
            </button>
            <Link to="/login" className="btn btn-secondary header-login-btn">
              <span>Login</span>
            </Link>
          </div>
        </header>

        {/* Routed Page Content */}
        <main className="content-container">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
