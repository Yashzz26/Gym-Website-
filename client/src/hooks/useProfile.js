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

    getDoc(doc(firebaseDb, 'users', user.uid))
      .then((snap) => {
        if (cancelled) return;

        if (snap.exists()) {
          const data = snap.data();
          setProfile({
            uid: user.uid,
            role: data.role || 'member',
            approvalStatus: data.approvalStatus || 'pending',
            displayName: data.displayName || user.displayName || null,
            email: data.email || user.email || null,
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
      .catch((err) => {
        if (cancelled) return;
        console.error('[useProfile] Failed to fetch user profile:', err);
        setError(err);
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

