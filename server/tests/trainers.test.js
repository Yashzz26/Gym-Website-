/**
 * tests/trainers.test.js — Automated Tests for Trainer Assignment & Member Access Control (Day 19 Task 37)
 */

process.env.NODE_ENV = 'test';
process.env.TEST_MODE = 'true';
process.env.LOG_FORMAT = 'json';

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';

import { createTrainerService } from '../services/trainerService.js';
import { createTrainerController } from '../controllers/trainerController.js';
import { createTrainersRouter } from '../routes/trainers.js';
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
          const docId = id || `auto-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          return {
            id: docId,
            async get() {
              const exists = store.has(docId);
              return {
                id: docId,
                exists,
                data: () => (exists ? { ...store.get(docId) } : undefined),
              };
            },
            async set(data) {
              store.set(docId, { ...data });
            },
            async update(patch) {
              const current = store.get(docId) || {};
              store.set(docId, { ...current, ...patch });
            },
          };
        },
        where(field, op, val) {
          const conditions = [[field, op, val]];
          let limitCount = null;

          const chain = {
            where(f, o, v) {
              conditions.push([f, o, v]);
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
                  docs.push({
                    id,
                    data: () => ({ ...item }),
                    ref: {
                      id,
                      async update(patch) {
                        const current = store.get(id) || {};
                        store.set(id, { ...current, ...patch });
                      },
                    },
                  });
                }
              }
              const finalDocs = limitCount ? docs.slice(0, limitCount) : docs;
              return {
                docs: finalDocs,
                size: finalDocs.length,
                empty: finalDocs.length === 0,
                forEach(cb) {
                  finalDocs.forEach(cb);
                },
              };
            },
          };
          return chain;
        },
        async add(data) {
          const docId = `auto-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          store.set(docId, { ...data });
          return { id: docId };
        },
      };
    },
  };
}

