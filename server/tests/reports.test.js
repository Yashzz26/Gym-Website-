/**
 * tests/reports.test.js — Automated Tests for Daily & Weekly Report APIs (Day 26 Task 51)
 */

process.env.NODE_ENV = 'test';
process.env.TEST_MODE = 'true';
process.env.LOG_FORMAT = 'json';

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';

import { createReportService } from '../services/reportService.js';
import { createReportController } from '../controllers/reportController.js';
import { createReportsRouter } from '../routes/reports.js';
import { notFound } from '../middleware/notFound.js';
import { errorHandler } from '../middleware/errorHandler.js';
import { UnauthorizedError, ForbiddenError } from '../utils/errors.js';

function createMockStores() {
  const payments = new Map();
  const attendance = new Map();
  const users = new Map();
  const memberships = new Map();

  const makeCollection = (store) => ({
    async get() {
      const docs = [];
      for (const [id, item] of store.entries()) {
        docs.push({ id, data: () => ({ ...item }) });
      }
      return { empty: docs.length === 0, docs };
    },
    doc(id) {
      const docId = id || `doc-${Date.now()}`;
      return {
        id: docId,
        async get() {
          if (!store.has(docId)) return { exists: false, data: () => null };
          return { exists: true, data: () => ({ ...store.get(docId) }) };
        },
        async set(data) {
          store.set(docId, { ...data });
          return { id: docId };
        },
      };
    },
  });

  const customDb = {
    collection(name) {
      if (name === 'payments') return makeCollection(payments);
      if (name === 'attendance') return makeCollection(attendance);
      if (name === 'users') return makeCollection(users);
      if (name === 'memberships') return makeCollection(memberships);
      throw new Error(`Unexpected collection in test: ${name}`);
    },
  };

  return { customDb, payments, attendance, users, memberships };
}

