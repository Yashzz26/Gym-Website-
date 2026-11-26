/**
 * services/whatsappService.js — Client Service for WhatsApp Cloud API & Template Dispatch (Day 25 Task 49)
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
    const error = new Error(body.message || 'WhatsApp service request failed');
    error.status = res.status;
    error.data = body;
    throw error;
  }

  return body;
}

/**
 * Dispatch an approved WhatsApp template to a recipient.
 */
export async function sendWhatsAppTemplate(
  {
    to,
    templateName,
    languageCode = 'en_US',
    variables = [],
    buttonParams = [],
    memberId = null,
    triggerType = 'manual',
    metadata = {},
  },
  token = null
) {
  const response = await fetchWithAuth(
    `${API_BASE}/whatsapp/send`,
    {
      method: 'POST',
      body: JSON.stringify({
        to,
        templateName,
        languageCode,
        variables,
        buttonParams,
        memberId,
        triggerType,
        metadata,
      }),
    },
    token
  );
  return response.data;
}

/**
 * Retrieve WhatsApp message delivery logs.
 */
export async function getWhatsAppDeliveryLogs(params = {}, token = null) {
  const query = new URLSearchParams();
  if (params.recipientPhone) query.set('recipientPhone', params.recipientPhone);
  if (params.templateName) query.set('templateName', params.templateName);
  if (params.status) query.set('status', params.status);
  if (params.memberId) query.set('memberId', params.memberId);
  if (params.limit) query.set('limit', String(params.limit));

  const url = `${API_BASE}/whatsapp/logs${query.toString() ? `?${query.toString()}` : ''}`;
  const response = await fetchWithAuth(url, { method: 'GET' }, token);
  return response.data || [];
}

/**
 * Retrieve WhatsApp service health and configuration diagnostic summary.
 */
export async function getWhatsAppStatus(token = null) {
  const response = await fetchWithAuth(`${API_BASE}/whatsapp/status`, { method: 'GET' }, token);
  return response.data;
}

/**
 * Update member WhatsApp opt-in / opt-out preferences.
 */
export async function updateMemberWhatsAppOpt(userId, optIn, token = null) {
  const response = await fetchWithAuth(
    `${API_BASE}/whatsapp/opt-status/${userId}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ optIn: Boolean(optIn) }),
    },
    token
  );
  return response.data;
}
