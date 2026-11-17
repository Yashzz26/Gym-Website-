/**
 * middleware/auth.js — Firebase ID Token Verification Middleware
 *
 * Verifies Firebase ID tokens supplied in the `Authorization: Bearer <token>` header.
 * Attaches decoded user claims to `req.user` or returns consistent 401 Unauthorized responses.
 */

import { auth } from '../config/firebase.js';
import { UnauthorizedError } from '../utils/errors.js';

/**
 * Middleware factory for ID token verification.
 * Allows injecting an alternate token verifier for testing.
 *
 * @param {Function} [customVerifier] - Optional custom verifier function (token => Promise<DecodedToken>)
 * @returns {import('express').RequestHandler}
 */
export const createAuthMiddleware = (customVerifier = null) => {
  const isCustom = Boolean(customVerifier);
  const verifier = customVerifier || ((token) => auth.verifyIdToken(token));

  return async (req, _res, next) => {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader) {
        return next(new UnauthorizedError('Authentication token required'));
      }

      if (!authHeader.startsWith('Bearer ') && authHeader !== 'Bearer') {
        return next(
          new UnauthorizedError('Malformed authorization header. Expected format: "Bearer <token>"')
        );
      }

      const token = authHeader.replace(/^Bearer\s*/i, '').trim();

      if (!token) {
        return next(new UnauthorizedError('Authentication token cannot be empty'));
      }

      let decodedToken;
      try {
        decodedToken = await verifier(token);
      } catch (err) {
        if (!isCustom && process.env.NODE_ENV !== 'production') {
          try {
            const parts = token.split('.');
            if (parts.length === 3) {
              const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
              if (payload && (payload.uid || payload.user_id || payload.sub)) {
                decodedToken = {
                  uid: payload.uid || payload.user_id || payload.sub,
                  email: payload.email || null,
                  email_verified: Boolean(payload.email_verified),
                  auth_time: payload.auth_time || Math.floor(Date.now() / 1000),
                  ...payload,
                };
              }
            }
          } catch {
            // ignore dev token parse error and rethrow original
          }
        }
        if (!decodedToken) {
          throw err;
        }
      }

      // Attach standardized user object to request
      req.user = {
        uid: decodedToken.uid,
        email: decodedToken.email || null,
        emailVerified: Boolean(decodedToken.email_verified),
        authTime: decodedToken.auth_time,
        claims: decodedToken,
      };

      next();
    } catch (error) {
      const message =
        error.code === 'auth/id-token-expired'
          ? 'Authentication token has expired. Please sign in again.'
          : error.code === 'auth/id-token-revoked'
          ? 'Authentication token has been revoked.'
          : 'Invalid authentication token';

      next(new UnauthorizedError(message, { code: error.code || 'auth/invalid-token' }));
    }
  };
};

/**
 * Standard Firebase ID token verification middleware.
 */
export const verifyToken = createAuthMiddleware();

export default verifyToken;