describe('Day 26 Task 51 — Report APIs', () => {
  let server;
  let baseUrl;
  let stores;
  let mockAuthUser = { uid: 'owner-1', role: 'owner', approvalStatus: 'active' };

  before(async () => {
    stores = createMockStores();
    const service = createReportService({ customDb: stores.customDb });
    const controller = createReportController(service);

    const mockVerifyToken = (req, res, next) => {
      if (!mockAuthUser) {
        return next(new UnauthorizedError('Missing or invalid authentication token'));
      }
      req.user = { ...mockAuthUser };
      next();
    };

    const mockRequireRole = (...allowedRoles) => (req, res, next) => {
      if (!req.user || !allowedRoles.flat().includes(req.user.role)) {
        return next(new ForbiddenError('Forbidden: Insufficient privileges'));
      }
      next();
    };

    const mockRequireActiveStatus = (req, res, next) => {
      if (req.user?.approvalStatus !== 'active') {
        return next(new ForbiddenError('Account is not active'));
      }
      next();
    };

    const reportsRouter = createReportsRouter({
      controller,
      verifyToken: mockVerifyToken,
      requireRole: mockRequireRole,
      requireActiveStatus: mockRequireActiveStatus,
    });

    const app = express();
    app.use(express.json());
    app.use('/api/reports', reportsRouter);
    app.use(notFound);
    app.use(errorHandler);

    await new Promise((resolve) => {
      server = http.createServer(app);
      server.listen(0, '127.0.0.1', () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}/api/reports`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  test('GET /api/reports/daily — Rejects unauthenticated request with 401', async () => {
    mockAuthUser = null;
    const res = await fetch(`${baseUrl}/daily`);
    assert.strictEqual(res.status, 401);
  });

  test('GET /api/reports/daily — Rejects member role with 403', async () => {
    mockAuthUser = { uid: 'mem-1', role: 'member', approvalStatus: 'active' };
    const res = await fetch(`${baseUrl}/daily`);
    assert.strictEqual(res.status, 403);
  });

  test('GET /api/reports/daily — Rejects reception role with 403 (Owner exclusive)', async () => {
    mockAuthUser = { uid: 'rec-1', role: 'reception', approvalStatus: 'active' };
    const res = await fetch(`${baseUrl}/daily`);
    assert.strictEqual(res.status, 403);
  });

  test('GET /api/reports/daily — Validates invalid date format with 422', async () => {
    mockAuthUser = { uid: 'owner-1', role: 'owner', approvalStatus: 'active' };
    const res = await fetch(`${baseUrl}/daily?date=invalid-date`);
    assert.strictEqual(res.status, 422);
  });

  test('GET /api/reports/daily — Computes revenue, Cash vs UPI split, and attendance', async () => {
    mockAuthUser = { uid: 'owner-1', role: 'owner', approvalStatus: 'active' };
    const today = '2026-11-27';

    // Seed payments
    stores.payments.set('pay-1', {
      amountPaise: 150000, // 1500 INR Cash
      method: 'cash',
      status: 'completed',
      createdAt: `${today}T10:00:00.000Z`,
    });
    stores.payments.set('pay-2', {
      amountPaise: 300000, // 3000 INR UPI
      method: 'upi',
      status: 'captured',
      createdAt: `${today}T11:00:00.000Z`,
    });
    stores.payments.set('pay-3', {
      amountPaise: 200000, // 2000 INR Online
      method: 'razorpay',
      status: 'captured',
      createdAt: `${today}T12:00:00.000Z`,
    });
    // Pending payment (should NOT count in verified revenue, but in pending dues)
    stores.payments.set('pay-pending', {
      amountPaise: 100000, // 1000 INR
      method: 'upi',
      status: 'pending',
      createdAt: `${today}T09:00:00.000Z`,
      userName: 'Pending User',
    });

    // Seed attendance
    stores.attendance.set('att-1', {
      userId: 'user-1',
      date: today,
      session: 'morning',
      timestamp: `${today}T07:30:00.000Z`,
    });
    stores.attendance.set('att-2', {
      userId: 'user-2',
      date: today,
      session: 'evening',
      timestamp: `${today}T18:30:00.000Z`,
    });

    // Seed users (new member)
    stores.users.set('user-new', {
      role: 'member',
      createdAt: `${today}T08:00:00.000Z`,
    });

    // Seed memberships (upcoming 7-day renewal)
    stores.memberships.set('mem-expiring', {
      userId: 'user-3',
      userName: 'Expiring Member',
      status: 'active',
      priceInPaise: 149900,
      endDate: '2026-11-30T12:00:00.000Z', // 3 days remaining
    });

    const res = await fetch(`${baseUrl}/daily?date=${today}`);
    assert.strictEqual(res.status, 200);

    const json = await res.json();
    assert.strictEqual(json.status, 'success');
    const data = json.data;

    // Revenue checks
    assert.strictEqual(data.revenue.totalRupees, 6500); // 1500 + 3000 + 2000
    assert.strictEqual(data.revenue.breakdown.cash.rupees, 1500);
    assert.strictEqual(data.revenue.breakdown.upi.rupees, 3000);
    assert.strictEqual(data.revenue.breakdown.online.rupees, 2000);

    // Attendance checks
    assert.strictEqual(data.attendance.totalCheckIns, 2);
    assert.strictEqual(data.attendance.morningCheckIns, 1);
    assert.strictEqual(data.attendance.eveningCheckIns, 1);

    // Members
    assert.strictEqual(data.members.newMembersCount, 1);

    // Pending dues vs Upcoming renewals separation
    assert.strictEqual(data.pendingDues.count, 1);
    assert.strictEqual(data.pendingDues.totalRupees, 1000);
    assert.strictEqual(data.upcomingRenewals.count, 1);
    assert.strictEqual(data.upcomingRenewals.projectedRevenueRupees, 1499);
    assert.ok(data.upcomingRenewals.notice.includes('not automatically as overdue debt'));
  });

  test('GET /api/reports/weekly — Returns 7-day trend array and aggregations', async () => {
    mockAuthUser = { uid: 'owner-1', role: 'owner', approvalStatus: 'active' };
    const res = await fetch(`${baseUrl}/weekly?endDate=2026-11-27&days=7`);
    assert.strictEqual(res.status, 200);

    const json = await res.json();
    assert.strictEqual(json.status, 'success');
    const data = json.data;

    assert.strictEqual(data.daysCount, 7);
    assert.strictEqual(data.dailyTrend.length, 7);
    assert.ok(data.summary.totalRevenueRupees >= 6500);
    assert.ok(data.dailyTrend.some((d) => d.date === '2026-11-27'));
  });

  test('GET /api/reports/export — Generates tabular export headers and rows', async () => {
    mockAuthUser = { uid: 'owner-1', role: 'owner', approvalStatus: 'active' };
    const resDaily = await fetch(`${baseUrl}/export?type=daily&date=2026-11-27`);
    assert.strictEqual(resDaily.status, 200);
    const jsonDaily = await resDaily.json();
    assert.strictEqual(jsonDaily.status, 'success');
    assert.ok(jsonDaily.data.rows.length > 5);

    const resWeekly = await fetch(`${baseUrl}/export?type=weekly&endDate=2026-11-27`);
    assert.strictEqual(resWeekly.status, 200);
    const jsonWeekly = await resWeekly.json();
    assert.strictEqual(jsonWeekly.status, 'success');
    assert.strictEqual(jsonWeekly.data.rows.length, 7);
  });
});
