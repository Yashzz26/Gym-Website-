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
    [
      'owner-1',
      {
        uid: 'owner-1',
        email: 'owner@gym.com',
        displayName: 'Iron Owner',
        role: 'owner',
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
  const reminderLogsStore = new Map();

  return {
    collection(name) {
      if (name === 'reminderLogs') {
        return {
          async add(data) {
            const id = `rem-${reminderLogsStore.size + 1}`;
            reminderLogsStore.set(id, { id, ...data });
            return { id };
          },
          doc(id) {
            return {
              id,
              async get() {
                const exists = reminderLogsStore.has(id);
                return {
                  id,
                  exists,
                  data: () => (exists ? { ...reminderLogsStore.get(id) } : undefined),
                };
              },
            };
          },
        };
      }

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
            };
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
                  docs: matches,
                };
              },
            };
          },
        };
      }

      throw new Error(`Unexpected collection: ${name}`);
    },
    _stores: { usersStore, membershipsStore, reminderLogsStore },
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
      if (activeUser.role) {
        req.profile = {
          role: activeUser.role,
          approvalStatus: activeUser.approvalStatus || 'active',
          displayName: activeUser.displayName || 'Test User',
          email: activeUser.email,
        };
      }
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

  /* ------------------------------------------------------------------------ */
  /* Inactive Members Detection & Retention Follow-up (Day 23 Task 45)         */
  /* ------------------------------------------------------------------------ */

  describe('Inactive Members Detection & Follow-up API', () => {
    const now = new Date();
    const daysAgo = (d) => new Date(now.getTime() - d * 24 * 60 * 60 * 1000).toISOString();
    const daysFromNow = (d) => new Date(now.getTime() + d * 24 * 60 * 60 * 1000).toISOString();

    before(() => {
      const users = mockDb._stores.usersStore;
      const mems = mockDb._stores.membershipsStore;

      // 1. Recent attendee: checked in 2 days ago
      users.set('usr-recent', {
        uid: 'usr-recent',
        email: 'recent@gym.com',
        displayName: 'Recent Member',
        role: 'member',
        approvalStatus: 'active',
        lastCheckIn: daysAgo(2),
        lastCheckInDate: daysAgo(2).split('T')[0],
      });
      mems.set('mem-recent', {
        membershipId: 'mem-recent',
        userId: 'usr-recent',
        planName: '12 Months Pro',
        status: 'active',
        startDate: daysAgo(60),
        endDate: daysFromNow(60),
      });

      // 2. Inactive 14 days
      users.set('usr-inactive-14', {
        uid: 'usr-inactive-14',
        email: 'absent14@gym.com',
        displayName: 'Absent Two Weeks',
        phone: '+91 98765 14141',
        role: 'member',
        approvalStatus: 'active',
        lastCheckIn: daysAgo(14),
        lastCheckInDate: daysAgo(14).split('T')[0],
      });
      mems.set('mem-inactive-14', {
        membershipId: 'mem-inactive-14',
        userId: 'usr-inactive-14',
        planName: '3 Months Regular',
        status: 'active',
        startDate: daysAgo(40),
        endDate: daysFromNow(50),
      });

      // 3. Inactive 25 days (Critical churn risk)
      users.set('usr-inactive-25', {
        uid: 'usr-inactive-25',
        email: 'absent25@gym.com',
        displayName: 'Absent Critical',
        phone: '+91 98765 25252',
        role: 'member',
        approvalStatus: 'active',
        lastCheckIn: daysAgo(25),
        lastCheckInDate: daysAgo(25).split('T')[0],
      });
      mems.set('mem-inactive-25', {
        membershipId: 'mem-inactive-25',
        userId: 'usr-inactive-25',
        planName: 'Annual Gold',
        status: 'active',
        startDate: daysAgo(80),
        endDate: daysFromNow(40),
      });

      // 4. Never attended member (joined 10 days ago, zero check-ins)
      users.set('usr-never-attended', {
        uid: 'usr-never-attended',
        email: 'never@gym.com',
        displayName: 'New Non-Attendee',
        phone: '+91 98765 00000',
        role: 'member',
        approvalStatus: 'active',
        createdAt: daysAgo(10),
      });
      mems.set('mem-never-attended', {
        membershipId: 'mem-never-attended',
        userId: 'usr-never-attended',
        planName: '1 Month Starter',
        status: 'active',
        startDate: daysAgo(10),
        endDate: daysFromNow(20),
      });

      // 5. Expired membership (checked in 20 days ago, but membership expired 3 days ago)
      users.set('usr-expired', {
        uid: 'usr-expired',
        email: 'expired@gym.com',
        displayName: 'Expired Account',
        role: 'member',
        approvalStatus: 'active',
        lastCheckIn: daysAgo(20),
      });
      mems.set('mem-expired', {
        membershipId: 'mem-expired',
        userId: 'usr-expired',
        planName: '1 Month Promo',
        status: 'active',
        startDate: daysAgo(33),
        endDate: daysAgo(3), // expired
      });

      // 6. Suspended user account (has active membership, but approvalStatus: 'suspended')
      users.set('usr-suspended', {
        uid: 'usr-suspended',
        email: 'suspended@gym.com',
        displayName: 'Suspended Member',
        role: 'member',
        approvalStatus: 'suspended',
        lastCheckIn: daysAgo(20),
      });
      mems.set('mem-suspended', {
        membershipId: 'mem-suspended',
        userId: 'usr-suspended',
        planName: '3 Months Regular',
        status: 'active',
        startDate: daysAgo(30),
        endDate: daysFromNow(60),
      });
    });

    test('GET /api/members/inactive returns 401 when unauthenticated', async () => {
      activeUser = null;
      const res = await fetch(`${baseUrl}/api/members/inactive`);
      assert.equal(res.status, 401);
    });

    test('GET /api/members/inactive returns 403 when called by member role', async () => {
      activeUser = { uid: 'member-1', email: 'member@gym.com', role: 'member' };
      const res = await fetch(`${baseUrl}/api/members/inactive`);
      assert.equal(res.status, 403);
    });

    test('GET /api/members/inactive returns 200 with inactive members list for owner', async () => {
      activeUser = { uid: 'owner-1', email: 'owner@gym.com', role: 'owner' };
      const res = await fetch(`${baseUrl}/api/members/inactive`);
      assert.equal(res.status, 200);

      const body = await res.json();
      assert.equal(body.status, 'success');
      assert.ok(Array.isArray(body.data));
      assert.ok(body.summary);
      assert.equal(body.daysInactiveThreshold, 7);

      // Verify members present
      const memberIds = body.data.map((m) => m.userId);
      assert.ok(memberIds.includes('usr-inactive-25'));
      assert.ok(memberIds.includes('usr-inactive-14'));
      assert.ok(memberIds.includes('usr-never-attended'));

      // Verify sorted chronologically descending by daysAbsent (most absent first)
      assert.equal(body.data[0].userId, 'usr-inactive-25');
      assert.ok(body.data[0].daysAbsent >= 24);
      assert.equal(body.data[0].urgency, 'critical');

      // Verify never attended record
      const neverMember = body.data.find((m) => m.userId === 'usr-never-attended');
      assert.ok(neverMember);
      assert.equal(neverMember.neverAttended, true);
      assert.ok(neverMember.daysAbsent >= 9);

      // Verify summary counters
      assert.equal(body.summary.totalInactive, 3);
      assert.equal(body.summary.criticalCount, 1);
      assert.equal(body.summary.urgentCount, 1);
      assert.equal(body.summary.moderateCount, 1);
      assert.equal(body.summary.neverAttendedCount, 1);
    });

    test('GET /api/members/inactive correctly excludes recent attendees, expired memberships, and suspended accounts', async () => {
      activeUser = { uid: 'owner-1', email: 'owner@gym.com', role: 'owner' };
      const res = await fetch(`${baseUrl}/api/members/inactive`);
      const body = await res.json();
      const memberIds = body.data.map((m) => m.userId);

      // Recent attendee (< 7 days) must not be included
      assert.equal(memberIds.includes('usr-recent'), false);
      // Expired membership must not be included
      assert.equal(memberIds.includes('usr-expired'), false);
      // Suspended account must not be included
      assert.equal(memberIds.includes('usr-suspended'), false);
    });

    test('GET /api/members/inactive supports daysInactive query parameter filtering', async () => {
      activeUser = { uid: 'owner-1', email: 'owner@gym.com', role: 'owner' };
      // Filter for members absent for at least 20 days
      const res = await fetch(`${baseUrl}/api/members/inactive?daysInactive=20`);
      assert.equal(res.status, 200);

      const body = await res.json();
      assert.equal(body.daysInactiveThreshold, 20);
      assert.equal(body.data.length, 1);
      assert.equal(body.data[0].userId, 'usr-inactive-25');
    });

    test('POST /api/members/:id/follow-up successfully records outreach log and updates user profile', async () => {
      activeUser = { uid: 'owner-1', email: 'owner@gym.com', role: 'owner' };
      const res = await fetch(`${baseUrl}/api/members/usr-inactive-14/follow-up`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: 'whatsapp',
          notes: 'Sent personalized comeback discount coupon',
          outcome: 'delivered',
        }),
      });

      assert.equal(res.status, 201);
      const body = await res.json();
      assert.equal(body.status, 'success');
      assert.equal(body.data.memberId, 'usr-inactive-14');
      assert.equal(body.data.channel, 'whatsapp');
      assert.equal(body.data.notes, 'Sent personalized comeback discount coupon');
      assert.equal(body.data.sentBy, 'owner-1');

      // Verify user document has updated lastFollowUp summary
      const updatedUser = mockDb._stores.usersStore.get('usr-inactive-14');
      assert.ok(updatedUser.lastFollowUp);
      assert.equal(updatedUser.lastFollowUp.channel, 'whatsapp');
      assert.equal(updatedUser.lastFollowUp.notes, 'Sent personalized comeback discount coupon');
    });

    test('POST /api/members/:id/follow-up returns 404 when target member does not exist', async () => {
      activeUser = { uid: 'owner-1', email: 'owner@gym.com', role: 'owner' };
      const res = await fetch(`${baseUrl}/api/members/non-existent-user/follow-up`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: 'call',
          notes: 'Attempted phone call',
        }),
      });

      assert.equal(res.status, 404);
    });

    test('GET /api/members/my-membership resolves active membership across Firebase UID and email-linked profile', async () => {
      const users = mockDb._stores.usersStore;
      const mems = mockDb._stores.membershipsStore;

      users.set('member-1-uid', {
        uid: 'member-1-uid',
        email: 'member1@gmail.com',
        displayName: 'Member 1',
        role: 'member',
        approvalStatus: 'active',
        membershipStatus: 'active',
      });
      mems.set('mem-seeded-1', {
        membershipId: 'mem-seeded-1',
        userId: 'member-1-uid',
        planId: 'plan-1-month',
        planName: '1 Month Starter',
        status: 'active',
        paymentMethod: 'cash',
        startDate: daysAgo(1),
        endDate: daysFromNow(29),
      });

      // Sign in with a real Firebase Auth UID sharing the same email
      activeUser = {
        uid: 'xvVWFtmEo1X6NA74QZWdluiIaha2',
        email: 'member1@gmail.com',
        role: 'member',
      };

      const res = await fetch(`${baseUrl}/api/members/my-membership`);
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.ok(body.data);
      assert.equal(body.data.membershipId, 'mem-seeded-1');
      assert.equal(body.data.status, 'active');
      assert.equal(body.data.planName, '1 Month Starter');
      assert.equal(body.data.isExpired, false);
    });
  });
});