describe('Trainer Assignment APIs (Day 19 Task 37)', () => {
  let server;
  let baseUrl;
  let mockDb;
  let trainerService;
  let authContext = { user: null, profile: null };

  const mockVerifyToken = (req, _res, next) => {
    if (!authContext.user) {
      return next(new UnauthorizedError('Authentication required'));
    }
    req.user = authContext.user;
    req.profile = authContext.profile;
    next();
  };

  const mockRequireRole = (...allowedRoles) => (req, _res, next) => {
    const role = req.profile?.role || req.user?.role;
    if (!allowedRoles.includes(role)) {
      return next(new ForbiddenError(`Forbidden for role: ${role}`));
    }
    next();
  };

  const mockRequireActiveStatus = (req, _res, next) => {
    const status = req.profile?.approvalStatus || req.user?.approvalStatus || 'active';
    if (status !== 'active') {
      return next(new ForbiddenError('Account is not active'));
    }
    next();
  };

  before(async () => {
    mockDb = createMockFirestore();
    trainerService = createTrainerService(mockDb);
    const controller = createTrainerController(trainerService);
    const router = createTrainersRouter({
      controller,
      verifyToken: mockVerifyToken,
      requireRole: mockRequireRole,
      requireActiveStatus: mockRequireActiveStatus,
    });

    const app = express();
    app.use(express.json());
    app.use('/api/trainers', router);
    app.use(notFound);
    app.use(errorHandler);

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();
    baseUrl = `http://127.0.0.1:${port}/api/trainers`;
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  // Test Fixtures Seed
  const trainerA = {
    uid: 'trainer-001',
    role: 'trainer',
    displayName: 'Vikram Singh',
    email: 'vikram@fitmax.com',
    approvalStatus: 'active',
  };

  const trainerB = {
    uid: 'trainer-002',
    role: 'trainer',
    displayName: 'Priya Sharma',
    email: 'priya@fitmax.com',
    approvalStatus: 'active',
  };

  const memberA = {
    uid: 'member-101',
    role: 'member',
    displayName: 'Aman Verma',
    email: 'aman@example.com',
    phone: '+919876543210',
    approvalStatus: 'active',
    membershipStatus: 'active',
    activeMembershipId: 'mem-101',
  };

  const memberB = {
    uid: 'member-102',
    role: 'member',
    displayName: 'Rohan Gupta',
    email: 'rohan@example.com',
    phone: '+919876543211',
    approvalStatus: 'active',
    membershipStatus: 'active',
    activeMembershipId: 'mem-102',
  };

  const seedDatabase = () => {
    mockDb.stores.clear();
    const usersStore = mockDb.getStore('users');
    usersStore.set(trainerA.uid, { ...trainerA });
    usersStore.set(trainerB.uid, { ...trainerB });
    usersStore.set(memberA.uid, { ...memberA });
    usersStore.set(memberB.uid, { ...memberB });

    const membershipsStore = mockDb.getStore('memberships');
    membershipsStore.set('mem-101', {
      membershipId: 'mem-101',
      userId: memberA.uid,
      planName: 'Annual Pro',
      status: 'active',
      endDate: '2027-11-20T00:00:00.000Z',
    });
    membershipsStore.set('mem-102', {
      membershipId: 'mem-102',
      userId: memberB.uid,
      planName: '3 Months Gold',
      status: 'active',
      endDate: '2027-02-20T00:00:00.000Z',
    });
  };

  test('POST /api/trainers/assign returns 401 when unauthenticated', async () => {
    authContext = { user: null, profile: null };

    const res = await fetch(`${baseUrl}/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trainerId: 't1', memberId: 'm1' }),
    });

    assert.equal(res.status, 401);
  });

  test('POST /api/trainers/assign returns 403 when called by member or trainer', async () => {
    authContext = {
      user: { uid: 'trainer-001', role: 'trainer', approvalStatus: 'active' },
      profile: { uid: 'trainer-001', role: 'trainer', approvalStatus: 'active' },
    };

    const res = await fetch(`${baseUrl}/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trainerId: 'trainer-001', memberId: 'member-101' }),
    });

    assert.equal(res.status, 403);
  });

  test('POST /api/trainers/assign returns 422 if required fields are missing', async () => {
    authContext = {
      user: { uid: 'owner-1', role: 'owner', approvalStatus: 'active' },
      profile: { uid: 'owner-1', role: 'owner', approvalStatus: 'active' },
    };

    const res = await fetch(`${baseUrl}/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trainerId: '' }),
    });

    assert.equal(res.status, 422);
  });

  test('POST /api/trainers/assign successfully assigns member to trainer and updates member profile', async () => {
    seedDatabase();
    authContext = {
      user: { uid: 'reception-1', role: 'reception', approvalStatus: 'active' },
      profile: { uid: 'reception-1', role: 'reception', approvalStatus: 'active' },
    };

    const res = await fetch(`${baseUrl}/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        trainerId: 'trainer-001',
        memberId: 'member-101',
        fitnessGoal: 'Muscle Gain',
        currentWeightKg: 78.5,
        targetWeightKg: 72.0,
        notes: 'Targeting 10% body fat with clean hypertrophy diet',
      }),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.status, 'success');
    assert.equal(body.data.trainerId, 'trainer-001');
    assert.equal(body.data.memberId, 'member-101');
    assert.equal(body.data.fitnessGoal, 'Muscle Gain');
    assert.equal(body.data.isActive, true);

    // Verify member user document in DB
    const memberDoc = mockDb.getStore('users').get('member-101');
    assert.equal(memberDoc.assignedTrainerId, 'trainer-001');
    assert.equal(memberDoc.assignedTrainerName, 'Vikram Singh');
    assert.equal(memberDoc.fitnessGoal, 'Muscle Gain');
    assert.equal(memberDoc.currentWeightKg, 78.5);
  });

  test('POST /api/trainers/assign deactivates prior assignment when reassigning member', async () => {
    authContext = {
      user: { uid: 'owner-1', role: 'owner', approvalStatus: 'active' },
      profile: { uid: 'owner-1', role: 'owner', approvalStatus: 'active' },
    };

    // Reassign memberA to trainerB
    const res = await fetch(`${baseUrl}/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        trainerId: 'trainer-002',
        memberId: 'member-101',
        fitnessGoal: 'Fat Loss',
      }),
    });

    assert.equal(res.status, 201);

    // Check all assignments for memberA
    const assignmentsStore = mockDb.getStore('trainerAssignments');
    const memberAssignments = Array.from(assignmentsStore.values()).filter(
      (a) => a.memberId === 'member-101'
    );

    assert.equal(memberAssignments.length, 2);
    const activeAssignments = memberAssignments.filter((a) => a.isActive === true);
    assert.equal(activeAssignments.length, 1);
    assert.equal(activeAssignments[0].trainerId, 'trainer-002');

    const previousAssignments = memberAssignments.filter((a) => a.isActive === false);
    assert.equal(previousAssignments.length, 1);
    assert.equal(previousAssignments[0].trainerId, 'trainer-001');
  });

  test('POST /api/trainers/unassign unassigns member and clears member trainer reference', async () => {
    authContext = {
      user: { uid: 'reception-1', role: 'reception', approvalStatus: 'active' },
      profile: { uid: 'reception-1', role: 'reception', approvalStatus: 'active' },
    };

    const res = await fetch(`${baseUrl}/unassign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        memberId: 'member-101',
        reason: 'Member requested self-guided workout routine',
      }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'success');
    assert.equal(body.data.memberId, 'member-101');

    // Check member doc
    const memberDoc = mockDb.getStore('users').get('member-101');
    assert.equal(memberDoc.assignedTrainerId, null);
    assert.equal(memberDoc.assignedTrainerName, null);
  });

  test('GET /api/trainers/members returns 403 for member role', async () => {
    authContext = {
      user: { uid: 'member-101', role: 'member', approvalStatus: 'active' },
      profile: { uid: 'member-101', role: 'member', approvalStatus: 'active' },
    };

    const res = await fetch(`${baseUrl}/members`);
    assert.equal(res.status, 403);
  });

  test('GET /api/trainers/members returns assigned members for authenticated trainer', async () => {
    seedDatabase();
    // Assign memberB to trainerA
    await trainerService.assignMember('owner-1', {
      trainerId: 'trainer-001',
      memberId: 'member-102',
      fitnessGoal: 'Strength Training',
      currentWeightKg: 85,
      targetWeightKg: 80,
    });

    // Authenticate as trainerA
    authContext = {
      user: { uid: 'trainer-001', role: 'trainer', approvalStatus: 'active' },
      profile: { uid: 'trainer-001', role: 'trainer', approvalStatus: 'active' },
    };

    const res = await fetch(`${baseUrl}/members`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'success');
    assert.equal(body.results, 1);
    assert.equal(body.data[0].memberId, 'member-102');
    assert.equal(body.data[0].displayName, 'Rohan Gupta');
    assert.equal(body.data[0].fitnessGoal, 'Strength Training');
    assert.equal(body.data[0].weightDeltaKg, 5);
  });

  test('GET /api/trainers/members/:memberId returns 403 when trainer is NOT assigned to member', async () => {
    // Authenticate as trainerB who has NO assigned members
    authContext = {
      user: { uid: 'trainer-002', role: 'trainer', approvalStatus: 'active' },
      profile: { uid: 'trainer-002', role: 'trainer', approvalStatus: 'active' },
    };

    // Attempt to access memberB (who is assigned to trainerA)
    const res = await fetch(`${baseUrl}/members/member-102`);
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.match(body.message, /not assigned/i);
  });

  test('GET /api/trainers/members/:memberId returns 200 when trainer IS assigned to member', async () => {
    // Authenticate as trainerA (who IS assigned to memberB)
    authContext = {
      user: { uid: 'trainer-001', role: 'trainer', approvalStatus: 'active' },
      profile: { uid: 'trainer-001', role: 'trainer', approvalStatus: 'active' },
    };

    const res = await fetch(`${baseUrl}/members/member-102`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'success');
    assert.equal(body.data.member.uid, 'member-102');
    assert.equal(body.data.member.displayName, 'Rohan Gupta');
    assert.equal(body.data.assignment.trainerId, 'trainer-001');
  });

  test('PATCH /api/trainers/members/:memberId/progress updates fitness progress and goal', async () => {
    authContext = {
      user: { uid: 'trainer-001', role: 'trainer', approvalStatus: 'active' },
      profile: { uid: 'trainer-001', role: 'trainer', approvalStatus: 'active' },
    };

    const res = await fetch(`${baseUrl}/members/member-102/progress`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currentWeightKg: 83.2,
        fitnessGoal: 'Hypertrophy & Conditioning',
        notes: 'Made great progress on squat depth; weight reduced by 1.8kg',
      }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'success');
    assert.equal(body.data.currentWeightKg, 83.2);

    // Verify user profile updated in database
    const memberDoc = mockDb.getStore('users').get('member-102');
    assert.equal(memberDoc.currentWeightKg, 83.2);
    assert.equal(memberDoc.fitnessGoal, 'Hypertrophy & Conditioning');
  });

  test('PATCH /api/trainers/members/:memberId/progress rejects unassigned trainer with 403', async () => {
    authContext = {
      user: { uid: 'trainer-002', role: 'trainer', approvalStatus: 'active' },
      profile: { uid: 'trainer-002', role: 'trainer', approvalStatus: 'active' },
    };

    const res = await fetch(`${baseUrl}/members/member-102/progress`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currentWeightKg: 82.0,
      }),
    });

    assert.equal(res.status, 403);
  });

  test('GET /api/trainers returns list of active trainers with active client counts', async () => {
    authContext = {
      user: { uid: 'owner-1', role: 'owner', approvalStatus: 'active' },
      profile: { uid: 'owner-1', role: 'owner', approvalStatus: 'active' },
    };

    const res = await fetch(baseUrl);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'success');
    assert.equal(body.results, 2);
    const trainer1 = body.data.find((t) => t.uid === 'trainer-001');
    assert.ok(trainer1);
    assert.equal(trainer1.activeClientsCount, 1);
  });
});
