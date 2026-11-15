/**
 * tests/payments.test.js — Automated Tests for Razorpay Orders API (Day 13 Task 25)
 */

process.env.NODE_ENV = 'test';
process.env.TEST_MODE = 'true';
process.env.LOG_FORMAT = 'json';

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import crypto from 'node:crypto';

import { createPaymentService } from '../services/paymentService.js';
import { createPaymentController } from '../controllers/paymentController.js';
import { createPaymentsRouter } from '../routes/payments.js';
import { notFound } from '../middleware/notFound.js';
import { errorHandler } from '../middleware/errorHandler.js';
import { UnauthorizedError } from '../utils/errors.js';

function createMockFirestore() {
  const usersStore = new Map([
    [
      'user-member-1',
      {
        uid: 'user-member-1',
        email: 'member1@gym.com',
        displayName: 'Member One',
        role: 'member',
        approvalStatus: 'active',
      },
    ],
    [
      'user-member-2',
      {
        uid: 'user-member-2',
        email: 'member2@gym.com',
        displayName: 'Member Two',
        role: 'member',
        approvalStatus: 'active',
      },
    ],
  ]);

  const plansStore = new Map([
    [
      'plan-3-months',
      {
        planId: 'plan-3-months',
        name: '3 Months Pro',
        durationDays: 90,
        priceInPaise: 399900,
        isActive: true,
      },
    ],
    [
      'plan-inactive',
      {
        planId: 'plan-inactive',
        name: 'Archived Plan',
        durationDays: 30,
        priceInPaise: 99900,
        isActive: false,
      },
    ],
  ]);

  const membershipsStore = new Map();
  const paymentsStore = new Map();

  return {
    usersStore,
    plansStore,
    membershipsStore,
    paymentsStore,
    collection(name) {
      if (name === 'users') {
        return {
          doc(id) {
            return {
              id,
              async get() {
                const exists = usersStore.has(id);
                return {
                  id,
                  exists,
                  data: () => (exists ? { ...usersStore.get(id) } : undefined),
                };
              },
              async set(data, options = {}) {
                if (options.merge && usersStore.has(id)) {
                  usersStore.set(id, { ...usersStore.get(id), ...data });
                } else {
                  usersStore.set(id, { ...data });
                }
              },
            };
          },
        };
      }

      if (name === 'membershipPlans') {
        return {
          doc(id) {
            return {
              id,
              async get() {
                const exists = plansStore.has(id);
                return {
                  id,
                  exists,
                  data: () => (exists ? { ...plansStore.get(id) } : undefined),
                };
              },
            };
          },
        };
      }

      if (name === 'memberships') {
        return {
          doc(id) {
            return {
              id,
              async get() {
                const exists = membershipsStore.has(id);
                return {
                  id,
                  exists,
                  data: () => (exists ? { ...membershipsStore.get(id) } : undefined),
                };
              },
              async update(data) {
                if (membershipsStore.has(id)) {
                  membershipsStore.set(id, { ...membershipsStore.get(id), ...data });
                }
              },
            };
          },
          async add(data) {
            const id = `membership-${membershipsStore.size + 1}`;
            membershipsStore.set(id, { id, ...data });
            return { id };
          },
          where(field, op, val) {
            return {
              async get() {
                const matches = [];
                for (const [id, item] of membershipsStore.entries()) {
                  if (op === '==' && item[field] === val) {
                    matches.push({ id, data: () => ({ ...item }) });
                  }
                }
                return {
                  forEach(callback) {
                    matches.forEach(callback);
                  },
                  docs: matches,
                  size: matches.length,
                };
              },
            };
          },
        };
      }

      if (name === 'payments') {
        return {
          doc(id) {
            return {
              id,
              async get() {
                const exists = paymentsStore.has(id);
                return {
                  id,
                  exists,
                  data: () => (exists ? { ...paymentsStore.get(id) } : undefined),
                };
              },
              async update(data) {
                if (paymentsStore.has(id)) {
                  paymentsStore.set(id, { ...paymentsStore.get(id), ...data });
                }
              },
            };
          },
          where(field, op, val) {
            return {
              async get() {
                const matches = [];
                for (const [id, item] of paymentsStore.entries()) {
                  if (op === '==' && item[field] === val) {
                    matches.push({ id, data: () => ({ ...item }) });
                  }
                }
                return {
                  forEach(callback) {
                    matches.forEach(callback);
                  },
                  docs: matches,
                  size: matches.length,
                };
              },
            };
          },
          async add(data) {
            const id = `payment-${paymentsStore.size + 1}`;
            paymentsStore.set(id, { id, ...data });
            return { id };
          },
        };
      }

      throw new Error(`Unknown collection ${name}`);
    },
  };
}

