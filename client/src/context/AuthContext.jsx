import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { firebaseAuth } from '../config/firebase';
import { useProfile } from '../hooks/useProfile';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(firebaseAuth));

  useEffect(() => {
    if (!firebaseAuth) {
      return undefined;
    }

    return onAuthStateChanged(firebaseAuth, (nextUser) => {
      setUser(nextUser);
      setLoading(false);
    });
  }, []);

  // Fetch Firestore profile once auth state resolves
  const { profile, loading: profileLoading } = useProfile(loading ? null : user);

  const value = useMemo(
    () => ({
      user,
      loading,
      profile,
      profileLoading,
      isAuthenticated: Boolean(user),
    }),
    [loading, profile, profileLoading, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider.');
  }

  return context;
}
