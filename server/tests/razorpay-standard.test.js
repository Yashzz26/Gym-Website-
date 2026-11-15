/**
 * tests/razorpay-standard.test.js — Integration Tests for Razorpay Standard Checkout Endpoints
 *
 * Validates:
 * 1. POST /api/create-order: amount >= 100 paise, returns { order_id, amount, currency }
 * 2. POST /api/create-order: rejects invalid/missing amount or amount < 100 paise
 * 3. POST /api/verify-payment: verifies valid HMAC-SHA256 signature
 * 4. POST /api/verify-payment: rejects invalid HMAC-SHA256 signature with 400
 * 5. POST /api/verify-payment: rejects missing parameters with 400
 */

process.env.NODE_ENV = 'test';
process.env.TEST_MODE = 'true';
process.env.LOG_FORMAT = 'json';
process.env.RAZORPAY_KEY_ID = 'rzp_test_U0JejejMXMSerJ';
process.env.RAZORPAY_KEY_SECRET = 'R9u1z124TwsA3cQ3T0iIy5O2';

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import crypto from 'node:crypto';

import { createPaymentService } from '../services/paymentService.js';
import { createPaymentController } from '../controllers/paymentController.js';
import { notFound } from '../middleware/notFound.js';
import { errorHandler } from '../middleware/errorHandler.js';

const TEST_SECRET = 'R9u1z124TwsA3cQ3T0iIy5O2';
const TEST_KEY_ID = 'rzp_test_U0JejejMXMSerJ';

function createMockRazorpay() {
  return {
    keyId: TEST_KEY_ID,
    keySecret: TEST_SECRET,
    orders: {
      async create(params) {
        return {
          id: `order_test_${Date.now()}`,
          entity: 'order',
          amount: params.amount,
          amount_paid: 0,
          amount_due: params.amount,
          currency: params.currency || 'INR',
          receipt: params.receipt,
          status: 'created',
        };
      },
    },
  };
}

describe('Razorpay Standard Checkout Endpoints (/api/create-order & /api/verify-payment)', () => {
  let server;
  let port;
  let baseUrl;

  before(async () => {
    const mockRazorpay = createMockRazorpay();
    const service = createPaymentService(null, mockRazorpay);
    const controller = createPaymentController(service);

    const app = express();
    app.use(express.json());

    // Mount standard checkout endpoints
    app.post('/api/create-order', controller.createDirectOrder);
    app.post('/api/verify-payment', controller.verifyPaymentSignature);

    app.use(notFound);
    app.use(errorHandler);

    await new Promise((resolve) => {
      server = http.createServer(app);
      server.listen(0, '127.0.0.1', () => {
        port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  async function request(path, options = {}) {
    const res = await fetch(`${baseUrl}${path}`, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  }

  test('POST /api/create-order - creates order with minimum 100 paise', async () => {
    const res = await request('/api/create-order', {
      method: 'POST',
      body: {
        amount: 50000,
        currency: 'INR',
        receipt: 'rcpt_test_01',
      },
    });

    assert.equal(res.status, 200);
    assert.ok(res.data.order_id);
    assert.equal(res.data.amount, 50000);
    assert.equal(res.data.currency, 'INR');
  });

  test('POST /api/create-order - rejects amount less than 100 paise', async () => {
    const res = await request('/api/create-order', {
      method: 'POST',
      body: {
        amount: 99,
        currency: 'INR',
      },
    });

    assert.equal(res.status, 400);
    assert.match(res.data.message, /Amount must be at least 100 paise/i);
  });

  test('POST /api/create-order - rejects missing or non-numeric amount', async () => {
    const res = await request('/api/create-order', {
      method: 'POST',
      body: {
        amount: 'invalid',
      },
    });

    assert.equal(res.status, 400);
    assert.match(res.data.message, /Amount must be at least 100 paise/i);
  });

  test('POST /api/verify-payment - verifies valid HMAC-SHA256 signature', async () => {
    const orderId = 'order_test_123456';
    const paymentId = 'pay_test_789012';
    const expectedSignature = crypto
      .createHmac('sha256', TEST_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    const res = await request('/api/verify-payment', {
      method: 'POST',
      body: {
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: expectedSignature,
      },
    });

    assert.equal(res.status, 200);
    assert.equal(res.data.success, true);
    assert.match(res.data.message, /verified successfully/i);
    assert.equal(res.data.order_id, orderId);
    assert.equal(res.data.payment_id, paymentId);
  });

  test('POST /api/verify-payment - accepts alternative field names (order_id, payment_id, signature)', async () => {
    const orderId = 'order_test_alt_123';
    const paymentId = 'pay_test_alt_456';
    const expectedSignature = crypto
      .createHmac('sha256', TEST_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    const res = await request('/api/verify-payment', {
      method: 'POST',
      body: {
        order_id: orderId,
        payment_id: paymentId,
        signature: expectedSignature,
      },
    });

    assert.equal(res.status, 200);
    assert.equal(res.data.success, true);
  });

  test('POST /api/verify-payment - rejects tampered/invalid signature with 400', async () => {
    const orderId = 'order_test_123456';
    const paymentId = 'pay_test_789012';
    const fakeSignature = crypto
      .createHmac('sha256', 'wrong_secret')
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    const res = await request('/api/verify-payment', {
      method: 'POST',
      body: {
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: fakeSignature,
      },
    });

    assert.equal(res.status, 400);
    assert.match(res.data.message, /Invalid payment signature/i);
  });

  test('POST /api/verify-payment - rejects missing required parameters with 400', async () => {
    const res = await request('/api/verify-payment', {
      method: 'POST',
      body: {
        razorpay_order_id: 'order_test_123',
        // missing payment_id and signature
      },
    });

    assert.equal(res.status, 400);
    assert.match(res.data.message, /Missing/i);
  });
});

