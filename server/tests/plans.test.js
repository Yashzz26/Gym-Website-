/**
 * tests/plans.test.js — Automated Tests for Membership Plans Backend APIs
 */

process.env.NODE_ENV = 'test';
process.env.TEST_MODE = 'true';
process.env.LOG_FORMAT = 'json';

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';

import { createPlanService, DEFAULT_PLANS } from '../services/planService.js';
import { createPlanController } from '../controllers/planController.js';
import { createPlansRouter } from '../routes/plans.js';
import { notFound } from '../middleware/notFound.js';
import { errorHandler } from '../middleware/errorHandler.js';
import { ForbiddenError, UnauthorizedError } from '../utils/errors.js';

// ---------------------------------------------------------------------------
// In-Memory Firestore Mock for isolated testing
// ---------------------------------------------------------------------------
function createMockFirestore(initialData = {}) {
  const store = new Map(Object.entries(initialData));

  const collection = {
    doc(id) {
      return {
        id,
        async get() {
          const exists = store.has(id);
          const data = exists ? { ...store.get(id) } : undefined;
          return {
            id,
            exists,
            data: () => data,
          };
        },
        async set(data, options = {}) {
          if (options.merge && store.has(id)) {
            const current = store.get(id);
            store.set(id, { ...current, ...data });
          } else {
            store.set(id, { ...data });
          }
        },
      };
    },
    where(field, op, val) {
      return {
        orderBy(orderField, dir) {
          return {
            async get() {
              const matches = [];
              for (const [id, valObj] of store.entries()) {
                if (op === '==' && valObj[field] === val) {
                  matches.push({ id, data: () => ({ ...valObj }) });
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
        },
      };
    },
    orderBy(field, dir) {
      return {
        async get() {
          const all = [];
          for (const [id, valObj] of store.entries()) {
            all.push({ id, data: () => ({ ...valObj }) });
          }
          return {
            empty: all.length === 0,
            forEach(cb) {
              all.forEach(cb);
            },
          };
        },
      };
    },
  };

  return {
    collection(name) {
      if (name === 'membershipPlans') return collection;
      throw new Error(`Unexpected collection in mock: ${name}`);
    },
    _store: store,
  };
}

describe('Membership Plans Backend APIs (Day 10 Task 19)', () => {
  let server;
  let baseUrl;
  let mockDb;
  let service;
  let activeUser = null;

  const mockVerifyToken = (req, _res, next) => {
    if (!activeUser) {
      return next(new UnauthorizedError('Authentication token required'));
    }
    req.user = { uid: activeUser.uid, email: activeUser.email };
    req.profile = {
      uid: activeUser.uid,
      role: activeUser.role,
      approvalStatus: activeUser.approvalStatus,
    };
    next();
  };

  const mockRequireOwner = (req, _res, next) => {
    if (req.profile?.role !== 'owner') {
      return next(new ForbiddenError('Access denied. Required role: owner.'));
    }
    next();
  };

  const mockRequireActiveStatus = (req, _res, next) => {
    if (req.profile?.approvalStatus !== 'active') {
      return next(
        new ForbiddenError(`Account status (${req.profile?.approvalStatus}) does not permit access.`)
      );
    }
    next();
  };

  before(async () => {
    mockDb = createMockFirestore();
    service = createPlanService(mockDb);
    const controller = createPlanController(service);

    const testApp = express();
    testApp.use(express.json());

    const router = createPlansRouter({
      controller,
      verifyToken: mockVerifyToken,
      requireOwner: mockRequireOwner,
      requireActiveStatus: mockRequireActiveStatus,
    });

    testApp.use('/api/plans', router);
    testApp.use(notFound);
    testApp.use(errorHandler);

    server = http.createServer(testApp);
    await new Promise((resolve) => server.listen(0, resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  test('GET /api/plans returns list of active plans for public users', async () => {
    activeUser = null;
    const res = await fetch(`${baseUrl}/api/plans`);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.status, 'success');
    assert.ok(Array.isArray(body.data));
    assert.ok(body.data.length >= 3);

    // Verify integer paise
    const starter = body.data.find((p) => p.durationMonths === 1);
    assert.ok(starter);
    assert.equal(typeof starter.priceInPaise, 'number');
    assert.equal(starter.priceInPaise, 149900); // ₹1,499 in paise
  });

  test('GET /api/plans/:id returns single plan details', async () => {
    const res = await fetch(`${baseUrl}/api/plans/plan-3-months`);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.status, 'success');
    assert.equal(body.data.name, '3 Months Pro');
    assert.equal(body.data.priceInPaise, 399900);
  });

  test('GET /api/plans/:id returns 404 for unknown plan ID', async () => {
    const res = await fetch(`${baseUrl}/api/plans/nonexistent-plan-id`);
    assert.equal(res.status, 404);
  });

  test('POST /api/plans allows owner to create a new plan with integer paise', async () => {
    activeUser = { uid: 'owner-1', email: 'owner@gym.com', role: 'owner', approvalStatus: 'active' };

    const newPlanPayload = {
      name: '6 Months Transformation',
      durationMonths: 6,
      priceInPaise: 699900, // ₹6,999.00
      features: ['Full gym access', 'Nutrition guide', 'Bi-weekly body stats'],
      description: 'Intense six-month fitness transformation package.',
      isActive: true,
      displayOrder: 4,
      badge: 'Trending',
    };

    const res = await fetch(`${baseUrl}/api/plans`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer owner-token',
      },
      body: JSON.stringify(newPlanPayload),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.status, 'success');
    assert.equal(body.data.name, '6 Months Transformation');
    assert.equal(body.data.priceInPaise, 699900);
    assert.equal(body.data.durationDays, 180);
    assert.equal(body.data.createdBy, 'owner-1');

    // Verify stored in Firestore mock
    assert.ok(mockDb._store.has(body.data.planId));
  });

  test('POST /api/plans returns 403 when non-owner (member/trainer/reception) attempts creation', async () => {
    activeUser = { uid: 'member-1', email: 'member@gym.com', role: 'member', approvalStatus: 'active' };

    const res = await fetch(`${baseUrl}/api/plans`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer member-token',
      },
      body: JSON.stringify({
        name: 'Hacked Plan',
        durationMonths: 1,
        priceInPaise: 10000,
        features: ['Free gym'],
      }),
    });

    assert.equal(res.status, 403);
  });

  test('POST /api/plans returns 422 when price is below minimum or required fields are missing', async () => {
    activeUser = { uid: 'owner-1', email: 'owner@gym.com', role: 'owner', approvalStatus: 'active' };

    // Missing features and price below 10000 paise (₹100)
    const invalidPayload = {
      name: 'Bad Plan',
      durationMonths: 1,
      priceInPaise: 50,
      features: [],
    };

    const res = await fetch(`${baseUrl}/api/plans`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer owner-token',
      },
      body: JSON.stringify(invalidPayload),
    });

    assert.equal(res.status, 422);
    const body = await res.json();
    assert.equal(body.statusCode, 422);
  });

  test('PUT /api/plans/:id allows owner to update plan details', async () => {
    activeUser = { uid: 'owner-1', email: 'owner@gym.com', role: 'owner', approvalStatus: 'active' };

    const res = await fetch(`${baseUrl}/api/plans/plan-1-month`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer owner-token',
      },
      body: JSON.stringify({
        priceInPaise: 169900, // Price updated to ₹1,699
        description: 'Updated 1 month starter package with steam room access.',
      }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'success');
    assert.equal(body.data.priceInPaise, 169900);
    assert.equal(body.data.updatedBy, 'owner-1');
  });

  test('PATCH /api/plans/:id/status activates or deactivates a membership plan', async () => {
    activeUser = { uid: 'owner-1', email: 'owner@gym.com', role: 'owner', approvalStatus: 'active' };

    // Deactivate plan
    const resDeactivate = await fetch(`${baseUrl}/api/plans/plan-1-month/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer owner-token',
      },
      body: JSON.stringify({ isActive: false }),
    });

    assert.equal(resDeactivate.status, 200);
    const bodyDeactivate = await resDeactivate.json();
    assert.equal(bodyDeactivate.data.isActive, false);

    // Reactivate plan
    const resActivate = await fetch(`${baseUrl}/api/plans/plan-1-month/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer owner-token',
      },
      body: JSON.stringify({ isActive: true }),
    });

    assert.equal(resActivate.status, 200);
    const bodyActivate = await resActivate.json();
    assert.equal(bodyActivate.data.isActive, true);
  });
});

