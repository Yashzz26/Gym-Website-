/**
 * hooks/useProfile.js — Firestore user profile hook
 *
 * Fetches the authenticated user's Firestore profile document containing:
 *   - role: 'owner' | 'reception' | 'trainer' | 'member'
 *   - approvalStatus: 'active' | 'pending' | 'suspended'
 *   - displayName, email
 *
 * Notes:
 *   • Frontend guards are UX-only. The Express server enforces authorization
 *     with Firebase Admin SDK and Firestore reads that bypass client rules.
 *   • Profile is re-fetched when the authenticated user changes.
 *   • Returns { profile, loading, error } — consumers must handle all states.
 */

import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { firebaseDb } from '../config/firebase';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

async function fetchBackendProfile(user) {
  if (typeof user?.getIdToken !== 'function' || typeof fetch !== 'function') {
    return null;
  }
  try {
    const token = await user.getIdToken();
    if (!token) return null;
    const res = await fetch(`${API_BASE}/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const json = await res.json().catch(() => null);
    return json?.data?.user || null;
  } catch {
    return null;
  }
}

/**
 * @typedef {Object} UserProfile
 * @property {string} uid
 * @property {'owner'|'reception'|'trainer'|'member'} role
 * @property {'active'|'pending'|'suspended'} approvalStatus
 * @property {string|null} displayName
 * @property {string|null} email
 */

/**
 * Fetches the Firestore profile for the given Firebase Auth user.
 *
 * @param {import('firebase/auth').User|null} user - Firebase Auth user object
 * @returns {{ profile: UserProfile|null, loading: boolean, error: Error|null }}
 */
export function useProfile(user) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(Boolean(user));
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      setError(null);
      return;
    }

    if (!firebaseDb) {
      // Firebase not configured (test / no .env) — treat as no profile
      setProfile(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      getDoc(doc(firebaseDb, 'users', user.uid)).catch((err) => ({ _error: err })),
      fetchBackendProfile(user),
    ])
      .then(([snap, backendUser]) => {
        if (cancelled) return;

        if (snap?._error && !backendUser) {
          console.error('[useProfile] Failed to fetch user profile:', snap._error);
          setError(snap._error);
          return;
        }

        const fsData = snap && !snap._error && snap.exists() ? snap.data() : null;

        if (fsData || backendUser) {
          const merged = { ...(fsData || {}), ...(backendUser || {}) };
          setProfile({
            uid: user.uid,
            role: merged.role || 'member',
            approvalStatus: merged.approvalStatus || 'pending',
            membershipStatus: merged.membershipStatus || null,
            activeMembershipId: merged.activeMembershipId || null,
            displayName: merged.displayName || user.displayName || null,
            email: merged.email || user.email || null,
            phone: merged.phone || null,
          });
        } else {
          // Document doesn't exist yet — treat as newly registered member
          setProfile({
            uid: user.uid,
            role: 'member',
            approvalStatus: 'pending',
            displayName: user.displayName || null,
            email: user.email || null,
          });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  return { profile, loading, error };
}

