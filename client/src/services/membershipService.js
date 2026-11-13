/**
 * services/membershipService.js — Client Service for Membership Lifecycle & Renewals
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

async function fetchWithAuth(url, options = {}, token = null) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(url, { ...options, headers });
  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    const error = new Error(body.message || 'Membership service request failed');
    error.status = res.status;
    error.data = body;
    throw error;
  }

  return body;
}

export async function getUserMemberships(userId, token) {
  const response = await fetchWithAuth(
    `${API_BASE}/memberships/user/${userId}`,
    { method: 'GET' },
    token
  );
  return response.data;
}

export async function getMembership(membershipId, token) {
  const response = await fetchWithAuth(
    `${API_BASE}/memberships/${membershipId}`,
    { method: 'GET' },
    token
  );
  return response.data;
}

export async function renewMembership(membershipId, renewalData = {}, token) {
  const response = await fetchWithAuth(
    `${API_BASE}/memberships/${membershipId}/renew`,
    {
      method: 'POST',
      body: JSON.stringify(renewalData),
    },
    token
  );
  return response.data;
}

export async function createMembership(data, token) {
  const response = await fetchWithAuth(
    `${API_BASE}/memberships`,
    {
      method: 'POST',
      body: JSON.stringify(data),
    },
    token
  );
  return response.data;
}
