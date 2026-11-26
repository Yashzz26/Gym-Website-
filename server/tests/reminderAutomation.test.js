/**
 * tests/reminderAutomation.test.js — Tests for Automated Idempotent Reminder Jobs (Day 25 Task 50)
 */

process.env.NODE_ENV = 'test';
process.env.TEST_MODE = 'true';
process.env.LOG_FORMAT = 'json';

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';

import { createReminderAutomationService } from '../services/reminderAutomationService.js';
import { createReminderController } from '../controllers/reminderController.js';
import { createRemindersRouter } from '../routes/reminders.js';
import { notFound } from '../middleware/notFound.js';
import { errorHandler } from '../middleware/errorHandler.js';
import { UnauthorizedError, ForbiddenError } from '../utils/errors.js';

function createMockStores() {
  const reminderLogs = new Map();
  const whatsappLogs = new Map();
  const notifications = new Map();

  const makeCollection = (store) => ({
    where(field, op, val) {
      return {
        where(field2, op2, val2) {
          return {
            async get() {
              const matches = [];
              for (const [id, item] of store.entries()) {
                if (op === '==' && item[field] === val && op2 === '==' && item[field2] === val2) {
                  matches.push({ id, data: () => ({ ...item }) });
                }
              }
              return { empty: matches.length === 0, docs: matches };
            },
          };
        },
        async get() {
          const matches = [];
          for (const [id, item] of store.entries()) {
            if (op === '==' && item[field] === val) {
              matches.push({ id, data: () => ({ ...item }) });
            }
          }
          return { empty: matches.length === 0, docs: matches };
        },
      };
    },
    doc(id) {
      const docId = id || `rem-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      return {
        id: docId,
        async get() {
          if (!store.has(docId)) return { exists: false, data: () => null };
          return { exists: true, data: () => ({ ...store.get(docId) }) };
        },
        async set(data) {
          store.set(docId, { ...data });
        },
        async update(updates) {
          store.set(docId, { ...store.get(docId), ...updates });
        },
      };
    },
    async get() {
      const matches = [];
      for (const [id, item] of store.entries()) {
        matches.push({ id, data: () => ({ ...item }) });
      }
      return { empty: matches.length === 0, docs: matches };
    },
  });

  return {
    collection(name) {
      if (name === 'reminderLogs') return makeCollection(reminderLogs);
      if (name === 'whatsappLogs') return makeCollection(whatsappLogs);
      if (name === 'notifications') return makeCollection(notifications);
      throw new Error(`Unexpected mock collection: ${name}`);
    },
    _stores: { reminderLogs, whatsappLogs, notifications },
  };
}

describe('Automated Reminder Jobs & Idempotency (Day 25 Task 50)', () => {
  let server;
  let baseUrl;
  let activeUser = null;
  let mockDb;
  let mockWhatsAppService;
  let mockNotificationService;
  let mockMembershipService;
  let mockMemberService;
  let dispatchedWhatsAppMessages = [];

  before(async () => {
    mockDb = createMockStores();
    dispatchedWhatsAppMessages = [];

    mockWhatsAppService = {
      formatPhoneE164(p) {
        return p.replace(/[^0-9]/g, '');
      },
      async sendTemplateMessage(params) {
        dispatchedWhatsAppMessages.push(params);
        if (params.memberId === 'user-opted-out') {
          return { success: false, status: 'opted_out', message: 'Opted out' };
        }
        return {
          success: true,
          status: 'sent',
          waMessageId: `wamid.MOCK_${Date.now()}`,
          recipientPhone: params.to,
        };
      },
    };

    mockNotificationService = {
      async createNotification(payload, sender) {
        const id = `notif-${Date.now()}`;
        mockDb._stores.notifications.set(id, { id, ...payload, sender });
        return { id, ...payload };
      },
    };

    mockMembershipService = {
      async getExpiringMemberships({ days = 3 }) {
        return {
          count: 2,
          windowDays: days,
          memberships: [
            {
              membershipId: 'mem-exp-1',
              userId: 'user-active-1',
              planName: '3 Months Pro',
              daysRemaining: 2,
              endDate: '2026-11-28T00:00:00.000Z',
              member: {
                id: 'user-active-1',
                displayName: 'Rahul Sharma',
                phone: '919876543210',
              },
            },
            {
              membershipId: 'mem-exp-2',
              userId: 'user-opted-out',
              planName: '1 Month Starter',
              daysRemaining: 3,
              endDate: '2026-11-29T00:00:00.000Z',
              member: {
                id: 'user-opted-out',
                displayName: 'Pooja Verma',
                phone: '919876543299',
              },
            },
          ],
        };
      },
    };

    mockMemberService = {
      async getInactiveMembers() {
        return {
          members: [
            {
              memberId: 'mem-inact-1',
              fullName: 'Aman Verma',
              phone: '919876543211',
              daysAbsent: 9,
            },
          ],
          total: 1,
        };
      },
    };

    const service = createReminderAutomationService({
      customDb: mockDb,
      whatsappService: mockWhatsAppService,
      notificationService: mockNotificationService,
      membershipService: mockMembershipService,
      memberService: mockMemberService,
    });

    const controller = createReminderController(service);

    const fakeVerifyToken = (req, _res, next) => {
      if (!activeUser) {
        return next(new UnauthorizedError('Authentication required'));
      }
      req.user = { uid: activeUser.uid, email: activeUser.email };
      req.profile = {
        uid: activeUser.uid,
        role: activeUser.role,
        approvalStatus: activeUser.approvalStatus || 'active',
      };
      next();
    };

    const fakeRequireRole = (...allowedRoles) => {
      const allowed = new Set(allowedRoles);
      return (req, _res, next) => {
        if (!activeUser || !allowed.has(activeUser.role)) {
          return next(new ForbiddenError('Insufficient permissions'));
        }
        next();
      };
    };

    const fakeRequireActiveStatus = (req, _res, next) => {
      if (req.profile?.approvalStatus !== 'active') {
        return next(new ForbiddenError('Account is not active'));
      }
      next();
    };

    const router = createRemindersRouter({
      controller,
      verifyToken: fakeVerifyToken,
      requireRole: fakeRequireRole,
      requireActiveStatus: fakeRequireActiveStatus,
    });

    const app = express();
    app.use(express.json());
    app.use('/api/reminders', router);
    app.use(notFound);
    app.use(errorHandler);

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  test('POST /api/reminders/run-renewal enforces auth and staff authorization', async () => {
    // 1. Unauthenticated -> 401
    activeUser = null;
    const unauthRes = await fetch(`${baseUrl}/api/reminders/run-renewal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ days: 3 }),
    });
    assert.equal(unauthRes.status, 401);

    // 2. Member role -> 403
    activeUser = { uid: 'mem-1', role: 'member', email: 'member@test.com' };
    const memberRes = await fetch(`${baseUrl}/api/reminders/run-renewal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ days: 3 }),
    });
    assert.equal(memberRes.status, 403);
  });

  test('POST /api/reminders/run-renewal dispatches reminders and logs executions', async () => {
    activeUser = { uid: 'owner-1', role: 'owner', email: 'owner@test.com' };
    dispatchedWhatsAppMessages = [];

    const res = await fetch(`${baseUrl}/api/reminders/run-renewal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ days: 3, targetDate: '2026-11-26' }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'success');
    assert.equal(body.data.totalEligible, 2);
    assert.equal(body.data.sentCount, 1);
    assert.equal(body.data.optedOutCount, 1);
    assert.equal(body.data.skippedDuplicates, 0);

    // Confirm dispatched WhatsApp call
    assert.equal(dispatchedWhatsAppMessages.length, 2);
    assert.equal(dispatchedWhatsAppMessages[0].templateName, 'ironcore_renewal_reminder_3days');

    // Confirm in-app notification created
    assert.ok(mockDb._stores.notifications.size >= 1);

    // Confirm reminderLogs saved
    assert.equal(mockDb._stores.reminderLogs.size, 2);
  });

  test('POST /api/reminders/run-renewal prevents duplicate sends on re-run (idempotency)', async () => {
    activeUser = { uid: 'owner-1', role: 'owner', email: 'owner@test.com' };
    dispatchedWhatsAppMessages = [];

    // Re-run the same job for the same target date
    const res = await fetch(`${baseUrl}/api/reminders/run-renewal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ days: 3, targetDate: '2026-11-26' }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'success');
    assert.equal(body.data.totalEligible, 2);
    assert.equal(body.data.sentCount, 0);
    assert.equal(body.data.skippedDuplicates, 2, 'Must skip all already reminded memberships');
    assert.equal(dispatchedWhatsAppMessages.length, 0, 'No WhatsApp calls on duplicate cycle');
  });

  test('POST /api/reminders/run-inactive dispatches follow-ups and prevents immediate re-contact', async () => {
    activeUser = { uid: 'reception-1', role: 'reception', email: 'reception@test.com' };
    dispatchedWhatsAppMessages = [];

    // First run
    const res = await fetch(`${baseUrl}/api/reminders/run-inactive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ daysInactive: 7 }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'success');
    assert.equal(body.data.totalEligible, 1);
    assert.equal(body.data.sentCount, 1);
    assert.equal(body.data.skippedDuplicates, 0);

    // Re-run immediately -> must skip due to 7-day cooldown
    const rerunRes = await fetch(`${baseUrl}/api/reminders/run-inactive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ daysInactive: 7 }),
    });
    assert.equal(rerunRes.status, 200);
    const rerunBody = await rerunRes.json();
    assert.equal(rerunBody.data.sentCount, 0);
    assert.equal(rerunBody.data.skippedDuplicates, 1, 'Must enforce re-contact cooldown');
  });

  test('POST /api/reminders/run-all runs both jobs and returns combined stats', async () => {
    activeUser = { uid: 'owner-1', role: 'owner', email: 'owner@test.com' };

    const res = await fetch(`${baseUrl}/api/reminders/run-all`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dryRun: true }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'success');
    assert.equal(body.data.dryRun, true);
    assert.ok(body.data.jobs.renewalReminders);
    assert.ok(body.data.jobs.inactiveFollowups);
    assert.ok(body.data.summary.totalEligible >= 3);
  });

  test('GET /api/reminders/logs returns recorded reminder history', async () => {
    activeUser = { uid: 'owner-1', role: 'owner', email: 'owner@test.com' };

    const res = await fetch(`${baseUrl}/api/reminders/logs?limit=10`, {
      headers: { 'Content-Type': 'application/json' },
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'success');
    assert.ok(Array.isArray(body.data));
    assert.ok(body.data.length >= 1);
  });
});
