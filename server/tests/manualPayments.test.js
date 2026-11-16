/**
 * tests/manualPayments.test.js — Tests for Cash and Manual UPI Payment APIs (Day 15 Task 29)
 */

process.env.NODE_ENV = 'test';
process.env.TEST_MODE = 'true';
process.env.LOG_FORMAT = 'json';

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';

import { createManualPaymentService } from '../services/manualPaymentService.js';
import { createManualPaymentController } from '../controllers/manualPaymentController.js';
import { createReceptionRouter } from '../routes/reception.js';
import { notFound } from '../middleware/notFound.js';
import { errorHandler } from '../middleware/errorHandler.js';
import { ForbiddenError, UnauthorizedError } from '../utils/errors.js';

function createMockFirestore() {
  const usersStore = new Map([
    [
      'member-123',
      {
        uid: 'member-123',
        email: 'member1@example.com',
        displayName: 'Test Member',
        role: 'member',
        status: 'active',
      },
    ],
    [
      'trainer-123',
      {
        uid: 'trainer-123',
        email: 'trainer@example.com',
        displayName: 'Test Trainer',
        role: 'trainer',
        status: 'active',
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
        name: 'Inactive Plan',
        durationDays: 30,
        priceInPaise: 100000,
        isActive: false,
      },
    ],
  ]);

  const membershipsStore = new Map();
  const paymentsStore = new Map();
  const auditLogsStore = new Map();
  let idCounter = 1;

  return {
    usersStore,
    plansStore,
    membershipsStore,
    paymentsStore,
    auditLogsStore,

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
                const current = usersStore.get(id) || {};
                usersStore.set(id, options.merge ? { ...current, ...data } : { ...data });
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
              async update(patch) {
                const current = membershipsStore.get(id);
                if (current) {
                  membershipsStore.set(id, { ...current, ...patch });
                }
              },
            };
          },
          where(field, op, val) {
            const queryState = { conditions: [[field, op, val]] };
            const chain = {
              where(f, o, v) {
                queryState.conditions.push([f, o, v]);
                return chain;
              },
              async get() {
                const matches = [];
                for (const [id, m] of membershipsStore.entries()) {
                  const pass = queryState.conditions.every(([cf, co, cv]) => {
                    if (co === '==') return m[cf] === cv;
                    return false;
                  });
                  if (pass) {
                    matches.push({ id, data: () => ({ ...m }) });
                  }
                }
                return {
                  empty: matches.length === 0,
                  forEach(cb) {
                    matches.forEach(cb);
                  },
                };
              },
            };
            return chain;
          },
          async add(data) {
            const id = `membership-${idCounter++}`;
            membershipsStore.set(id, { id, ...data });
            return { id };
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
              async update(patch) {
                const current = paymentsStore.get(id);
                if (current) {
                  paymentsStore.set(id, { ...current, ...patch });
                }
              },
            };
          },
          where(field, op, val) {
            const queryState = { conditions: [[field, op, val]] };
            const chain = {
              where(f, o, v) {
                queryState.conditions.push([f, o, v]);
                return chain;
              },
              limit(n) {
                queryState.limit = n;
                return chain;
              },
              async get() {
                const docs = [];
                for (const [id, p] of paymentsStore.entries()) {
                  const pass = queryState.conditions.every(([cf, co, cv]) => {
                    if (co === '==') return p[cf] === cv;
                    return false;
                  });
                  if (pass) {
                    docs.push({ id, data: () => ({ ...p }) });
                  }
                }
                const sliced = queryState.limit ? docs.slice(0, queryState.limit) : docs;
                return {
                  docs: sliced,
                  forEach(cb) {
                    sliced.forEach(cb);
                  },
                };
              },
            };
            return chain;
          },
          limit(n) {
            return {
              async get() {
                const docs = [];
                for (const [id, p] of paymentsStore.entries()) {
                  docs.push({ id, data: () => ({ ...p }) });
                }
                const sliced = docs.slice(0, n);
                return {
                  docs: sliced,
                  forEach(cb) {
                    sliced.forEach(cb);
                  },
                };
              },
            };
          },
          async add(data) {
            const id = `pay-${idCounter++}`;
            paymentsStore.set(id, { id, ...data });
            return { id };
          },
        };
      }

      if (name === 'auditLogs') {
        return {
          async add(data) {
            const id = `audit-${idCounter++}`;
            auditLogsStore.set(id, { id, ...data });
            return { id };
          },
        };
      }

      throw new Error(`Collection '${name}' not implemented in mock`);
    },
  };
}