function createMockRazorpay() {
  return {
    keyId: 'rzp_test_mock_key',
    keySecret: 'test_mock_secret_key',
    isConfigured: true,
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
          attempts: 0,
          notes: params.notes || {},
          created_at: Math.floor(Date.now() / 1000),
        };
      },
    },
  };
}

function createTestServer() {
  const mockDb = createMockFirestore();
  const mockRazorpay = createMockRazorpay();
  const service = createPaymentService(mockDb, mockRazorpay);
  const controller = createPaymentController(service);

  let currentAuthUser = null;

  const mockVerifyToken = (req, _res, next) => {
    if (!currentAuthUser) {
      return next(new UnauthorizedError('Authentication token required'));
    }
    req.user = { ...currentAuthUser };
    req.profile = { role: 'member', approvalStatus: 'active' };
    next();
  };

  const app = express();
  app.use(express.json());

  const router = createPaymentsRouter({
    controller,
    verifyToken: mockVerifyToken,
  });

  app.use('/api/payments', router);
  app.use(notFound);
  app.use(errorHandler);

  return {
    app,
    mockDb,
    mockRazorpay,
    setAuth(user) {
      currentAuthUser = user;
    },
  };
}

function makeRequest(server, options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, headers: res.headers, body: parsed });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, raw: data });
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

