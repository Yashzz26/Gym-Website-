/**
 * services/attendanceService.js — Client Service for Member Attendance & Check-ins (Day 17)
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

/**
 * Submit scanned QR token to perform attendance check-in.
 *
 * @param {string} token - The scanned rotating QR token string
 * @param {string} authToken - Firebase ID token of the authenticated member
 * @param {string} [gymId='fitmax-main'] - Gym branch identifier
 * @returns {Promise<Object>} Check-in confirmation data
 */
export async function checkInAttendance(token, authToken, gymId = 'fitmax-main') {
  if (!token || typeof token !== 'string') {
    throw new Error('QR token is required for check-in');
  }

  const headers = { 'Content-Type': 'application/json' };
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  const res = await fetch(`${API_BASE}/attendance/check-in`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ token: token.trim(), gymId }),
  });

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    const error = new Error(body.message || 'Attendance check-in failed');
    error.status = res.status;
    error.code = body.code || 'CHECK_IN_FAILED';
    error.data = body;
    throw error;
  }

  return body.data;
}

/**
 * Fetch member's own attendance summary and streak history
 *
 * @param {string} authToken - Firebase ID token
 * @returns {Promise<Object>}
 */
export async function getMyAttendance(authToken) {
  const headers = {};
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  const res = await fetch(`${API_BASE}/attendance/me`, {
    headers,
  });

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    const error = new Error(body.message || 'Failed to fetch attendance history');
    error.status = res.status;
    error.code = body.code;
    throw error;
  }

  return body.data;
}

export default {
  checkInAttendance,
  getMyAttendance,
};