describe('Manual Payment APIs (Day 15 Task 29)', () => {
  let server;
  let baseUrl;
  let mockDb;
  let authContext = {
    isAuthenticated: true,
    user: { uid: 'reception-staff-1' },
    profile: { role: 'reception', status: 'active' },
  };

  before(async () => {
    mockDb = createMockFirestore();
    const service = createManualPaymentService(mockDb);
    const controller = createManualPaymentController(service);

    const mockVerifyToken = (req, res, next) => {
      if (!authContext.isAuthenticated) {
        return next(new UnauthorizedError('Missing or invalid authorization token'));
      }
      req.user = authContext.user;
      next();
    };

    const mockRequireRole = (...roles) => (req, res, next) => {
      req.profile = authContext.profile;
      if (!roles.includes(req.profile?.role)) {
        return next(new ForbiddenError('Insufficient permissions'));
      }
      next();
    };

    const mockRequireActiveStatus = (req, res, next) => {
      if (authContext.profile?.status !== 'active') {
        return next(new ForbiddenError('Account is not active'));
      }
      next();
    };

    const router = createReceptionRouter({
      paymentController: controller,
      verifyToken: mockVerifyToken,
      requireRole: mockRequireRole,
      requireActiveStatus: mockRequireActiveStatus,
    });

    const app = express();
    app.use(express.json());
    app.use('/api/reception', router);
    app.use(notFound);
    app.use(errorHandler);

    await new Promise((resolve) => {
      server = http.createServer(app);
      server.listen(0, '127.0.0.1', () => {
        const address = server.address();
        baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  test('POST /api/reception/payments fails with 401 if unauthenticated', async () => {
    authContext = { isAuthenticated: false, user: null, profile: null };

    const res = await fetch(`${baseUrl}/api/reception/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        memberId: 'member-123',
        planId: 'plan-3-months',
        method: 'cash',
        amountPaise: 399900,
      }),
    });

    assert.equal(res.status, 401);
  });

  test('POST /api/reception/payments fails with 403 if role is member', async () => {
    authContext = {
      isAuthenticated: true,
      user: { uid: 'member-123' },
      profile: { role: 'member', status: 'active' },
    };

    const res = await fetch(`${baseUrl}/api/reception/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        memberId: 'member-123',
        planId: 'plan-3-months',
        method: 'cash',
        amountPaise: 399900,
      }),
    });

    assert.equal(res.status, 403);
  });

  test('POST /api/reception/payments fails with 422 if required fields are missing', async () => {
    authContext = {
      isAuthenticated: true,
      user: { uid: 'reception-1' },
      profile: { role: 'reception', status: 'active' },
    };

    const res = await fetch(`${baseUrl}/api/reception/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        memberId: 'member-123',
        // missing planId, method, amountPaise
      }),
    });

    assert.equal(res.status, 422);
    const body = await res.json();
    assert.equal(body.status, 'error');
    assert.equal(body.statusCode, 422);
  });

  test('POST /api/reception/payments fails with 400 if plan is inactive', async () => {
    authContext = {
      isAuthenticated: true,
      user: { uid: 'reception-1' },
      profile: { role: 'reception', status: 'active' },
    };

    const res = await fetch(`${baseUrl}/api/reception/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        memberId: 'member-123',
        planId: 'plan-inactive',
        method: 'cash',
        amountPaise: 100000,
      }),
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.match(body.message, /inactive/i);
  });

  test('POST /api/reception/payments fails with 400 if amount does not match server plan price', async () => {
    authContext = {
      isAuthenticated: true,
      user: { uid: 'reception-1' },
      profile: { role: 'reception', status: 'active' },
    };

    const res = await fetch(`${baseUrl}/api/reception/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        memberId: 'member-123',
        planId: 'plan-3-months',
        method: 'cash',
        amountPaise: 200000, // Should be 399900
      }),
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.match(body.message, /mismatch/i);
  });

  test('POST /api/reception/payments fails with 404 if member not found', async () => {
    authContext = {
      isAuthenticated: true,
      user: { uid: 'reception-1' },
      profile: { role: 'reception', status: 'active' },
    };

    const res = await fetch(`${baseUrl}/api/reception/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        memberId: 'non-existent-member',
        planId: 'plan-3-months',
        method: 'cash',
        amountPaise: 399900,
      }),
    });

    assert.equal(res.status, 404);
  });

  test('POST /api/reception/payments records cash payment successfully and writes auditLogs', async () => {
    authContext = {
      isAuthenticated: true,
      user: { uid: 'reception-1' },
      profile: { role: 'reception', status: 'active' },
    };

    const res = await fetch(`${baseUrl}/api/reception/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-request-id': 'req-test-123' },
      body: JSON.stringify({
        memberId: 'member-123',
        planId: 'plan-3-months',
        method: 'cash',
        amountPaise: 399900,
        remarks: 'Cash paid at front desk',
      }),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.status, 'success');
    assert.ok(body.data.payment.paymentId);
    assert.equal(body.data.payment.gateway, 'manual');
    assert.equal(body.data.payment.method, 'cash');
    assert.equal(body.data.payment.status, 'captured');
    assert.equal(body.data.membership.status, 'active');
    assert.equal(body.data.membership.paymentStatus, 'paid');
    assert.ok(body.data.auditLogId);

    // Verify audit log has required fields
    const auditRecord = mockDb.auditLogsStore.get(body.data.auditLogId);
    assert.ok(auditRecord);
    assert.equal(auditRecord.actorId, 'reception-1');
    assert.equal(auditRecord.action, 'manual_payment_recorded');
    assert.equal(auditRecord.targetId, body.data.payment.paymentId);
    assert.equal(auditRecord.amountPaise, 399900);
    assert.equal(auditRecord.method, 'cash');
    assert.ok(auditRecord.timestamp);
    assert.equal(auditRecord.requestId, 'req-test-123');
  });

  test('POST /api/reception/payments returns 409 if member already has active membership without isRenewal', async () => {
    authContext = {
      isAuthenticated: true,
      user: { uid: 'reception-1' },
      profile: { role: 'reception', status: 'active' },
    };

    const res = await fetch(`${baseUrl}/api/reception/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        memberId: 'member-123',
        planId: 'plan-3-months',
        method: 'cash',
        amountPaise: 399900,
      }),
    });

    assert.equal(res.status, 409);
    const body = await res.json();
    assert.match(body.message, /active membership/i);
  });

  test('POST /api/reception/payments records manual UPI renewal successfully when isRenewal is true', async () => {
    authContext = {
      isAuthenticated: true,
      user: { uid: 'reception-1' },
      profile: { role: 'reception', status: 'active' },
    };

    const res = await fetch(`${baseUrl}/api/reception/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        memberId: 'member-123',
        planId: 'plan-3-months',
        method: 'upi',
        amountPaise: 399900,
        upiReference: 'UPI123456789012',
        isRenewal: true,
      }),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.status, 'success');
    assert.equal(body.data.payment.method, 'upi');
    assert.equal(body.data.payment.upiReference, 'UPI123456789012');
    assert.equal(body.data.payment.isRenewal, true);
    assert.ok(body.data.membership.renewedFrom);
  });

  test('GET /api/reception/payments lists manual payments', async () => {
    authContext = {
      isAuthenticated: true,
      user: { uid: 'reception-1' },
      profile: { role: 'reception', status: 'active' },
    };

    const res = await fetch(`${baseUrl}/api/reception/payments`, {
      method: 'GET',
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'success');
    assert.ok(Array.isArray(body.data));
    assert.ok(body.data.length >= 2);
  });

  test('GET /api/reception/payments/:paymentId returns the single payment record', async () => {
    authContext = {
      isAuthenticated: true,
      user: { uid: 'reception-1' },
      profile: { role: 'reception', status: 'active' },
    };

    const listRes = await fetch(`${baseUrl}/api/reception/payments`);
    const listBody = await listRes.json();
    const firstPayment = listBody.data[0];

    const res = await fetch(`${baseUrl}/api/reception/payments/${firstPayment.id}`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'success');
    assert.equal(body.data.id, firstPayment.id);
  });
});
