/**
 * config/razorpay.js — Razorpay Payment Gateway Client Configuration
 *
 * Initializes Razorpay SDK client using environment variables:
 * - RAZORPAY_KEY_ID (e.g. rzp_test_...)
 * - RAZORPAY_KEY_SECRET
 *
 * In test or unconfigured environments, provides safe fallback handling
 * so automated test suites can inject mock orders or run deterministically.
 */

import Razorpay from 'razorpay';

export function createRazorpayClient({
  keyId = process.env.RAZORPAY_KEY_ID,
  keySecret = process.env.RAZORPAY_KEY_SECRET,
} = {}) {
  const isConfigured = Boolean(keyId && keySecret);

  if (!isConfigured) {
    if (process.env.NODE_ENV !== 'test') {
      console.warn(
        '[RazorpayConfig] RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET not set. Using test mode / stub client.'
      );
    }

    return {
      isConfigured: false,
      keyId: keyId || 'rzp_test_placeholder',
      orders: {
        async create(params) {
          return {
            id: `order_mock_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            entity: 'order',
            amount: params.amount,
            amount_paid: 0,
            amount_due: params.amount,
            currency: params.currency || 'INR',
            receipt: params.receipt,
            status: 'created',
            attempts: 0,
            notes: params.notes || {},
            created_at: Math.floor(Date.now() / 1000),
          };
        },
      },
    };
  }

  const instance = new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });

  instance.isConfigured = true;
  instance.keyId = keyId;

  return instance;
}

export const razorpayClient = createRazorpayClient();
export default razorpayClient;
