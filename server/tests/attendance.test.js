/**
 * tests/attendance.test.js — Automated Tests for Secure Attendance Check-In (Day 17 Task 34)
 */

process.env.NODE_ENV = 'test';
process.env.TEST_MODE = 'true';
process.env.LOG_FORMAT = 'json';

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';

import { createQrService } from '../services/qrService.js';
import { createAttendanceService, getFormattedDate } from '../services/attendanceService.js';
import { createAttendanceController } from '../controllers/attendanceController.js';
import { createAttendanceRouter } from '../routes/attendance.js';
import { notFound } from '../middleware/notFound.js';
import { errorHandler } from '../middleware/errorHandler.js';
import { ForbiddenError, UnauthorizedError } from '../utils/errors.js';

function createMockFirestore() {
  const stores = new Map();

  const getStore = (name) => {
    if (!stores.has(name)) stores.set(name, new Map());
    return stores.get(name);
  };

  return {
    stores,
    getStore,
    collection(name) {
      const store = getStore(name);
      return {
        doc(id) {
          return {
            id,
            async get() {
              const exists = store.has(id);
              return {
                id,
                exists,
                data: () => (exists ? { ...store.get(id) } : undefined),
              };
            },
            async set(data) {
              store.set(id, { ...data });
            },
            async update(patch) {
              const current = store.get(id) || {};
              store.set(id, { ...current, ...patch });
            },
          };
        },
        where(field, op, val) {
          const conditions = [[field, op, val]];
          let orderField = null;
          let limitCount = null;

          const chain = {
            where(f, o, v) {
              conditions.push([f, o, v]);
              return chain;
            },
            orderBy(f) {
              orderField = f;
              return chain;
            },
            limit(n) {
              limitCount = n;
              return chain;
            },
            async get() {
              const docs = [];
              for (const [id, item] of store.entries()) {
                const matches = conditions.every(([cf, co, cv]) => {
                  if (co === '==') return item[cf] === cv;
                  if (co === '!=') return item[cf] !== cv;
                  if (co === '>') return item[cf] > cv;
                  if (co === '<') return item[cf] < cv;
                  return false;
                });
                if (matches) {
                  docs.push({ id, data: () => ({ ...item }) });
                }
              }
              const sliced = limitCount ? docs.slice(0, limitCount) : docs;
              return {
                empty: sliced.length === 0,
                docs: sliced,
                forEach(cb) {
                  sliced.forEach(cb);
                },
              };
            },
          };
          return chain;
        },
      };
    },
    async runTransaction(updateFn) {
      const transaction = {
        async get(docRef) {
          return docRef.get();
        },
        update(docRef, patch) {
          return docRef.update(patch);
        },
        set(docRef, data) {
          return docRef.set(data);
        },
      };
      return updateFn(transaction);
    },
  };
}

