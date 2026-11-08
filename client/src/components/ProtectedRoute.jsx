/**
 * components/ProtectedRoute.jsx — Authentication & Role-Based Route Guards
 *
 * IMPORTANT: Frontend route guards are UX only. The Express server enforces
 * authorization with Firebase Admin SDK on every API call. Never rely on
 * client-side guards for security decisions.
 *
 * Components exported:
 *   ProtectedRoute  — requires a signed-in user; redirects to /login otherwise.
 *   RoleGuard       — requires the user's Firestore role to match the allowed
 *                     roles; redirects to the user's own portal if mismatched.
 *   ActiveGuard     — requires approvalStatus === 'active'; shows blocking
 *                     message for pending/suspended users.
 */

import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// ---------------------------------------------------------------------------
// Role → default landing route mapping
// ---------------------------------------------------------------------------
const ROLE_HOME = {
  owner: '/owner/dashboard',
  reception: '/reception/attendance',
  trainer: '/trainer/members',
  member: '/member/join',
};

// ---------------------------------------------------------------------------
// Loading spinner (inline — no extra dependency)
// ---------------------------------------------------------------------------
function LoadingScreen({ message = 'Loading…' }) {
  return (
    <div
      role="status"
      aria-label={message}
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        color: 'var(--color-text-secondary, #6b7280)',
        fontSize: '0.9rem',
      }}
    >
      {message}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ProtectedRoute
// ---------------------------------------------------------------------------
/**
 * Wraps routes that require authentication.
 *
 * Renders children / <Outlet> when the user is signed in.
 * Redirects to /login (preserving the intended URL in state) when not.
 *
 * @example
 * <Route element={<ProtectedRoute />}>
 *   <Route path="/member/profile" element={<MemberProfilePage />} />
 * </Route>
 */
export function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingScreen message="Verifying your session…" />;

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}

// ---------------------------------------------------------------------------
// RoleGuard
// ---------------------------------------------------------------------------
/**
 * Wraps role-restricted routes.
 * Must be nested inside <ProtectedRoute> so `user` is guaranteed to exist.
 *
 * - Shows a loading screen while Firestore profile is loading.
 * - Redirects the user to their own portal when their role isn't in `allowedRoles`.
 * - Renders the outlet when the role matches.
 *
 * @param {{ allowedRoles: string[] }} props
 *
 * @example
 * <Route element={<ProtectedRoute />}>
 *   <Route element={<RoleGuard allowedRoles={['owner']} />}>
 *     <Route path="/owner/dashboard" element={<DailyReportPage />} />
 *   </Route>
 * </Route>
 */
export function RoleGuard({ allowedRoles }) {
  const { profile, profileLoading } = useAuth();

  if (profileLoading) return <LoadingScreen message="Loading your profile…" />;

  // No Firestore profile yet — treat conservatively (newly registered / no .env)
  if (!profile) return <Outlet />;

  const allowed = new Set(allowedRoles);

  if (!allowed.has(profile.role)) {
    const redirectTo = ROLE_HOME[profile.role] || '/';
    return <Navigate to={redirectTo} replace />;
  }

  return <Outlet />;
}

// ---------------------------------------------------------------------------
// ActiveGuard
// ---------------------------------------------------------------------------
/**
 * Blocks pending or suspended users from accessing the application shell.
 * Shows an informative inline message rather than a redirect so users can
 * still reach the logout button in the header.
 *
 * Must be nested inside <ProtectedRoute>.
 */
export function ActiveGuard() {
  const { profile, profileLoading } = useAuth();

  if (profileLoading) return <LoadingScreen message="Loading your profile…" />;

  if (!profile) return <Outlet />;

  if (profile.approvalStatus === 'pending') {
    return (
      <div
        role="alert"
        style={{
          minHeight: '60vh',
          display: 'grid',
          placeItems: 'center',
          textAlign: 'center',
          padding: '2rem',
          color: 'var(--color-text-secondary, #6b7280)',
        }}
      >
        <div>
          <h2 style={{ marginBottom: '0.5rem' }}>Account Pending Approval</h2>
          <p>
            Your account is awaiting approval by the gym owner. You will receive a notification once
            your account is activated.
          </p>
        </div>
      </div>
    );
  }

  if (profile.approvalStatus === 'suspended') {
    return (
      <div
        role="alert"
        style={{
          minHeight: '60vh',
          display: 'grid',
          placeItems: 'center',
          textAlign: 'center',
          padding: '2rem',
          color: 'var(--color-danger, #ef4444)',
        }}
      >
        <div>
          <h2 style={{ marginBottom: '0.5rem' }}>Account Suspended</h2>
          <p>Your account has been suspended. Please contact the gym for assistance.</p>
        </div>
      </div>
    );
  }

  return <Outlet />;
}

