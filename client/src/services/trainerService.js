/**
 * services/trainerService.js — Client Service for Trainer Assignments & Member Progress (Day 19 Task 38)
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

/**
 * Fetch assigned members for the authenticated trainer (or owner query).
 *
 * @param {string} authToken - Firebase ID token
 * @param {string} [trainerId] - Optional trainerId query for owners
 * @returns {Promise<Array<Object>>}
 */
export async function getAssignedMembers(authToken, trainerId = null) {
  const headers = {};
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  const queryParams = new URLSearchParams();
  if (trainerId) queryParams.set('trainerId', trainerId);

  const url = `${API_BASE}/trainers/members${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  const res = await fetch(url, { headers });
  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    const error = new Error(body.message || 'Failed to fetch assigned members');
    error.status = res.status;
    error.code = body.code;
    throw error;
  }

  return Array.isArray(body.data) ? body.data : [];
}

/**
 * Fetch detailed profile and progress for a single assigned member.
 *
 * @param {string} memberId
 * @param {string} authToken
 * @returns {Promise<Object>}
 */
export async function getAssignedMemberDetails(memberId, authToken) {
  const headers = {};
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  const res = await fetch(`${API_BASE}/trainers/members/${memberId}`, { headers });
  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    const error = new Error(body.message || 'Failed to fetch member details');
    error.status = res.status;
    error.code = body.code;
    throw error;
  }

  return body.data;
}

/**
 * Update member fitness goal, weights, and coaching notes.
 *
 * @param {string} memberId
 * @param {Object} progressData - { fitnessGoal, currentWeightKg, targetWeightKg, notes }
 * @param {string} authToken
 * @returns {Promise<Object>}
 */
export async function updateMemberProgress(memberId, progressData, authToken) {
  const headers = { 'Content-Type': 'application/json' };
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  const res = await fetch(`${API_BASE}/trainers/members/${memberId}/progress`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(progressData),
  });

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    const error = new Error(body.message || 'Failed to update member progress');
    error.status = res.status;
    error.code = body.code;
    throw error;
  }

  return body.data;
}

/**
 * List all gym trainers.
 *
 * @param {string} authToken
 * @returns {Promise<Array<Object>>}
 */
export async function listTrainers(authToken) {
  const headers = {};
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  const res = await fetch(`${API_BASE}/trainers`, { headers });
  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    const error = new Error(body.message || 'Failed to fetch trainers');
    error.status = res.status;
    error.code = body.code;
    throw error;
  }

  return Array.isArray(body.data) ? body.data : [];
}

/**
 * Assign member to trainer (Owner / Reception).
 *
 * @param {Object} assignmentData - { trainerId, memberId, fitnessGoal, notes, currentWeightKg, targetWeightKg }
 * @param {string} authToken
 * @returns {Promise<Object>}
 */
export async function assignMember(assignmentData, authToken) {
  const headers = { 'Content-Type': 'application/json' };
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  const res = await fetch(`${API_BASE}/trainers/assign`, {
    method: 'POST',
    headers,
    body: JSON.stringify(assignmentData),
  });

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    const error = new Error(body.message || 'Failed to assign member to trainer');
    error.status = res.status;
    error.code = body.code;
    throw error;
  }

  return body.data;
}

/**
 * Unassign member from trainer (Owner / Reception).
 *
 * @param {Object} unassignData - { memberId, trainerId, reason }
 * @param {string} authToken
 * @returns {Promise<Object>}
 */
export async function unassignMember(unassignData, authToken) {
  const headers = { 'Content-Type': 'application/json' };
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  const res = await fetch(`${API_BASE}/trainers/unassign`, {
    method: 'POST',
    headers,
    body: JSON.stringify(unassignData),
  });

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    const error = new Error(body.message || 'Failed to unassign member');
    error.status = res.status;
    error.code = body.code;
    throw error;
  }

  return body.data;
}

export default {
  getAssignedMembers,
  getAssignedMemberDetails,
  updateMemberProgress,
  listTrainers,
  assignMember,
  unassignMember,
};
