/**
 * services/paymentService.js — Client Service for Razorpay Orders & Gateway Integration
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
    const error = new Error(body.message || 'Payment request failed');
    error.status = res.status;
    error.data = body;
    throw error;
  }

  return body;
}

/**
 * Request server to generate an authenticated Razorpay Order.
 *
 * @param {Object} data - { planId, isRenewal, notes }
 * @param {string|null} token - Firebase ID token
 * @returns {Promise<Object>} Created order data (orderId, amount, currency, keyId)
 */
export async function createRazorpayOrder(data, token) {
  const response = await fetchWithAuth(
    `${API_BASE}/payments/razorpay/order`,
    {
      method: 'POST',
      body: JSON.stringify(data),
    },
    token
  );
  return response.data;
}

/**
 * Standard checkout endpoint: Create order with amount (in paise).
 * POST /api/create-order
 *
 * @param {Object} data - { amount, currency, receipt, notes }
 * @returns {Promise<Object>} { order_id, amount, currency, key_id }
 */
export async function createOrder(data) {
  const response = await fetchWithAuth(`${API_BASE}/create-order`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return response;
}

/**
 * Standard checkout endpoint: Verify HMAC-SHA256 signature.
 * POST /api/verify-payment
 *
 * @param {Object} data - { razorpay_order_id, razorpay_payment_id, razorpay_signature }
 * @returns {Promise<Object>} { success: true, message, order_id, payment_id }
 */
export async function verifyPayment(data) {
  const response = await fetchWithAuth(`${API_BASE}/verify-payment`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return response;
}

/**
 * Verify Razorpay payment signature and activate membership.
 * POST /api/payments/razorpay/verify
 *
 * @param {Object} data - { razorpay_payment_id, razorpay_order_id, razorpay_signature }
 * @param {string|null} token - Firebase ID token
 * @returns {Promise<Object>} Verification response
 */
export async function verifyRazorpayPayment(data, token) {
  const response = await fetchWithAuth(
    `${API_BASE}/payments/razorpay/verify`,
    {
      method: 'POST',
      body: JSON.stringify(data),
    },
    token
  );
  return response;
}

/**
 * Retrieve a payment transaction by ID.
 */
export async function getPayment(paymentId, token) {
  const response = await fetchWithAuth(
    `${API_BASE}/payments/${paymentId}`,
    { method: 'GET' },
    token
  );
  return response.data;
}

/**
 * Dynamically injects and loads the Razorpay checkout script if not present.
 *
 * @returns {Promise<boolean>}
 */
export function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (typeof window !== 'undefined' && window.Razorpay) {
      resolve(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

