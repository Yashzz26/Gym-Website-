/**
 * tests/members.test.js — Automated Tests for Member Online Joining Flow (Day 11 Task 22)
 */

process.env.NODE_ENV = 'test';
process.env.TEST_MODE = 'true';
process.env.LOG_FORMAT = 'json';

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';

import { createMemberService } from '../services/memberService.js';
import { createMemberController } from '../controllers/memberController.js';
import { createMembersRouter } from '../routes/members.js';
import { notFound } from '../middleware/notFound.js';
import { errorHandler } from '../middleware/errorHandler.js';
import { UnauthorizedError } from '../utils/errors.js';

function createMockFirestore() {
  const usersStore = new Map([
    [
      'member-1',
      {
        uid: 'member-1',
        email: 'member@gym.com',
        displayName: 'John Online',
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
                  empty: matches.length === 0,
                  forEach(cb) {
                    matches.forEach(cb);
                  },
                };
              },
            };
          },
        };
      }

      throw new Error(`Unexpected collection: ${name}`);
    },
    _stores: { usersStore, membershipsStore },
  };
}

describe('Member Online Joining & Plan Selection API (Day 11 Task 22)', () => {
  let server;
  let baseUrl;
  let activeUser = null;
  let mockDb;

  before(async () => {
    mockDb = createMockFirestore();
    const service = createMemberService(mockDb);
    const controller = createMemberController(service);

    const fakeVerifyToken = (req, _res, next) => {
      if (!activeUser) {
        return next(new UnauthorizedError('Authentication required'));
      }
      req.user = { uid: activeUser.uid, email: activeUser.email };
      next();
    };

    const router = createMembersRouter({
      controller,
      verifyToken: fakeVerifyToken,
    });

    const app = express();
    app.use(express.json());
    app.use('/api/members', router);
    app.use(notFound);
    app.use(errorHandler);

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  test('POST /api/members/select-plan returns 401 when unauthenticated', async () => {
    activeUser = null;
    const res = await fetch(`${baseUrl}/api/members/select-plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planId: 'plan-3-months' }),
    });

    assert.equal(res.status, 401);
  });

  test('POST /api/members/select-plan returns 422 when planId is missing', async () => {
    activeUser = { uid: 'member-1', email: 'member@gym.com' };
    const res = await fetch(`${baseUrl}/api/members/select-plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planId: '' }),
    });

    assert.equal(res.status, 422);
  });

  test('POST /api/members/select-plan returns 404 when planId does not exist', async () => {
    activeUser = { uid: 'member-1', email: 'member@gym.com' };
    const res = await fetch(`${baseUrl}/api/members/select-plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planId: 'non-existent-plan' }),
    });

    assert.equal(res.status, 404);
  });

  test('POST /api/members/select-plan returns 400 when plan is inactive', async () => {
    activeUser = { uid: 'member-1', email: 'member@gym.com' };
    const res = await fetch(`${baseUrl}/api/members/select-plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planId: 'plan-inactive' }),
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.ok(body.message.includes('inactive'));
  });

  test('POST /api/members/select-plan successfully creates payment_pending membership and updates user profile', async () => {
    activeUser = { uid: 'member-1', email: 'member@gym.com' };
    const res = await fetch(`${baseUrl}/api/members/select-plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        planId: 'plan-3-months',
        phone: '+91 99988 77766',
        gender: 'male',
      }),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.status, 'success');
    assert.equal(body.data.membership.status, 'payment_pending');
    assert.equal(body.data.membership.paymentStatus, 'pending');
    assert.equal(body.data.membership.planId, 'plan-3-months');
    assert.equal(body.data.membership.priceInPaise, 399900);

    // Verify user profile was updated to payment_pending
    const updatedUser = mockDb._stores.usersStore.get('member-1');
    assert.equal(updatedUser.membershipStatus, 'payment_pending');
    assert.equal(updatedUser.phone, '+91 99988 77766');
    assert.equal(updatedUser.activeMembershipId, body.data.membership.membershipId);
  });

  test('GET /api/members/my-membership returns current payment_pending membership record', async () => {
    activeUser = { uid: 'member-1', email: 'member@gym.com' };
    const res = await fetch(`${baseUrl}/api/members/my-membership`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.data);
    assert.equal(body.data.status, 'payment_pending');
    assert.equal(body.data.planName, '3 Months Pro');
  });
});
