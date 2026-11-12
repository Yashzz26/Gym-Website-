/**
 * services/receptionService.js — Client Service for Reception Desk Operations
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

export async function registerMember(memberData, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}/reception/members`, {
    method: 'POST',
    headers,
    body: JSON.stringify(memberData),
  });

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    const error = new Error(body.message || 'Failed to register member');
    error.status = res.status;
    error.data = body;
    throw error;
  }

  return body.data;
}

export async function listRecentMembers(token) {
  const headers = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}/reception/members`, {
    headers,
  });

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    const error = new Error(body.message || 'Failed to fetch members list');
    error.status = res.status;
    throw error;
  }

  return body.data || [];
}

