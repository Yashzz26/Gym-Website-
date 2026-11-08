import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// ---- Mock firebase modules before App imports them ----
vi.mock('../config/firebase', () => ({
  firebaseAuth: null,
  firebaseDb: null,
  isFirebaseConfigured: false,
}));

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: vi.fn((_auth, cb) => {
    cb(null); // Simulate no signed-in user
    return () => {};
  }),
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  getDoc: vi.fn(() => Promise.resolve({ exists: () => false, data: () => ({}) })),
}));

import App from '../App';

describe('Client Application Shell & Routing Smoke Tests', () => {
  it('redirects unauthenticated users to login page and shows brand', () => {
    render(<App />);

    // The brand heading always appears in AuthLayout too
    const brands = screen.getAllByText('IRONCORE');
    expect(brands.length).toBeGreaterThan(0);

    // ProtectedRoute redirects to /login when no user; login form should render
    expect(screen.getByRole('heading', { name: /sign in/i })).toBeInTheDocument();
  });

  it('renders the sign-in form for unauthenticated users on default route', () => {
    render(<App />);

    // Login page shows sign-in button
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('renders authentication layout links for unauthenticated users', () => {
    render(<App />);

    // AuthLayout includes "Return to Application" back link
    const backLinks = screen.getAllByRole('link', { name: /return to application/i });
    expect(backLinks.length).toBeGreaterThan(0);
  });
});
