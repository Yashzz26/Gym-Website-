/**
 * test/ProtectedRoute.test.jsx — Route guard integration tests
 *
 * Tests the UX behaviour of ProtectedRoute, RoleGuard, and ActiveGuard:
 * - Unauthenticated users → redirect to /login
 * - Authenticated users with correct role → render route content
 * - Authenticated users with wrong role → redirect to their own portal
 * - Pending users → show pending approval message
 * - Suspended users → show suspended message
 */

import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---- Mock firebase/firestore before importing modules that use it ----
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  getDoc: vi.fn(() => Promise.resolve({ exists: () => false, data: () => ({}) })),
}));

vi.mock('../config/firebase', () => ({
  firebaseAuth: null, // skip onAuthStateChanged in AuthContext for these tests
  firebaseDb: null,   // skip Firestore calls in useProfile
}));

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: vi.fn((_auth, cb) => { cb(null); return () => {}; }),
}));

// Import AFTER mocks are set up
import { ProtectedRoute, RoleGuard, ActiveGuard } from '../components/ProtectedRoute';
import { AuthContext } from '../context/AuthContext';

// ---- Helper: render with a custom AuthContext value ----
function renderWithAuth(ui, authValue, { initialEntries = ['/'] } = {}) {
  return render(
    <AuthContext.Provider value={authValue}>
      <MemoryRouter initialEntries={initialEntries}>
        {ui}
      </MemoryRouter>
    </AuthContext.Provider>
  );
}

// ---- Shared auth values ----
const signedOut = { user: null, loading: false, profile: null, profileLoading: false, isAuthenticated: false };
const ownerActive = { user: { uid: 'u1' }, loading: false, isAuthenticated: true, profileLoading: false, profile: { role: 'owner', approvalStatus: 'active' } };
const memberActive = { user: { uid: 'u2' }, loading: false, isAuthenticated: true, profileLoading: false, profile: { role: 'member', approvalStatus: 'active' } };
const memberPending = { user: { uid: 'u3' }, loading: false, isAuthenticated: true, profileLoading: false, profile: { role: 'member', approvalStatus: 'pending' } };
const memberSuspended = { user: { uid: 'u4' }, loading: false, isAuthenticated: true, profileLoading: false, profile: { role: 'member', approvalStatus: 'suspended' } };

describe('ProtectedRoute', () => {
  it('redirects unauthenticated users to /login', () => {
    renderWithAuth(
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<div>Protected Content</div>} />
        </Route>
        <Route path="/login" element={<div>Login Page</div>} />
      </Routes>,
      signedOut,
      { initialEntries: ['/'] }
    );

    expect(screen.getByText('Login Page')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('renders outlet for authenticated users', () => {
    renderWithAuth(
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<div>Protected Content</div>} />
        </Route>
        <Route path="/login" element={<div>Login Page</div>} />
      </Routes>,
      ownerActive,
      { initialEntries: ['/'] }
    );

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });
});

describe('RoleGuard', () => {
  it('renders outlet when user role matches allowedRoles', () => {
    renderWithAuth(
      <Routes>
        <Route element={<RoleGuard allowedRoles={['owner']} />}>
          <Route path="/" element={<div>Owner Dashboard</div>} />
        </Route>
        <Route path="/owner/dashboard" element={<div>Owner Home</div>} />
      </Routes>,
      ownerActive,
      { initialEntries: ['/'] }
    );

    expect(screen.getByText('Owner Dashboard')).toBeInTheDocument();
  });

  it('redirects member trying to access owner route to member portal', () => {
    renderWithAuth(
      <Routes>
        <Route element={<RoleGuard allowedRoles={['owner']} />}>
          <Route path="/owner/dashboard" element={<div>Owner Dashboard</div>} />
        </Route>
        <Route path="/member/join" element={<div>Member Portal</div>} />
      </Routes>,
      memberActive,
      { initialEntries: ['/owner/dashboard'] }
    );

    expect(screen.getByText('Member Portal')).toBeInTheDocument();
    expect(screen.queryByText('Owner Dashboard')).not.toBeInTheDocument();
  });

  it('allows owner to access reception routes (owner has elevated access)', () => {
    renderWithAuth(
      <Routes>
        <Route element={<RoleGuard allowedRoles={['reception', 'owner']} />}>
          <Route path="/" element={<div>Reception Area</div>} />
        </Route>
      </Routes>,
      ownerActive,
      { initialEntries: ['/'] }
    );

    expect(screen.getByText('Reception Area')).toBeInTheDocument();
  });
});

describe('ActiveGuard', () => {
  it('renders outlet for active users', () => {
    renderWithAuth(
      <Routes>
        <Route element={<ActiveGuard />}>
          <Route path="/" element={<div>App Content</div>} />
        </Route>
      </Routes>,
      memberActive,
      { initialEntries: ['/'] }
    );

    expect(screen.getByText('App Content')).toBeInTheDocument();
  });

  it('shows pending approval message for pending users', () => {
    renderWithAuth(
      <Routes>
        <Route element={<ActiveGuard />}>
          <Route path="/" element={<div>App Content</div>} />
        </Route>
      </Routes>,
      memberPending,
      { initialEntries: ['/'] }
    );

    expect(screen.getByText(/Account Pending Approval/i)).toBeInTheDocument();
    expect(screen.queryByText('App Content')).not.toBeInTheDocument();
  });

  it('shows suspended message for suspended users', () => {
    renderWithAuth(
      <Routes>
        <Route element={<ActiveGuard />}>
          <Route path="/" element={<div>App Content</div>} />
        </Route>
      </Routes>,
      memberSuspended,
      { initialEntries: ['/'] }
    );

    expect(screen.getByText(/Account Suspended/i)).toBeInTheDocument();
    expect(screen.queryByText('App Content')).not.toBeInTheDocument();
  });
});

