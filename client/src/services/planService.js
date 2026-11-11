/**
 * services/planService.js — Client Service for Membership Plans
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export async function listPlans(token = null, { activeOnly = false } = {}) {
  const headers = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const query = activeOnly ? '?activeOnly=true' : '';
  const response = await fetch(`${API_BASE_URL}/api/plans${query}`, {
    headers,
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(body.message || 'Failed to fetch membership plans');
    error.status = response.status;
    throw error;
  }

  return body.data || [];
}

export async function createPlan(planData, token) {
  const response = await fetch(`${API_BASE_URL}/api/plans`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(planData),
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(body.message || 'Failed to create membership plan');
    error.status = response.status;
    error.data = body;
    throw error;
  }

  return body.data;
}

export async function updatePlan(planId, updates, token) {
  const response = await fetch(`${API_BASE_URL}/api/plans/${planId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(updates),
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(body.message || 'Failed to update membership plan');
    error.status = response.status;
    error.data = body;
    throw error;
  }

  return body.data;
}

export async function setPlanStatus(planId, isActive, token) {
  const response = await fetch(`${API_BASE_URL}/api/plans/${planId}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ isActive }),
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(body.message || 'Failed to update plan status');
    error.status = response.status;
    error.data = body;
    throw error;
  }

  return body.data;
}

