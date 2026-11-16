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

/**
 * Record a manual cash or UPI payment (Day 15 Task 29/30)
 *
 * @param {Object} paymentData
 * @param {string} paymentData.memberId
 * @param {string} paymentData.planId
 * @param {'cash'|'upi'} paymentData.method
 * @param {number} paymentData.amountPaise
 * @param {string} [paymentData.upiReference]
 * @param {string} [paymentData.remarks]
 * @param {boolean} [paymentData.isRenewal]
 * @param {string} token
 */
export async function recordManualPayment(paymentData, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}/reception/payments`, {
    method: 'POST',
    headers,
    body: JSON.stringify(paymentData),
  });

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    const error = new Error(body.message || 'Failed to record payment');
    error.status = res.status;
    error.data = body;
    throw error;
  }

  return body.data;
}

/**
 * List recent manual payments recorded at the reception desk
 *
 * @param {Object} query - { memberId?, method?, limit? }
 * @param {string} token
 */
export async function listManualPayments(query = {}, token) {
  const headers = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const params = new URLSearchParams();
  if (query.memberId) params.append('memberId', query.memberId);
  if (query.method && query.method !== 'all') params.append('method', query.method);
  if (query.limit) params.append('limit', String(query.limit));

  const qs = params.toString() ? `?${params.toString()}` : '';
  const res = await fetch(`${API_BASE}/reception/payments${qs}`, {
    headers,
  });

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    const error = new Error(body.message || 'Failed to fetch manual payments');
    error.status = res.status;
    throw error;
  }

  return body.data || [];
}

/**
 * Get details of a single manual payment
 *
 * @param {string} paymentId
 * @param {string} token
 */
export async function getManualPayment(paymentId, token) {
  const headers = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}/reception/payments/${paymentId}`, {
    headers,
  });

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    const error = new Error(body.message || 'Failed to fetch payment details');
    error.status = res.status;
    throw error;
  }

  return body.data;
}


