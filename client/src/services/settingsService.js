/**
 * services/settingsService.js — Client Service for Gym Settings & Session Windows
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export async function getGymSettings(token = null) {
  const headers = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}/api/settings`, {
    headers,
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(body.message || 'Failed to fetch gym settings');
    error.status = response.status;
    error.data = body;
    throw error;
  }

  return body.data;
}

export async function updateGymSettings(settingsData, token) {
  const response = await fetch(`${API_BASE_URL}/api/settings`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(settingsData),
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(body.message || 'Failed to update gym settings');
    error.status = response.status;
    error.data = body;
    throw error;
  }

  return body.data;
}
