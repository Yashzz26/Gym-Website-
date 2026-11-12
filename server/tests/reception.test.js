/**
 * tests/reception.test.js — Automated Tests for Reception Member Registration (Day 11 Task 21)
 */

process.env.NODE_ENV = 'test';
process.env.TEST_MODE = 'true';
process.env.LOG_FORMAT = 'json';

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';

import { createReceptionService } from '../services/receptionService.js';
import { createReceptionController } from '../controllers/receptionController.js';
import { createReceptionRouter } from '../routes/reception.js';
import { notFound } from '../middleware/notFound.js';
import { errorHandler } from '../middleware/errorHandler.js';
import { ForbiddenError, UnauthorizedError } from '../utils/errors.js';

function createMockFirestore() {
  const usersStore = new Map();
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
              async set(data) {
                usersStore.set(id, { ...data });
              },
            };
          },
          where(field, op, val) {
            return {
              async get() {
                const matches = [];
                for (const [id, user] of usersStore.entries()) {
                  if (op === '==' && user[field] === val) {
                    matches.push({ id, data: () => ({ ...user }) });
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
        };
      }

      throw new Error(`Unexpected collection: ${name}`);
    },
  };
}

describe('Reception Member Registration API (Day 11 Task 21)', () => {
  let server;
  let baseUrl;
  let activeUser = null;
  let mockDb;
  let mockAuth;

  before(async () => {
    mockDb = createMockFirestore();
    mockAuth = {
      async createUser({ email, displayName }) {
        if (email === 'duplicate@gym.com') {
          const err = new Error('Email already exists');
          err.code = 'auth/email-already-exists';
          throw err;
        }
        return { uid: `auth-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` };
      },
    };

    const service = createReceptionService(mockDb, mockAuth);
    const controller = createReceptionController(service);

    const fakeVerifyToken = (req, _res, next) => {
      if (!activeUser) {
        return next(new UnauthorizedError('Authentication required'));
      }
      req.user = { uid: activeUser.uid, email: activeUser.email };
      req.profile = {
        uid: activeUser.uid,
        email: activeUser.email,
        role: activeUser.role,
        approvalStatus: activeUser.approvalStatus || 'active',
      };
      next();
    };

    const fakeRequireRole = (...roles) => {
      return (req, _res, next) => {
        if (!roles.includes(req.profile?.role)) {
          return next(new ForbiddenError(`Access denied for role: ${req.profile?.role}`));
        }
        next();
      };
    };

    const fakeRequireActiveStatus = (req, _res, next) => {
      if (req.profile?.approvalStatus !== 'active') {
        return next(
          new ForbiddenError(`Account status (${req.profile?.approvalStatus}) does not permit access.`)
        );
      }
      next();
    };

    const router = createReceptionRouter({
      controller,
      verifyToken: fakeVerifyToken,
      requireRole: fakeRequireRole,
      requireActiveStatus: fakeRequireActiveStatus,
    });

    const app = express();
    app.use(express.json());
    app.use('/api/reception', router);
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

  test('POST /api/reception/members returns 401 when unauthenticated', async () => {
    activeUser = null;
    const res = await fetch(`${baseUrl}/api/reception/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'John Walkin',
        email: 'john@example.com',
        phone: '+91 9876543210',
      }),
    });

    assert.equal(res.status, 401);
  });

  test('POST /api/reception/members returns 403 for member or trainer role', async () => {
    activeUser = { uid: 'mem-1', email: 'member@gym.com', role: 'member', approvalStatus: 'active' };
    const res = await fetch(`${baseUrl}/api/reception/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'John Walkin',
        email: 'john@example.com',
        phone: '+91 9876543210',
      }),
    });

    assert.equal(res.status, 403);
  });

  test('POST /api/reception/members returns 403 when reception staff is pending or suspended', async () => {
    activeUser = { uid: 'rec-1', email: 'staff@gym.com', role: 'reception', approvalStatus: 'pending' };
    const res = await fetch(`${baseUrl}/api/reception/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'John Walkin',
        email: 'john@example.com',
        phone: '+91 9876543210',
      }),
    });

    assert.equal(res.status, 403);
  });

  test('POST /api/reception/members returns 422 when validation fails (invalid email or missing name)', async () => {
    activeUser = { uid: 'rec-1', email: 'reception@gym.com', role: 'reception', approvalStatus: 'active' };
    const res = await fetch(`${baseUrl}/api/reception/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: '', // too short
        email: 'not-an-email',
      }),
    });

    assert.equal(res.status, 422);
  });

  test('POST /api/reception/members returns 409 Conflict when duplicate email is submitted', async () => {
    activeUser = { uid: 'rec-1', email: 'reception@gym.com', role: 'reception', approvalStatus: 'active' };

    // Register first member
    const res1 = await fetch(`${baseUrl}/api/reception/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'Existing Member',
        email: 'existing@gym.com',
        phone: '+91 9876543211',
      }),
    });
    assert.equal(res1.status, 201);

    // Try submitting identical email
    const res2 = await fetch(`${baseUrl}/api/reception/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'Second Member',
        email: 'existing@gym.com',
        phone: '+91 9876543212',
      }),
    });
    assert.equal(res2.status, 409);
    const body2 = await res2.json();
    assert.ok(body2.message.includes('already exists'));
  });

  test('POST /api/reception/members successfully registers a walk-in member with auto-generated password', async () => {
    activeUser = { uid: 'rec-1', email: 'reception@gym.com', role: 'reception', approvalStatus: 'active' };
    const res = await fetch(`${baseUrl}/api/reception/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'Sarah Walker',
        email: 'sarah.walker@gym.com',
        phone: '+91 9876543220',
        gender: 'female',
        dateOfBirth: '1998-05-14',
      }),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.status, 'success');
    assert.equal(body.data.user.displayName, 'Sarah Walker');
    assert.equal(body.data.user.email, 'sarah.walker@gym.com');
    assert.equal(body.data.user.role, 'member');
    assert.equal(body.data.user.approvalStatus, 'active');
    assert.ok(body.data.temporaryPassword.startsWith('Gym#'));
  });

  test('POST /api/reception/members allows owner and assigns starter membership plan', async () => {
    activeUser = { uid: 'owner-1', email: 'owner@gym.com', role: 'owner', approvalStatus: 'active' };
    const res = await fetch(`${baseUrl}/api/reception/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'Rahul Sharma',
        email: 'rahul.sharma@gym.com',
        phone: '+91 9876543230',
        assignedPlanId: 'plan-3-months',
        emergencyContact: {
          name: 'Pooja Sharma',
          phone: '+91 9876543231',
          relation: 'Spouse',
        },
      }),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.data.user.displayName, 'Rahul Sharma');
    assert.ok(body.data.membership);
    assert.equal(body.data.membership.planId, 'plan-3-months');
    assert.equal(body.data.membership.status, 'active');
  });

  test('GET /api/reception/members lists registered members', async () => {
    activeUser = { uid: 'rec-1', email: 'reception@gym.com', role: 'reception', approvalStatus: 'active' };
    const res = await fetch(`${baseUrl}/api/reception/members`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body.data));
    assert.ok(body.data.length >= 3);
  });
});

