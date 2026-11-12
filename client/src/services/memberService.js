/**
 * services/memberService.js — Client Service for Member Operations & Online Joining
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

export async function selectPlan(selectionData, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}/members/select-plan`, {
    method: 'POST',
    headers,
    body: JSON.stringify(selectionData),
  });

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    const error = new Error(body.message || 'Failed to select membership plan');
    error.status = res.status;
    error.data = body;
    throw error;
  }

  return body.data;
}

export async function getMyMembership(token) {
  const headers = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}/members/my-membership`, {
    headers,
  });

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    const error = new Error(body.message || 'Failed to fetch current membership');
    error.status = res.status;
    throw error;
  }

  return body.data;
}
