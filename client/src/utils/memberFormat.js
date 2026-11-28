/**
 * memberFormat.js — Consistent formatting helpers for the IRONCORE Member Portal
 */

/**
 * Format an amount in paise as an Indian Rupee string without decimals.
 */
export function formatInrFromPaise(paise) {
  if (typeof paise !== 'number' || Number.isNaN(paise)) return '₹0';
  return `₹${Math.round(paise / 100).toLocaleString('en-IN')}`;
}

/**
 * Format an ISO timestamp or YYYY-MM-DD string consistently as "1 Nov 2026".
 */
export function formatDisplayDate(value) {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Format a payment method key for human-readable display.
 */
export function formatPaymentMethod(method) {
  if (!method) return 'Online';
  const normalized = String(method).trim().toLowerCase();
  const labels = {
    online: 'Online',
    upi: 'UPI',
    cash: 'Cash at desk',
    razorpay: 'Online (Razorpay)',
    card: 'Card',
  };
  return labels[normalized] || method;
}
