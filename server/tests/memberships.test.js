/**
 * tests/memberships.test.js — Automated Tests for Membership Lifecycle & Renewals (Day 12 Task 23)
 */

process.env.NODE_ENV = 'test';
process.env.TEST_MODE = 'true';
process.env.LOG_FORMAT = 'json';

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';

import { createMembershipService } from '../services/membershipService.js';
import { createMembershipController } from '../controllers/membershipController.js';
import { createMembershipsRouter } from '../routes/memberships.js';
import { notFound } from '../middleware/notFound.js';
import { errorHandler } from '../middleware/errorHandler.js';
import { UnauthorizedError, ForbiddenError } from '../utils/errors.js';

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
      'plan-1-month',
      {
        planId: 'plan-1-month',
        name: '1 Month Starter',
        durationDays: 30,
        priceInPaise: 149900,
        isActive: true,
      },
    ],
    [
      'plan-inactive',
      {
        planId: 'plan-inactive',
        name: 'Expired Promo',
        durationDays: 30,
        priceInPaise: 99900,
        isActive: false,
      },
    ],
  ]);

  const membershipsStore = new Map();

  return {
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
                if (!membershipsStore.has(id)) {
                  throw new Error(`Document ${id} not found`);
                }
                membershipsStore.set(id, { ...membershipsStore.get(id), ...data });
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

      throw new Error(`Unknown collection ${name}`);
    },
  };
}

function createTestServer() {
  const mockDb = createMockFirestore();
  const service = createMembershipService(mockDb);
  const controller = createMembershipController(service);

  let currentAuthUser = null;
  let currentProfile = null;

  const mockVerifyToken = (req, _res, next) => {
    if (!currentAuthUser) {
      return next(new UnauthorizedError('Authentication token required'));
    }
    req.user = { ...currentAuthUser };
    req.profile = currentProfile ? { ...currentProfile } : { role: 'member', approvalStatus: 'active' };
    next();
  };

  const mockRequireRole = (...roles) => (req, _res, next) => {
    const role = req.profile?.role || 'member';
    if (!roles.includes(role)) {
      return next(new ForbiddenError(`Access denied. Required role: ${roles.join(' or ')}`));
    }
    next();
  };

  const mockRequireActiveStatus = (req, _res, next) => {
    if (req.profile?.approvalStatus !== 'active') {
      return next(new ForbiddenError('Account not active'));
    }
    next();
  };

  const app = express();
  app.use(express.json());

  const router = createMembershipsRouter({
    controller,
    verifyToken: mockVerifyToken,
    requireRole: mockRequireRole,
    requireActiveStatus: mockRequireActiveStatus,
  });

  app.use('/api/memberships', router);
  app.use(notFound);
  app.use(errorHandler);

  return {
    app,
    mockDb,
    setAuth(user, profile = null) {
      currentAuthUser = user;
      currentProfile = profile;
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

describe('Day 12 Task 23: Membership Lifecycle and Renewals API', () => {
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

  test('POST /api/memberships - rejects unauthenticated requests with 401', async () => {
    testEnv.setAuth(null);
    const res = await makeRequest(serverInstance, {
      hostname: '127.0.0.1',
      port,
      path: '/api/memberships',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {
      userId: 'user-member-1',
      planId: 'plan-3-months',
    });

    assert.equal(res.status, 401);
  });

  test('POST /api/memberships - rejects member role with 403 (staff only)', async () => {
    testEnv.setAuth(
      { uid: 'user-member-1', email: 'member1@gym.com' },
      { role: 'member', approvalStatus: 'active' }
    );

    const res = await makeRequest(serverInstance, {
      hostname: '127.0.0.1',
      port,
      path: '/api/memberships',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {
      userId: 'user-member-1',
      planId: 'plan-3-months',
    });

    assert.equal(res.status, 403);
  });

  let createdMembershipId;

  test('POST /api/memberships - allows reception staff to create active membership', async () => {
    testEnv.setAuth(
      { uid: 'reception-uid', email: 'reception@gym.com' },
      { role: 'reception', approvalStatus: 'active' }
    );

    const res = await makeRequest(serverInstance, {
      hostname: '127.0.0.1',
      port,
      path: '/api/memberships',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {
      userId: 'user-member-1',
      planId: 'plan-3-months',
      paymentMethod: 'cash',
      paymentStatus: 'paid',
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.status, 'success');
    assert.equal(res.body.data.planName, '3 Months Pro');
    assert.equal(res.body.data.durationDays, 90);
    assert.equal(res.body.data.priceInPaise, 399900);
    assert.equal(res.body.data.status, 'active');
    assert.ok(res.body.data.membershipId);

    createdMembershipId = res.body.data.membershipId;
  });

  test('GET /api/memberships/:id - member can fetch their own membership details', async () => {
    testEnv.setAuth(
      { uid: 'user-member-1', email: 'member1@gym.com' },
      { role: 'member', approvalStatus: 'active' }
    );

    const res = await makeRequest(serverInstance, {
      hostname: '127.0.0.1',
      port,
      path: `/api/memberships/${createdMembershipId}`,
      method: 'GET',
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'success');
    assert.equal(res.body.data.membershipId, createdMembershipId);
    assert.equal(res.body.data.daysRemaining > 0, true);
    assert.equal(res.body.data.isExpired, false);
  });

  test('GET /api/memberships/:id - member cannot view another member membership', async () => {
    testEnv.setAuth(
      { uid: 'user-member-2', email: 'member2@gym.com' },
      { role: 'member', approvalStatus: 'active' }
    );

    const res = await makeRequest(serverInstance, {
      hostname: '127.0.0.1',
      port,
      path: `/api/memberships/${createdMembershipId}`,
      method: 'GET',
    });

    assert.equal(res.status, 403);
  });

  test('POST /api/memberships/:id/renew - member can renew their own membership (extends end date)', async () => {
    testEnv.setAuth(
      { uid: 'user-member-1', email: 'member1@gym.com' },
      { role: 'member', approvalStatus: 'active' }
    );

    const res = await makeRequest(serverInstance, {
      hostname: '127.0.0.1',
      port,
      path: `/api/memberships/${createdMembershipId}/renew`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {
      planId: 'plan-1-month',
      paymentMethod: 'upi',
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'success');
    assert.ok(res.body.data.membership.membershipId);
    assert.equal(res.body.data.membership.renewedFrom, createdMembershipId);
    assert.equal(res.body.data.membership.durationDays, 30);
    assert.equal(res.body.data.membership.status, 'active');
  });

  test('GET /api/memberships/user/:userId - returns full timeline and active membership', async () => {
    testEnv.setAuth(
      { uid: 'user-member-1', email: 'member1@gym.com' },
      { role: 'member', approvalStatus: 'active' }
    );

    const res = await makeRequest(serverInstance, {
      hostname: '127.0.0.1',
      port,
      path: '/api/memberships/user/user-member-1',
      method: 'GET',
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'success');
    assert.equal(res.body.data.userId, 'user-member-1');
    assert.equal(res.body.data.totalMemberships, 2);
    assert.ok(res.body.data.activeMembership);
    assert.equal(res.body.data.history.length, 2);
  });
});