describe('Secure Attendance Check-In (Day 17 Task 34)', () => {
  let server;
  let baseUrl;
  let mockDb;
  let qrService;
  let attendanceService;

  let currentAuthUser = null;

  const mockVerifyToken = async (req, _res, next) => {
    if (!currentAuthUser) {
      return next(new UnauthorizedError('Authentication required'));
    }
    req.user = { ...currentAuthUser };
    req.profile = { ...currentAuthUser };
    next();
  };

  const mockRequireRole = (...roles) => (req, _res, next) => {
    if (!req.profile || !roles.includes(req.profile.role)) {
      return next(new ForbiddenError(`Access denied. Allowed: ${roles.join(', ')}`));
    }
    next();
  };

  const mockRequireActiveStatus = (req, _res, next) => {
    if (req.profile?.approvalStatus !== 'active') {
      return next(new ForbiddenError('Account is not active'));
    }
    next();
  };

  before(async () => {
    mockDb = createMockFirestore();
    qrService = createQrService(mockDb, 'test-attendance-secret-key-12345');
    attendanceService = createAttendanceService(mockDb, qrService);
    const attendanceController = createAttendanceController(attendanceService);

    const testRouter = createAttendanceRouter({
      controller: attendanceController,
      verifyToken: mockVerifyToken,
      requireRole: mockRequireRole,
      requireActiveStatus: mockRequireActiveStatus,
    });

    const app = express();
    app.use(express.json());
    app.use('/api/attendance', testRouter);
    app.use(notFound);
    app.use(errorHandler);

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;

    // Seed test users
    const usersStore = mockDb.getStore('users');
    usersStore.set('member-active-1', {
      uid: 'member-active-1',
      displayName: 'Active Runner',
      email: 'runner@fitmax.com',
      role: 'member',
      approvalStatus: 'active',
      activeMembershipId: 'mem-100',
      streakDays: 0,
      lastCheckInDate: null,
    });

    usersStore.set('member-streak-2', {
      uid: 'member-streak-2',
      displayName: 'Streak Master',
      email: 'streak@fitmax.com',
      role: 'member',
      approvalStatus: 'active',
      activeMembershipId: 'mem-200',
      streakDays: 4,
      lastCheckInDate: getFormattedDate(new Date(Date.now() - 24 * 60 * 60 * 1000)), // yesterday
    });

    usersStore.set('member-inactive-mem', {
      uid: 'member-inactive-mem',
      displayName: 'No Membership User',
      email: 'nomem@fitmax.com',
      role: 'member',
      approvalStatus: 'active',
      activeMembershipId: null,
    });

    usersStore.set('reception-staff-1', {
      uid: 'reception-staff-1',
      displayName: 'Desk Staff',
      email: 'desk@fitmax.com',
      role: 'reception',
      approvalStatus: 'active',
    });

    // Seed test memberships
    const memStore = mockDb.getStore('memberships');
    const now = new Date();
    const futureDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

    memStore.set('mem-100', {
      userId: 'member-active-1',
      planName: '1 Month Starter',
      status: 'active',
      startDate: now.toISOString(),
      endDate: futureDate,
    });

    memStore.set('mem-200', {
      userId: 'member-streak-2',
      planName: '3 Months Pro',
      status: 'active',
      startDate: now.toISOString(),
      endDate: futureDate,
    });
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  test('POST /api/attendance/check-in returns 401 when unauthenticated', async () => {
    currentAuthUser = null;
    const res = await fetch(`${baseUrl}/api/attendance/check-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'mock-qr-token' }),
    });

    assert.equal(res.status, 401);
  });

  test('POST /api/attendance/check-in returns 422 if token is missing', async () => {
    currentAuthUser = {
      uid: 'member-active-1',
      role: 'member',
      approvalStatus: 'active',
    };

    const res = await fetch(`${baseUrl}/api/attendance/check-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    assert.equal(res.status, 422);
  });

  test('POST /api/attendance/check-in returns 400 when token signature is invalid', async () => {
    currentAuthUser = {
      uid: 'member-active-1',
      role: 'member',
      approvalStatus: 'active',
    };

    const res = await fetch(`${baseUrl}/api/attendance/check-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'fakePayload.invalidSignature' }),
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.code, 'invalid');
  });

  test('POST /api/attendance/check-in returns 400 when token has expired', async () => {
    currentAuthUser = {
      uid: 'member-active-1',
      role: 'member',
      approvalStatus: 'active',
    };

    // Generate expired token with TTL = -10s
    const expiredTokenData = await qrService.generateToken({ ttlSeconds: -10 });

    const res = await fetch(`${baseUrl}/api/attendance/check-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: expiredTokenData.token }),
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.code, 'expired');
  });

  test('POST /api/attendance/check-in returns 403 when member has no active membership', async () => {
    currentAuthUser = {
      uid: 'member-inactive-mem',
      role: 'member',
      approvalStatus: 'active',
    };

    const tokenData = await qrService.generateToken({ ttlSeconds: 60 });

    const res = await fetch(`${baseUrl}/api/attendance/check-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: tokenData.token }),
    });

    assert.equal(res.status, 403);
    const body = await res.json();
    assert.ok(body.message.includes('Active gym membership required'));
  });

  test('POST /api/attendance/check-in successfully checks in active member with streak calculation', async () => {
    currentAuthUser = {
      uid: 'member-active-1',
      role: 'member',
      approvalStatus: 'active',
    };

    const tokenData = await qrService.generateToken({ ttlSeconds: 60 });

    const res = await fetch(`${baseUrl}/api/attendance/check-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: tokenData.token }),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.status, 'success');
    assert.equal(body.data.userId, 'member-active-1');
    assert.equal(body.data.streakDays, 1);
    assert.ok(body.data.timestamp);
    assert.ok(body.data.session);
  });

  test('POST /api/attendance/check-in increments consecutive streak when previous check-in was yesterday', async () => {
    currentAuthUser = {
      uid: 'member-streak-2',
      role: 'member',
      approvalStatus: 'active',
    };

    const tokenData = await qrService.generateToken({ ttlSeconds: 60 });

    const res = await fetch(`${baseUrl}/api/attendance/check-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: tokenData.token }),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.data.streakDays, 5); // 4 + 1
  });

  test('POST /api/attendance/check-in rejects duplicate check-in on the same day with 409 Conflict', async () => {
    currentAuthUser = {
      uid: 'member-active-1',
      role: 'member',
      approvalStatus: 'active',
    };

    // Attempt second check-in on the same day with a new token
    const tokenData2 = await qrService.generateToken({ ttlSeconds: 60 });

    const res = await fetch(`${baseUrl}/api/attendance/check-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: tokenData2.token }),
    });

    assert.equal(res.status, 409);
    const body = await res.json();
    assert.ok(body.message.includes('already recorded today'));
  });

  test('POST /api/attendance/check-in rejects replaying an already consumed QR token with 409 Conflict', async () => {
    currentAuthUser = {
      uid: 'reception-staff-1',
      role: 'reception',
      approvalStatus: 'active',
    };

    const tokenData = await qrService.generateToken({ ttlSeconds: 60 });

    // First consumption
    const res1 = await fetch(`${baseUrl}/api/attendance/check-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: tokenData.token }),
    });
    assert.equal(res1.status, 201);

    // Second consumption attempt with the exact same token string
    const res2 = await fetch(`${baseUrl}/api/attendance/check-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: tokenData.token }),
    });
    assert.equal(res2.status, 409);
    const body = await res2.json();
    assert.equal(body.code, 'replayed');
  });

  test('GET /api/attendance/me returns personal attendance history', async () => {
    currentAuthUser = {
      uid: 'member-active-1',
      role: 'member',
      approvalStatus: 'active',
    };

    const res = await fetch(`${baseUrl}/api/attendance/me`);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.status, 'success');
    assert.ok(Array.isArray(body.data));
    assert.ok(body.data.length >= 1);
  });

  test('GET /api/attendance/today returns 403 for member role and 200 for staff', async () => {
    // Member forbidden
    currentAuthUser = {
      uid: 'member-active-1',
      role: 'member',
      approvalStatus: 'active',
    };
    const resMember = await fetch(`${baseUrl}/api/attendance/today`);
    assert.equal(resMember.status, 403);

    // Reception allowed
    currentAuthUser = {
      uid: 'reception-staff-1',
      role: 'reception',
      approvalStatus: 'active',
    };
    const resStaff = await fetch(`${baseUrl}/api/attendance/today`);
    assert.equal(resStaff.status, 200);

    const body = await resStaff.json();
    assert.equal(body.status, 'success');
    assert.ok(body.data.totalCount >= 1);
    assert.ok(Array.isArray(body.data.records));
  });
});
