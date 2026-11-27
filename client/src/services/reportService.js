/**
 * services/reportService.js — Client Service for Owner Analytics Reports (Day 26 Task 51/52)
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
    const error = new Error(body.message || 'Report service request failed');
    error.status = res.status;
    error.data = body;
    throw error;
  }

  return body;
}

/**
 * Fetch daily revenue, attendance, and member retention report.
 */
export async function fetchDailyReport(date = null, token = null) {
  const query = date ? `?date=${encodeURIComponent(date)}` : '';
  const response = await fetchWithAuth(`${API_BASE}/reports/daily${query}`, {}, token);
  return response.data;
}

/**
 * Fetch weekly 7-day rolling analytics report with trend chart data.
 */
export async function fetchWeeklyReport(endDate = null, days = 7, token = null) {
  const params = new URLSearchParams();
  if (endDate) params.set('endDate', endDate);
  if (days) params.set('days', String(days));
  const query = params.toString() ? `?${params.toString()}` : '';

  const response = await fetchWithAuth(`${API_BASE}/reports/weekly${query}`, {}, token);
  return response.data;
}

/**
 * Fetch tabular export data for CSV download.
 */
export async function fetchReportExport({ type = 'daily', date = null, endDate = null }, token = null) {
  const params = new URLSearchParams({ type });
  if (date) params.set('date', date);
  if (endDate) params.set('endDate', endDate);

  const response = await fetchWithAuth(`${API_BASE}/reports/export?${params.toString()}`, {}, token);
  return response.data;
}

/**
 * Helper to download CSV data in the browser.
 */
export function downloadCsv(filename, headers, rows) {
  const csvContent = [
    headers.map((h) => `"${String(h).replace(/"/g, '""')}"`).join(','),
    ...rows.map((row) =>
      row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')
    ),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename || 'report.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
