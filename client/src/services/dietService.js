/**
 * services/dietService.js — Client Service for Diet & Nutrition Plans (Day 21 Tasks 41 & 42)
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

/**
 * Helper to build auth headers
 */
function getHeaders(authToken) {
  const headers = { 'Content-Type': 'application/json' };
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }
  return headers;
}

/**
 * Fetch diet plans with optional memberId filter.
 *
 * @param {string} authToken
 * @param {Object} [params]
 * @param {string} [params.memberId]
 * @returns {Promise<Array<Object>>}
 */
export async function getDietPlans(authToken, params = {}) {
  const query = new URLSearchParams();
  if (params.memberId) query.set('memberId', params.memberId);

  const queryString = query.toString();
  const url = `${API_BASE}/diet/plans${queryString ? `?${queryString}` : ''}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: getHeaders(authToken),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(body.message || 'Failed to fetch diet plans');
    error.status = res.status;
    error.code = body.code;
    throw error;
  }

  return Array.isArray(body.data) ? body.data : [];
}

/**
 * Fetch a single diet plan by ID.
 *
 * @param {string} planId
 * @param {string} authToken
 * @returns {Promise<Object>}
 */
export async function getDietPlanById(planId, authToken) {
  const res = await fetch(`${API_BASE}/diet/plans/${planId}`, {
    method: 'GET',
    headers: getHeaders(authToken),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(body.message || 'Failed to fetch diet plan');
    error.status = res.status;
    error.code = body.code;
    throw error;
  }

  return body.data;
}

/**
 * Fetch currently active diet plan for a member.
 *
 * @param {string} memberId
 * @param {string} authToken
 * @returns {Promise<Object|null>}
 */
export async function getMemberActiveDietPlan(memberId, authToken) {
  const res = await fetch(`${API_BASE}/diet/members/${memberId}/active`, {
    method: 'GET',
    headers: getHeaders(authToken),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(body.message || 'Failed to fetch active diet plan');
    error.status = res.status;
    error.code = body.code;
    throw error;
  }

  return body.data || null;
}

/**
 * Create a new diet plan (trainer/owner).
 *
 * @param {Object} planData
 * @param {string} authToken
 * @returns {Promise<Object>}
 */
export async function createDietPlan(planData, authToken) {
  const res = await fetch(`${API_BASE}/diet/plans`, {
    method: 'POST',
    headers: getHeaders(authToken),
    body: JSON.stringify(planData),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(body.message || 'Failed to create diet plan');
    error.status = res.status;
    error.code = body.code;
    throw error;
  }

  return body.data;
}

/**
 * Update an existing diet plan (trainer/owner).
 *
 * @param {string} planId
 * @param {Object} updateData
 * @param {string} authToken
 * @returns {Promise<Object>}
 */
export async function updateDietPlan(planId, updateData, authToken) {
  const res = await fetch(`${API_BASE}/diet/plans/${planId}`, {
    method: 'PUT',
    headers: getHeaders(authToken),
    body: JSON.stringify(updateData),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(body.message || 'Failed to update diet plan');
    error.status = res.status;
    error.code = body.code;
    throw error;
  }

  return body.data;
}

/**
 * Delete a diet plan (trainer/owner).
 *
 * @param {string} planId
 * @param {string} authToken
 * @returns {Promise<boolean>}
 */
export async function deleteDietPlan(planId, authToken) {
  const res = await fetch(`${API_BASE}/diet/plans/${planId}`, {
    method: 'DELETE',
    headers: getHeaders(authToken),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(body.message || 'Failed to delete diet plan');
    error.status = res.status;
    error.code = body.code;
    throw error;
  }

  return true;
}
