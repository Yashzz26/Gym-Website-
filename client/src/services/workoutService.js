/**
 * services/workoutService.js — Client Service for Workout Plans & Logs (Day 20 Tasks 39 & 40)
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
 * Fetch workout plans with optional filters (memberId, weekDay, trainerId).
 *
 * @param {string} authToken
 * @param {Object} [params]
 * @param {string} [params.memberId]
 * @param {string} [params.weekDay]
 * @param {string} [params.trainerId]
 * @returns {Promise<Array<Object>>}
 */
export async function getWorkoutPlans(authToken, params = {}) {
  const query = new URLSearchParams();
  if (params.memberId) query.set('memberId', params.memberId);
  if (params.weekDay) query.set('weekDay', params.weekDay);
  if (params.trainerId) query.set('trainerId', params.trainerId);

  const queryString = query.toString();
  const url = `${API_BASE}/workouts/plans${queryString ? `?${queryString}` : ''}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: getHeaders(authToken),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(body.message || 'Failed to fetch workout plans');
    error.status = res.status;
    error.code = body.code;
    throw error;
  }

  return Array.isArray(body.data) ? body.data : [];
}

/**
 * Fetch a single workout plan by ID.
 *
 * @param {string} planId
 * @param {string} authToken
 * @returns {Promise<Object>}
 */
export async function getWorkoutPlanById(planId, authToken) {
  const res = await fetch(`${API_BASE}/workouts/plans/${planId}`, {
    method: 'GET',
    headers: getHeaders(authToken),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(body.message || 'Failed to fetch workout plan');
    error.status = res.status;
    error.code = body.code;
    throw error;
  }

  return body.data;
}

/**
 * Create a new workout plan (trainers/owners only).
 *
 * @param {Object} planData
 * @param {string} authToken
 * @returns {Promise<Object>}
 */
export async function createWorkoutPlan(planData, authToken) {
  const res = await fetch(`${API_BASE}/workouts/plans`, {
    method: 'POST',
    headers: getHeaders(authToken),
    body: JSON.stringify(planData),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(body.message || 'Failed to create workout plan');
    error.status = res.status;
    error.code = body.code;
    throw error;
  }

  return body.data;
}

/**
 * Update an existing workout plan.
 *
 * @param {string} planId
 * @param {Object} updateData
 * @param {string} authToken
 * @returns {Promise<Object>}
 */
export async function updateWorkoutPlan(planId, updateData, authToken) {
  const res = await fetch(`${API_BASE}/workouts/plans/${planId}`, {
    method: 'PUT',
    headers: getHeaders(authToken),
    body: JSON.stringify(updateData),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(body.message || 'Failed to update workout plan');
    error.status = res.status;
    error.code = body.code;
    throw error;
  }

  return body.data;
}

/**
 * Delete a workout plan.
 *
 * @param {string} planId
 * @param {string} authToken
 * @returns {Promise<boolean>}
 */
export async function deleteWorkoutPlan(planId, authToken) {
  const res = await fetch(`${API_BASE}/workouts/plans/${planId}`, {
    method: 'DELETE',
    headers: getHeaders(authToken),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(body.message || 'Failed to delete workout plan');
    error.status = res.status;
    error.code = body.code;
    throw error;
  }

  return true;
}

/**
 * Log daily workout completion (members only).
 *
 * @param {Object} logData
 * @param {string} authToken
 * @returns {Promise<Object>}
 */
export async function logWorkoutCompletion(logData, authToken) {
  const res = await fetch(`${API_BASE}/workouts/logs`, {
    method: 'POST',
    headers: getHeaders(authToken),
    body: JSON.stringify(logData),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(body.message || 'Failed to record workout completion');
    error.status = res.status;
    error.code = body.code;
    throw error;
  }

  return body.data;
}

/**
 * Fetch workout completion logs.
 *
 * @param {string} authToken
 * @param {Object} [params]
 * @param {string} [params.memberId]
 * @param {string} [params.startDate]
 * @param {string} [params.endDate]
 * @param {number} [params.limit]
 * @returns {Promise<Array<Object>>}
 */
export async function getWorkoutLogs(authToken, params = {}) {
  const query = new URLSearchParams();
  if (params.memberId) query.set('memberId', params.memberId);
  if (params.startDate) query.set('startDate', params.startDate);
  if (params.endDate) query.set('endDate', params.endDate);
  if (params.limit) query.set('limit', String(params.limit));

  const queryString = query.toString();
  const url = `${API_BASE}/workouts/logs${queryString ? `?${queryString}` : ''}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: getHeaders(authToken),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(body.message || 'Failed to fetch workout logs');
    error.status = res.status;
    error.code = body.code;
    throw error;
  }

  return Array.isArray(body.data) ? body.data : [];
}