describe('Day 13 Task 25: Razorpay Orders API', () => {
  let serverInstance;
  let testEnv;
  let port;

  before(async () => {
    testEnv = createTestServer();
    serverInstance = http.createServer(testEnv.app);
    await new Promise((resolve) => {
      serverInstance.listen(0, '127.0.0.1', () => {
        port = serverInstance.address().port;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise((resolve) => serverInstance.close(resolve));
  });

  test('POST /api/payments/razorpay/order - rejects unauthenticated requests with 401', async () => {
    testEnv.setAuth(null);
    const res = await makeRequest(serverInstance, {
      hostname: '127.0.0.1',
      port,
      path: '/api/payments/razorpay/order',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {
      planId: 'plan-3-months',
    });

    assert.equal(res.status, 401);
  });

  test('POST /api/payments/razorpay/order - rejects empty/missing planId with 422', async () => {
    testEnv.setAuth({ uid: 'user-member-1', email: 'member1@gym.com' });
    const res = await makeRequest(serverInstance, {
      hostname: '127.0.0.1',
      port,
      path: '/api/payments/razorpay/order',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {});

    assert.equal(res.status, 422);
  });

  test('POST /api/payments/razorpay/order - rejects inactive plan with 400', async () => {
    testEnv.setAuth({ uid: 'user-member-1', email: 'member1@gym.com' });
    const res = await makeRequest(serverInstance, {
      hostname: '127.0.0.1',
      port,
      path: '/api/payments/razorpay/order',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {
      planId: 'plan-inactive',
    });

    assert.equal(res.status, 400);
    assert.match(res.body.message, /inactive/i);
  });

  let createdPaymentId;

  test('POST /api/payments/razorpay/order - creates Razorpay order with server-stored plan price', async () => {
    testEnv.setAuth({ uid: 'user-member-1', email: 'member1@gym.com' });
    const res = await makeRequest(serverInstance, {
      hostname: '127.0.0.1',
      port,
      path: '/api/payments/razorpay/order',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {
      planId: 'plan-3-months',
      // Any client amount tampering should be completely ignored
      amount: 100,
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.status, 'success');
    assert.equal(res.body.data.amount, 399900); // Strict server-side price in integer paise
    assert.equal(res.body.data.currency, 'INR');
    assert.ok(res.body.data.orderId.startsWith('order_test_'));
    assert.ok(res.body.data.paymentId);
    assert.equal(res.body.data.keyId, 'rzp_test_mock_key');

    createdPaymentId = res.body.data.paymentId;
  });

  test('POST /api/payments/razorpay/order - rejects overlapping active membership when isRenewal is false', async () => {
    // Add an active membership for user-member-1 ending in the future
    const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    testEnv.mockDb.membershipsStore.set('active-sub-1', {
      id: 'active-sub-1',
      userId: 'user-member-1',
      status: 'active',
      endDate: futureDate,
      planId: 'plan-3-months',
    });

    testEnv.setAuth({ uid: 'user-member-1', email: 'member1@gym.com' });
    const res = await makeRequest(serverInstance, {
      hostname: '127.0.0.1',
      port,
      path: '/api/payments/razorpay/order',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {
      planId: 'plan-3-months',
      isRenewal: false,
    });

    assert.equal(res.status, 409);
    assert.match(res.body.message, /already has an active membership/i);
  });

  test('POST /api/payments/razorpay/order - allows order creation for active membership when isRenewal is true', async () => {
    testEnv.setAuth({ uid: 'user-member-1', email: 'member1@gym.com' });
    const res = await makeRequest(serverInstance, {
      hostname: '127.0.0.1',
      port,
      path: '/api/payments/razorpay/order',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {
      planId: 'plan-3-months',
      isRenewal: true,
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.status, 'success');
    assert.equal(res.body.data.isRenewal, true);
  });

  test('GET /api/payments/:id - user can fetch own payment record', async () => {
    testEnv.setAuth({ uid: 'user-member-1', email: 'member1@gym.com' });
    const res = await makeRequest(serverInstance, {
      hostname: '127.0.0.1',
      port,
      path: `/api/payments/${createdPaymentId}`,
      method: 'GET',
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'success');
    assert.equal(res.body.data.paymentId, createdPaymentId);
    assert.equal(res.body.data.amountInPaise, 399900);
    assert.equal(res.body.data.status, 'pending');
  });

  test('GET /api/payments/:id - member cannot view another member payment record', async () => {
    testEnv.setAuth({ uid: 'user-member-2', email: 'member2@gym.com' });
    const res = await makeRequest(serverInstance, {
      hostname: '127.0.0.1',
      port,
      path: `/api/payments/${createdPaymentId}`,
      method: 'GET',
    });

    assert.equal(res.status, 403);
  });

  /* -------------------------------------------------------------------------- */
  /* Day 14 Task 27: Payment Signature Verification Tests                      */
  /* -------------------------------------------------------------------------- */

  let testOrderId;
  let testPaymentDocId;

  test('POST /api/payments/razorpay/order - creates order ready for signature verification', async () => {
    testEnv.setAuth({ uid: 'user-member-2', email: 'member2@gym.com' });
    const res = await makeRequest(serverInstance, {
      hostname: '127.0.0.1',
      port,
      path: '/api/payments/razorpay/order',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {
      planId: 'plan-3-months',
    });

    assert.equal(res.status, 201);
    testOrderId = res.body.data.orderId;
    testPaymentDocId = res.body.data.paymentId;
    assert.ok(testOrderId);
  });

  test('POST /api/payments/razorpay/verify - rejects unauthenticated requests with 401', async () => {
    testEnv.setAuth(null);
    const res = await makeRequest(serverInstance, {
      hostname: '127.0.0.1',
      port,
      path: '/api/payments/razorpay/verify',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {
      razorpay_order_id: testOrderId,
      razorpay_payment_id: 'pay_test_123',
      razorpay_signature: 'fake_sig',
    });

    assert.equal(res.status, 401);
  });

  test('POST /api/payments/razorpay/verify - rejects invalid signature with 400', async () => {
    testEnv.setAuth({ uid: 'user-member-2', email: 'member2@gym.com' });
    const res = await makeRequest(serverInstance, {
      hostname: '127.0.0.1',
      port,
      path: '/api/payments/razorpay/verify',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {
      razorpay_order_id: testOrderId,
      razorpay_payment_id: 'pay_test_123',
      razorpay_signature: 'invalid_forged_signature_0000000000000000000000000000000000000000',
    });

    assert.equal(res.status, 400);
    assert.match(res.body.message, /invalid razorpay payment signature/i);
  });

  test('POST /api/payments/razorpay/verify - rejects non-existent order with 404', async () => {
    const fakeOrderId = 'order_non_existent_99999';
    const fakePaymentId = 'pay_fake_99999';
    const secret = testEnv.mockRazorpay.keySecret;
    const validSigForNonExistentOrder = crypto
      .createHmac('sha256', secret)
      .update(`${fakeOrderId}|${fakePaymentId}`)
      .digest('hex');

    testEnv.setAuth({ uid: 'user-member-2', email: 'member2@gym.com' });
    const res = await makeRequest(serverInstance, {
      hostname: '127.0.0.1',
      port,
      path: '/api/payments/razorpay/verify',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {
      razorpay_order_id: fakeOrderId,
      razorpay_payment_id: fakePaymentId,
      razorpay_signature: validSigForNonExistentOrder,
    });

    assert.equal(res.status, 404);
  });

  test('POST /api/payments/razorpay/verify - verifies valid signature, captures payment & activates membership', async () => {
    const paymentId = 'pay_real_mock_456';
    const secret = testEnv.mockRazorpay.keySecret;
    const validSignature = crypto
      .createHmac('sha256', secret)
      .update(`${testOrderId}|${paymentId}`)
      .digest('hex');

    testEnv.setAuth({ uid: 'user-member-2', email: 'member2@gym.com' });
    const res = await makeRequest(serverInstance, {
      hostname: '127.0.0.1',
      port,
      path: '/api/payments/razorpay/verify',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {
      razorpay_order_id: testOrderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: validSignature,
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'success');
    assert.equal(res.body.idempotent, false);
    assert.equal(res.body.payment.status, 'captured');
    assert.equal(res.body.payment.razorpayPaymentId, paymentId);
    assert.ok(res.body.membership.membershipId);
    assert.equal(res.body.membership.status, 'active');
    assert.equal(res.body.membership.paymentStatus, 'paid');

    // Check user profile was updated to active
    const userDoc = testEnv.mockDb.usersStore.get('user-member-2');
    assert.equal(userDoc.membershipStatus, 'active');
    assert.equal(userDoc.activeMembershipId, res.body.membership.membershipId);
  });

  test('POST /api/payments/razorpay/verify - returns idempotent success when called a second time', async () => {
    const paymentId = 'pay_real_mock_456';
    const secret = testEnv.mockRazorpay.keySecret;
    const validSignature = crypto
      .createHmac('sha256', secret)
      .update(`${testOrderId}|${paymentId}`)
      .digest('hex');

    testEnv.setAuth({ uid: 'user-member-2', email: 'member2@gym.com' });
    const res = await makeRequest(serverInstance, {
      hostname: '127.0.0.1',
      port,
      path: '/api/payments/razorpay/verify',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {
      razorpay_order_id: testOrderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: validSignature,
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'success');
    assert.equal(res.body.idempotent, true);
    assert.match(res.body.message, /already been verified/i);
  });
});

