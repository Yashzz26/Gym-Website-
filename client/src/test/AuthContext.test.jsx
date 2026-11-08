import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { onAuthStateChanged } = vi.hoisted(() => ({
  onAuthStateChanged: vi.fn(),
}));

vi.mock('../config/firebase', () => ({
  firebaseAuth: { name: 'test-auth' },
  firebaseDb: null, // Firestore not configured in tests
}));

vi.mock('firebase/auth', () => ({
  onAuthStateChanged,
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  getDoc: vi.fn(() => Promise.resolve({ exists: () => false, data: () => ({}) })),
}));

import { AuthProvider, useAuth } from '../context/AuthContext';

function AuthProbe() {
  const { user, loading, isAuthenticated } = useAuth();

  return (
    <div>
      <span>{loading ? 'loading' : 'ready'}</span>
      <span>{isAuthenticated ? user.displayName : 'signed out'}</span>
    </div>
  );
}

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    onAuthStateChanged.mockImplementation((_auth, callback) => {
      callback({ displayName: 'Member One' });
      return () => {};
    });
  });

  it('publishes the current Firebase user and loading state', () => {
    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    expect(onAuthStateChanged).toHaveBeenCalledWith(
      { name: 'test-auth' },
      expect.any(Function),
    );
    expect(screen.getByText('ready')).toBeInTheDocument();
    expect(screen.getByText('Member One')).toBeInTheDocument();
  });
});
