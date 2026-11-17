/**
 * middleware/rbac.js — Role-Based Access Control & Account-Status Middleware
 *
 * Requires that `verifyToken` (middleware/auth.js) has already run and
 * populated `req.user` with { uid, email, emailVerified, claims }.
 *
 * Supported roles (least → most privileged): member, trainer, reception, owner
 * Supported account statuses: active | pending | suspended
 *
 * Design note: Firebase Admin SDK bypasses Firestore Security Rules, so role
 * and status data are read server-side from Firestore (trusted path) rather
 * than relying on client-supplied ID token custom claims, which requires a
 * Cloud Functions deployment to stay up-to-date.
 */

import { db } from '../config/firebase.js';
import { ForbiddenError, UnauthorizedError } from '../utils/errors.js';

/** Ordered list of all valid roles (index = privilege level). */
export const ROLES = Object.freeze(['member', 'trainer', 'reception', 'owner']);

/** Statuses that are allowed to access protected resources. */
const ACTIVE_STATUSES = Object.freeze(new Set(['active']));

/**
 * Fetches the Firestore user document for the authenticated user.
 * Caches the result on `req.profile` to avoid duplicate Firestore reads
 * when multiple RBAC middlewares are chained on the same route.
 *
 * @param {import('express').Request} req
 * @returns {Promise<{role: string, approvalStatus: string, displayName: string|null, email: string|null}>}
 * @throws {UnauthorizedError} when no user document exists
 */
async function fetchUserProfile(req) {
  if (req.profile) return req.profile;

  if (!req.user?.uid) {
    throw new UnauthorizedError('Authentication required');
  }

  const userDoc = await db.collection('users').doc(req.user.uid).get();
  let data = userDoc.exists ? userDoc.data() : null;

  // Fallback 1: Lookup by email if document not keyed by UID
  if (!data && req.user.email) {
    try {
      const snap = await db.collection('users').where('email', '==', req.user.email).limit(1).get();
      if (!snap.empty) {
        data = snap.docs[0].data();
      }
    } catch {
      // Continue to dev fallback
    }
  }

  // Fallback 2: Auto-provision in non-production environments based on email role hint
  if (!data && process.env.NODE_ENV !== 'production') {
    const email = (req.user.email || '').toLowerCase();
    let autoRole = 'member';
    if (email.includes('owner')) autoRole = 'owner';
    else if (email.includes('reception')) autoRole = 'reception';
    else if (email.includes('trainer')) autoRole = 'trainer';

    data = {
      uid: req.user.uid,
      email: req.user.email,
      displayName: req.user.claims?.name || req.user.email?.split('@')[0] || 'Gym User',
      role: autoRole,
      approvalStatus: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      await db.collection('users').doc(req.user.uid).set(data);
    } catch {
      // Ignore if write fails
    }
  }

  if (!data) {
    throw new UnauthorizedError('User profile not found. Please complete registration.');
  }

  req.profile = {
    uid: req.user.uid,
    role: data.role || 'member',
    approvalStatus: data.approvalStatus || 'pending',
    displayName: data.displayName || null,
    email: data.email || req.user.email || null,
  };

  return req.profile;
}

/**
 * requireRole — middleware factory that restricts access to users with one of
 * the specified roles.
 *
 * Usage:
 *   router.get('/owner-only', verifyToken, requireRole('owner'), handler);
 *   router.get('/staff',      verifyToken, requireRole('owner', 'reception', 'trainer'), handler);
 *
 * @param {...string} allowedRoles - One or more roles that may access the route.
 * @returns {import('express').RequestHandler}
 */
export const requireRole = (...allowedRoles) => {
  const allowed = new Set(allowedRoles);

  // Validate role names at definition time (fail fast)
  for (const r of allowed) {
    if (!ROLES.includes(r)) {
      throw new Error(`[rbac] Unknown role "${r}". Valid roles: ${ROLES.join(', ')}`);
    }
  }

  return async (req, _res, next) => {
    try {
      const profile = await fetchUserProfile(req);

      if (!allowed.has(profile.role)) {
        return next(
          new ForbiddenError(
            `Access denied. Required role: ${[...allowed].join(' or ')}. Your role: ${profile.role}`
          )
        );
      }

      next();
    } catch (err) {
      next(err);
    }
  };
};

/**
 * requireActiveStatus — middleware that blocks pending or suspended accounts.
 *
 * Must be placed AFTER `verifyToken` and optionally after `requireRole`.
 * Returns 403 with a human-readable explanation for blocked accounts.
 *
 * @returns {import('express').RequestHandler}
 */
export const requireActiveStatus = async (req, _res, next) => {
  try {
    const profile = await fetchUserProfile(req);

    if (!ACTIVE_STATUSES.has(profile.approvalStatus)) {
      const reason =
        profile.approvalStatus === 'pending'
          ? 'Your account is pending approval by the gym owner. Please wait for activation.'
          : profile.approvalStatus === 'suspended'
          ? 'Your account has been suspended. Please contact the gym.'
          : `Your account status (${profile.approvalStatus}) does not permit access.`;

      return next(new ForbiddenError(reason, { approvalStatus: profile.approvalStatus }));
    }

    next();
  } catch (err) {
    next(err);
  }
};

/**
 * requireOwner — shorthand for requireRole('owner')
 */
export const requireOwner = requireRole('owner');

/**
 * requireStaff — shorthand for requireRole('owner', 'reception', 'trainer')
 */
export const requireStaff = requireRole('owner', 'reception', 'trainer');

/**
 * requireReception — shorthand for requireRole('owner', 'reception')
 */
export const requireReception = requireRole('owner', 'reception');

/**
 * requireTrainer — shorthand for requireRole('owner', 'trainer')
 */
export const requireTrainer = requireRole('owner', 'trainer');
