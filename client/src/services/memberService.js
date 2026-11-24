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

export async function getInactiveMembers(options = {}, token) {
  const headers = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const daysInactive = options.daysInactive || 7;
  const limit = options.limit || 50;
  const query = new URLSearchParams({
    daysInactive: String(daysInactive),
    limit: String(limit),
  }).toString();

  const res = await fetch(`${API_BASE}/members/inactive?${query}`, {
    headers,
  });

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    const error = new Error(body.message || 'Failed to fetch inactive members');
    error.status = res.status;
    throw error;
  }

  return {
    members: body.data || [],
    summary: body.summary || {},
    total: body.total || 0,
    daysInactiveThreshold: body.daysInactiveThreshold || daysInactive,
  };
}

export async function recordFollowUp(memberId, followUpData = {}, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}/members/${memberId}/follow-up`, {
    method: 'POST',
    headers,
    body: JSON.stringify(followUpData),
  });

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    const error = new Error(body.message || 'Failed to record follow-up');
    error.status = res.status;
    throw error;
  }

  return body.data;
}

