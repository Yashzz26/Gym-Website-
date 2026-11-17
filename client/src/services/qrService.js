/**
 * services/qrService.js — Client Service for Gym Rotating QR Operations (Day 16)
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

/**
 * Fetch the current active gym QR token for entrance display
 *
 * @param {string} token - Firebase ID token
 * @param {string} [gymId='fitmax-main']
 * @returns {Promise<Object>} { token, gymId, iat, exp, expiresInSeconds, nonce, expiresAt }
 */
export async function getCurrentQrToken(token, gymId = 'fitmax-main') {
  const headers = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}/qr/current?gymId=${encodeURIComponent(gymId)}`, {
    headers,
  });

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    const error = new Error(body.message || 'Failed to fetch current QR token');
    error.status = res.status;
    error.code = body.code;
    error.data = body;
    throw error;
  }

  return body.data;
}

/**
 * Force manual rotation of the gym QR token
 *
 * @param {string} token - Firebase ID token
 * @param {Object} [options]
 * @param {string} [options.gymId='fitmax-main']
 * @param {number} [options.ttlSeconds=60]
 * @returns {Promise<Object>}
 */
export async function rotateQrToken(token, { gymId = 'fitmax-main', ttlSeconds = 60 } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}/qr/rotate`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ gymId, ttlSeconds }),
  });

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    const error = new Error(body.message || 'Failed to rotate QR token');
    error.status = res.status;
    error.code = body.code;
    error.data = body;
    throw error;
  }

  return body.data;
}

/**
 * Validate a QR token without consuming it
 *
 * @param {string} tokenString - The QR token payload
 * @param {string} authToken - Firebase ID token
 * @param {string} [gymId]
 * @returns {Promise<Object>}
 */
export async function validateQrToken(tokenString, authToken, gymId) {
  const headers = { 'Content-Type': 'application/json' };
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  const res = await fetch(`${API_BASE}/qr/validate`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ token: tokenString, gymId }),
  });

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    const error = new Error(body.message || 'QR token validation failed');
    error.status = res.status;
    error.code = body.code;
    error.data = body;
    throw error;
  }

  return body.data;
}
