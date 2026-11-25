/**
 * tests/notifications.test.js — Automated Tests for In-App Notification Service & APIs (Day 24 Task 47)
 */

process.env.NODE_ENV = 'test';
process.env.TEST_MODE = 'true';
process.env.LOG_FORMAT = 'json';

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';

import { createNotificationService } from '../services/notificationService.js';
import { createNotificationController } from '../controllers/notificationController.js';
import { createNotificationsRouter } from '../routes/notifications.js';
import { notFound } from '../middleware/notFound.js';
import { errorHandler } from '../middleware/errorHandler.js';
import { ForbiddenError, UnauthorizedError } from '../utils/errors.js';

function createMockFirestore() {
  const usersStore = new Map([
    [
      'owner-1',
      {
        uid: 'owner-1',
        email: 'owner@ironcore.fit',
        displayName: 'Vikram Owner',
        role: 'owner',
        approvalStatus: 'active',
      },
    ],
    [
      'reception-active',
      {
        uid: 'reception-active',
        email: 'reception@ironcore.fit',
        displayName: 'Sunita Reception',
        role: 'reception',
        approvalStatus: 'active',
      },
    ],
    [
      'reception-pending',
      {
        uid: 'reception-pending',
        email: 'newstaff@ironcore.fit',
        displayName: 'Pending Staff',
        role: 'reception',
        approvalStatus: 'pending',
      },
    ],
    [
      'trainer-1',
      {
        uid: 'trainer-1',
        email: 'trainer@ironcore.fit',
        displayName: 'Arjun Trainer',
        role: 'trainer',
        approvalStatus: 'active',
      },
    ],
    [
      'member-1',
      {
        uid: 'member-1',
        email: 'member1@ironcore.fit',
        displayName: 'Rahul Member',
        role: 'member',
        approvalStatus: 'active',
      },
    ],
    [
      'member-2',
      {
        uid: 'member-2',
        email: 'member2@ironcore.fit',
        displayName: 'Priya Member',
        role: 'member',
        approvalStatus: 'active',
      },
    ],
    [
      'member-suspended',
      {
        uid: 'member-suspended',
        email: 'suspended@ironcore.fit',
        displayName: 'Suspended Member',
        role: 'member',
        approvalStatus: 'suspended',
      },
    ],
  ]);

  const notificationsStore = new Map();

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
            };
          },
          where(field, op, val) {
            return {
              async get() {
                const matches = [];
                for (const [id, item] of usersStore.entries()) {
                  if (op === '==' && item[field] === val) {
                    matches.push({ id, data: () => ({ ...item }) });
                  }
                }
                return {
                  empty: matches.length === 0,
                  docs: matches,
                  forEach(cb) {
                    matches.forEach(cb);
                  },
                };
              },
            };
          },
        };
      }

      if (name === 'notifications') {
        return {
          async add(data) {
            const id = `notif-${notificationsStore.size + 1}`;
            notificationsStore.set(id, { ...data });
            return { id };
          },
          doc(id) {
            return {
              id,
              async get() {
                const exists = notificationsStore.has(id);
                return {
                  id,
                  exists,
                  data: () => (exists ? { ...notificationsStore.get(id) } : undefined),
                };
              },
              async update(updates) {
                if (!notificationsStore.has(id)) {
                  throw new Error(`Document ${id} missing`);
                }
                notificationsStore.set(id, {
                  ...notificationsStore.get(id),
                  ...updates,
                });
              },
            };
          },
          where(field, op, val) {
            return {
              async get() {
                const matches = [];
                for (const [id, item] of notificationsStore.entries()) {
                  if (op === '==' && item[field] === val) {
                    matches.push({ id, data: () => ({ ...item }) });
                  }
                }
                return {
                  empty: matches.length === 0,
                  docs: matches,
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
    _stores: { usersStore, notificationsStore },
  };
}

describe('In-App Notification Service & APIs (Day 24 Task 47)', () => {
  let server;
  let baseUrl;
  let activeUser = null;
  let mockDb;
  let service;

  before(async () => {
    mockDb = createMockFirestore();
    service = createNotificationService(mockDb);
    const controller = createNotificationController(service);

    const fakeVerifyToken = (req, _res, next) => {
      if (!activeUser) {
        return next(new UnauthorizedError('Authentication required'));
      }
      req.user = { uid: activeUser.uid, email: activeUser.email };
      req.profile = {
        uid: activeUser.uid,
        role: activeUser.role,
        approvalStatus: activeUser.approvalStatus || 'active',
        displayName: activeUser.displayName || 'Test User',
        email: activeUser.email,
      };
      next();
    };

    const fakeRequireRole = (...allowedRoles) => {
      const allowed = new Set(allowedRoles);
      return (req, _res, next) => {
        if (!allowed.has(req.profile?.role)) {
          return next(new ForbiddenError(`Required role: ${allowedRoles.join(' or ')}`));
        }
        next();
      };
    };

    const fakeRequireActiveStatus = (req, _res, next) => {
      if (req.profile?.approvalStatus !== 'active') {
        return next(new ForbiddenError('Active account required'));
      }
      next();
    };

    const router = createNotificationsRouter({
      controller,
      verifyToken: fakeVerifyToken,
      requireRole: fakeRequireRole,
      requireActiveStatus: fakeRequireActiveStatus,
    });

    const app = express();
    app.use(express.json());
    app.use('/api/notifications', router);
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

  test('GET /api/notifications returns 401 when unauthenticated', async () => {
    activeUser = null;
    const res = await fetch(`${baseUrl}/api/notifications`);
    assert.equal(res.status, 401);
  });

  test('GET /api/notifications returns 403 for pending or suspended accounts', async () => {
    activeUser = {
      uid: 'reception-pending',
      email: 'newstaff@ironcore.fit',
      role: 'reception',
      approvalStatus: 'pending',
    };
    const res = await fetch(`${baseUrl}/api/notifications`);
    assert.equal(res.status, 403);
  });

  test('POST /api/notifications returns 403 when called by member role', async () => {
    activeUser = {
      uid: 'member-1',
      email: 'member1@ironcore.fit',
      role: 'member',
      approvalStatus: 'active',
    };
    const res = await fetch(`${baseUrl}/api/notifications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: 'member-2',
        type: 'system_alert',
        title: 'Unauthorized broadcast',
        body: 'Should be blocked',
      }),
    });
    assert.equal(res.status, 403);
  });

  test('POST /api/notifications rejects trainer attempting inappropriate staff_approval delivery to owner', async () => {
    activeUser = {
      uid: 'trainer-1',
      email: 'trainer@ironcore.fit',
      role: 'trainer',
      approvalStatus: 'active',
    };
    const res = await fetch(`${baseUrl}/api/notifications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetRole: 'owner',
        type: 'staff_approval',
        title: 'Staff Approval',
        body: 'Trainer should not send staff approval alerts',
      }),
    });
    assert.equal(res.status, 403);
  });

  test('POST /api/notifications rejects workout_assigned sent to reception role', async () => {
    activeUser = {
      uid: 'trainer-1',
      email: 'trainer@ironcore.fit',
      role: 'trainer',
      approvalStatus: 'active',
    };
    const res = await fetch(`${baseUrl}/api/notifications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: 'reception-active',
        type: 'workout_assigned',
        title: 'New Workout Plan',
        body: 'Assigned leg day',
      }),
    });
    assert.equal(res.status, 403);
  });

  test('POST /api/notifications allows trainer to deliver workout_assigned notification to active member', async () => {
    activeUser = {
      uid: 'trainer-1',
      email: 'trainer@ironcore.fit',
      role: 'trainer',
      approvalStatus: 'active',
    };
    const res = await fetch(`${baseUrl}/api/notifications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: 'member-1',
        type: 'workout_assigned',
        title: 'Push Day Plan Updated',
        body: 'Your trainer added incline bench press to your Monday routine.',
        link: '/member/workout',
      }),
    });
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.status, 'success');
    assert.equal(body.data.userId, 'member-1');
    assert.equal(body.data.type, 'workout_assigned');
    assert.equal(body.data.isRead, false);
    assert.equal(body.data.link, '/member/workout');
  });

  test('POST /api/notifications rejects delivery to suspended member', async () => {
    activeUser = {
      uid: 'owner-1',
      email: 'owner@ironcore.fit',
      role: 'owner',
      approvalStatus: 'active',
    };
    const res = await fetch(`${baseUrl}/api/notifications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: 'member-suspended',
        type: 'renewal_reminder',
        title: 'Membership Notice',
        body: 'Renew your plan',
      }),
    });
    assert.equal(res.status, 400);
  });

  test('POST /api/notifications delivers role-targeted alert only to active users of that role', async () => {
    activeUser = {
      uid: 'owner-1',
      email: 'owner@ironcore.fit',
      role: 'owner',
      approvalStatus: 'active',
    };
    const res = await fetch(`${baseUrl}/api/notifications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetRoles: ['reception'],
        type: 'inactive_alert',
        title: '5 Inactive Members Flagged',
        body: 'Members absent 14+ days need follow-up.',
        link: '/reception/renewals',
      }),
    });
    assert.equal(res.status, 201);
    const body = await res.json();
    // Should deliver to reception-active ONLY, skipping reception-pending
    assert.equal(body.data.deliveredCount, 1);
    assert.deepEqual(body.data.recipientIds, ['reception-active']);
  });

  test('GET /api/notifications lists user inbox with unreadCount and filters', async () => {
    // Seed a second notification for member-1 directly via service
    await service.createNotification({
      userId: 'member-1',
      type: 'payment_confirmed',
      title: 'Payment Verified',
      body: 'Receipt REC-101 generated.',
    });

    activeUser = {
      uid: 'member-1',
      email: 'member1@ironcore.fit',
      role: 'member',
      approvalStatus: 'active',
    };

    const res = await fetch(`${baseUrl}/api/notifications`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.total, 2);
    assert.equal(body.unreadCount, 2);
    assert.equal(body.data.length, 2);

    // Filter by type
    const typeRes = await fetch(`${baseUrl}/api/notifications?type=payment_confirmed`);
    assert.equal(typeRes.status, 200);
    const typeBody = await typeRes.json();
    assert.equal(typeBody.data.length, 1);
    assert.equal(typeBody.data[0].type, 'payment_confirmed');
  });

  test('PATCH /api/notifications/:id/read forbids marking another user notification as read', async () => {
    // Find reception-active notification
    const receptionNotifs = await service.listUserNotifications('reception-active');
    const targetId = receptionNotifs.notifications[0].notificationId;

    activeUser = {
      uid: 'member-1',
      email: 'member1@ironcore.fit',
      role: 'member',
      approvalStatus: 'active',
    };

    const res = await fetch(`${baseUrl}/api/notifications/${targetId}/read`, {
      method: 'PATCH',
    });
    assert.equal(res.status, 403);
  });

  test('PATCH /api/notifications/:id/read marks own notification as read and decrements unreadCount', async () => {
    activeUser = {
      uid: 'member-1',
      email: 'member1@ironcore.fit',
      role: 'member',
      approvalStatus: 'active',
    };

    const listRes = await fetch(`${baseUrl}/api/notifications`);
    const listBody = await listRes.json();
    const targetId = listBody.data[0].notificationId;

    const patchRes = await fetch(`${baseUrl}/api/notifications/${targetId}/read`, {
      method: 'PATCH',
    });
    assert.equal(patchRes.status, 200);
    const patchBody = await patchRes.json();
    assert.equal(patchBody.data.isRead, true);
    assert.ok(patchBody.data.readAt);

    // Verify unreadOnly=true returns only remaining unread item
    const unreadRes = await fetch(`${baseUrl}/api/notifications?unreadOnly=true`);
    const unreadBody = await unreadRes.json();
    assert.equal(unreadBody.unreadCount, 1);
    assert.equal(unreadBody.data.length, 1);
  });

  test('PATCH /api/notifications/read-all marks remaining unread notifications as read without touching other users', async () => {
    activeUser = {
      uid: 'member-1',
      email: 'member1@ironcore.fit',
      role: 'member',
      approvalStatus: 'active',
    };

    const res = await fetch(`${baseUrl}/api/notifications/read-all`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.data.updatedCount, 1);

    // Confirm member-1 now has 0 unread
    const checkRes = await fetch(`${baseUrl}/api/notifications`);
    const checkBody = await checkRes.json();
    assert.equal(checkBody.unreadCount, 0);

    // Confirm reception-active notification is still unread
    const receptionCheck = await service.listUserNotifications('reception-active');
    assert.equal(receptionCheck.unreadCount, 1);
  });
});
