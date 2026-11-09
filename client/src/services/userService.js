/**
 * services/userService.js — Client API service for User Profiles & Staff Management
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

async function fetchWithAuth(endpoint, options = {}, token = null) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const error = new Error(data.message || 'Request failed');
    error.status = res.status;
    error.data = data;
    throw error;
  }

  return data;
}

/**
 * Fetch list of pending staff accounts awaiting approval (Owner only)
 */
export async function getPendingStaff(token) {
  const res = await fetchWithAuth('/api/users/staff/pending', { method: 'GET' }, token);
  return res.data?.staff || [];
}

/**
 * Approve a pending staff account
 */
export async function approveStaff(uid, assignedRole, token) {
  const res = await fetchWithAuth(
    `/api/users/${uid}/approve`,
    {
      method: 'PATCH',
      body: JSON.stringify({ assignedRole }),
    },
    token
  );
  return res.data?.user;
}

/**
 * Suspend or reject a staff account
 */
export async function suspendStaff(uid, reason, token) {
  const res = await fetchWithAuth(
    `/api/users/${uid}/suspend`,
    {
      method: 'PATCH',
      body: JSON.stringify({ reason }),
    },
    token
  );
  return res.data?.user;
}

/**
 * Direct staff creation by Owner
 */
export async function createStaffAccountByOwner(staffData, token) {
  const res = await fetchWithAuth(
    '/api/users/staff',
    {
      method: 'POST',
      body: JSON.stringify(staffData),
    },
    token
  );
  return res.data?.user;
}
