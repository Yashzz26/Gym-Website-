/**
 * services/qrService.js — Rotating QR Token Service with Replay Prevention
 *
 * Implements Day 16 Task 31:
 * - Generates short-lived HMAC-signed gym QR tokens (default 60s TTL).
 * - Payload contains: { gymId, iat, exp, nonce }.
 * - Atomically consumes each nonce in Firestore to prevent replay attacks.
 * - Returns distinct error codes: 'invalid', 'expired', and 'replayed'.
 */

import crypto from 'node:crypto';
import { db as defaultDb } from '../config/firebase.js';
import { QrTokenError } from '../utils/errors.js';

const DEFAULT_SECRET =
  process.env.QR_SIGNING_SECRET ||
  process.env.JWT_SECRET ||
  'fitmax-qr-rotating-token-signing-secret-2026';

const DEFAULT_TTL_SECONDS = 60;
const DEFAULT_GYM_ID = 'fitmax-main';

export const createQrService = (customDb = defaultDb, customSecret = DEFAULT_SECRET) => {
  const getCollection = (name) => {
    if (!customDb) throw new Error('[QrService] Firestore DB not initialized');
    return customDb.collection(name);
  };

  /**
   * Helper: create HMAC-SHA256 signature for base64url payload
   */
  const signPayload = (payloadBase64, secret = customSecret) => {
    return crypto
      .createHmac('sha256', secret)
      .update(payloadBase64)
      .digest('base64url');
  };

  /**
   * Helper: securely verify HMAC-SHA256 signature using constant-time comparison
   */
  const verifySignature = (payloadBase64, signature, secret = customSecret) => {
    const expectedSignature = signPayload(payloadBase64, secret);
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expectedSignature);

    if (sigBuf.length !== expBuf.length) {
      return false;
    }
    return crypto.timingSafeEqual(sigBuf, expBuf);
  };

  /**
   * Helper: decode and verify token structure without checking DB
   */
  const decodeAndVerifySignature = (tokenString) => {
    if (!tokenString || typeof tokenString !== 'string') {
      throw new QrTokenError('Token is required and must be a string', 'invalid', 400);
    }

    const parts = tokenString.split('.');
    if (parts.length !== 2) {
      throw new QrTokenError('Malformed QR token structure', 'invalid', 400);
    }

    const [payloadBase64, signature] = parts;

    if (!verifySignature(payloadBase64, signature)) {
      throw new QrTokenError('Invalid QR token signature', 'invalid', 400);
    }

    let payload;
    try {
      const decodedJson = Buffer.from(payloadBase64, 'base64url').toString('utf8');
      payload = JSON.parse(decodedJson);
    } catch {
      throw new QrTokenError('Invalid QR token payload encoding', 'invalid', 400);
    }

    const { gymId, iat, exp, nonce } = payload;
    if (!gymId || typeof iat !== 'number' || typeof exp !== 'number' || !nonce) {
      throw new QrTokenError('Incomplete QR token payload fields', 'invalid', 400);
    }

    return { payload, payloadBase64, signature };
  };

  return {
    /**
     * Generate a new signed rotating QR token and persist in qrTokens collection.
     *
     * @param {Object} [options]
     * @param {string} [options.gymId='fitmax-main']
     * @param {number} [options.ttlSeconds=60]
     * @returns {Promise<Object>}
     */
    async generateToken({ gymId = DEFAULT_GYM_ID, ttlSeconds = DEFAULT_TTL_SECONDS } = {}) {
      const nowSeconds = Math.floor(Date.now() / 1000);
      const iat = nowSeconds;
      const exp = nowSeconds + ttlSeconds;
      const nonce = crypto.randomBytes(16).toString('hex');

      const payload = { gymId, iat, exp, nonce };
      const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
      const signature = signPayload(payloadBase64);
      const token = `${payloadBase64}.${signature}`;

      const expiresAt = new Date(exp * 1000).toISOString();
      const createdAt = new Date(iat * 1000).toISOString();

      // Persist in qrTokens collection (keyed by nonce for fast lookup)
      await getCollection('qrTokens').doc(nonce).set({
        nonce,
        token,
        gymId,
        iat,
        exp,
        expiresAt,
        createdAt,
        isConsumed: false,
        consumedAt: null,
        consumedBy: null,
      });

      return {
        token,
        gymId,
        iat,
        exp,
        expiresInSeconds: ttlSeconds,
        nonce,
        expiresAt,
      };
    },

    /**
     * Retrieve the currently active QR token or generate a new one if expired.
     *
     * @param {Object} [options]
     * @param {string} [options.gymId='fitmax-main']
     * @param {number} [options.ttlSeconds=60]
     * @returns {Promise<Object>}
     */
    async getCurrentToken({ gymId = DEFAULT_GYM_ID, ttlSeconds = DEFAULT_TTL_SECONDS } = {}) {
      const nowSeconds = Math.floor(Date.now() / 1000);

      // Check if there is an unconsumed token in Firestore with at least 5 seconds left
      const snap = await getCollection('qrTokens')
        .where('gymId', '==', gymId)
        .where('isConsumed', '==', false)
        .get();

      let activeTokenDoc = null;
      snap.forEach((doc) => {
        const data = doc.data();
        if (data.exp > nowSeconds + 4) {
          if (!activeTokenDoc || data.exp > activeTokenDoc.exp) {
            activeTokenDoc = data;
          }
        }
      });

      if (activeTokenDoc) {
        const remainingSeconds = Math.max(0, activeTokenDoc.exp - nowSeconds);
        return {
          token: activeTokenDoc.token,
          gymId: activeTokenDoc.gymId,
          iat: activeTokenDoc.iat,
          exp: activeTokenDoc.exp,
          expiresInSeconds: remainingSeconds,
          nonce: activeTokenDoc.nonce,
          expiresAt: activeTokenDoc.expiresAt,
        };
      }

      // No active token found or expired — generate fresh token
      return this.generateToken({ gymId, ttlSeconds });
    },

    /**
     * Validate token without consuming it.
     * Throws distinct QrTokenError: 'invalid', 'expired', or 'replayed'.
     *
     * @param {string} tokenString
     * @param {string} [expectedGymId]
     * @returns {Promise<Object>} { valid: true, payload }
     */
    async validateToken(tokenString, expectedGymId = null) {
      const { payload } = decodeAndVerifySignature(tokenString);
      const nowSeconds = Math.floor(Date.now() / 1000);

      // 1. Check gymId match if expected
      if (expectedGymId && payload.gymId !== expectedGymId) {
        throw new QrTokenError('QR token is for a different gym branch', 'invalid', 400);
      }

      // 2. Check expiration
      if (nowSeconds > payload.exp) {
        throw new QrTokenError('QR token has expired', 'expired', 400, {
          exp: payload.exp,
          now: nowSeconds,
        });
      }

      // 3. Check Firestore for consumption status
      const doc = await getCollection('qrTokens').doc(payload.nonce).get();
      if (!doc.exists) {
        throw new QrTokenError('QR token nonce is unrecognized', 'invalid', 400);
      }

      const data = doc.data();
      if (data.isConsumed || data.consumedAt) {
        throw new QrTokenError(
          'QR token has already been used and cannot be replayed',
          'replayed',
          409,
          { nonce: payload.nonce }
        );
      }

      return { valid: true, payload };
    },

    /**
     * Atomically verify and consume a rotating QR token for check-in.
     * Prevents replay attacks by marking the token nonce consumed.
     *
     * @param {string} tokenString
     * @param {string|null} [memberId=null]
     * @param {string|null} [expectedGymId=null]
     * @returns {Promise<Object>} Decoded payload & consumption record
     */
    async verifyAndConsumeToken(tokenString, memberId = null, expectedGymId = null) {
      const { payload } = decodeAndVerifySignature(tokenString);
      const nowSeconds = Math.floor(Date.now() / 1000);

      // 1. Gym ID check
      if (expectedGymId && payload.gymId !== expectedGymId) {
        throw new QrTokenError('QR token is for a different gym branch', 'invalid', 400);
      }

      // 2. Expiration check
      if (nowSeconds > payload.exp) {
        throw new QrTokenError('QR token has expired', 'expired', 400, {
          exp: payload.exp,
          now: nowSeconds,
        });
      }

      const tokenRef = getCollection('qrTokens').doc(payload.nonce);
      const nowIso = new Date().toISOString();

      // 3. Atomic consumption via Firestore Transaction or fallback get/update
      if (typeof customDb.runTransaction === 'function') {
        await customDb.runTransaction(async (transaction) => {
          const doc = await transaction.get(tokenRef);
          if (!doc.exists) {
            throw new QrTokenError('QR token nonce is unrecognized', 'invalid', 400);
          }

          const data = doc.data();
          if (data.isConsumed || data.consumedAt) {
            throw new QrTokenError(
              'QR token has already been used and cannot be replayed',
              'replayed',
              409,
              { nonce: payload.nonce }
            );
          }

          transaction.update(tokenRef, {
            isConsumed: true,
            consumedAt: nowIso,
            consumedBy: memberId || null,
          });
        });
      } else {
        // Fallback for mock environments lacking runTransaction
        const doc = await tokenRef.get();
        if (!doc.exists) {
          throw new QrTokenError('QR token nonce is unrecognized', 'invalid', 400);
        }
        const data = doc.data();
        if (data.isConsumed || data.consumedAt) {
          throw new QrTokenError(
            'QR token has already been used and cannot be replayed',
            'replayed',
            409,
            { nonce: payload.nonce }
          );
        }
        await tokenRef.update({
          isConsumed: true,
          consumedAt: nowIso,
          consumedBy: memberId || null,
        });
      }

      return {
        consumed: true,
        payload,
        consumedAt: nowIso,
        consumedBy: memberId,
      };
    },
  };
};

export const qrService = createQrService();
export default qrService;
