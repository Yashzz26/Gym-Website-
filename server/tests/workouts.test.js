/**
 * tests/workouts.test.js — Automated Tests for Workout Plans & Progress APIs (Day 20 Task 39)
 */

process.env.NODE_ENV = 'test';
process.env.TEST_MODE = 'true';
process.env.LOG_FORMAT = 'json';

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';

import { createWorkoutService } from '../services/workoutService.js';
import { createWorkoutController } from '../controllers/workoutController.js';
import { createWorkoutsRouter } from '../routes/workouts.js';
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
            async delete() {
              store.delete(docId);
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
                      async delete() {
                        store.delete(id);
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

describe('Workout Plans & Exercise APIs (Day 20 Task 39)', () => {
  let server;
  let baseUrl;
  let mockDb;
  let workoutService;
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
    workoutService = createWorkoutService(mockDb);
    const controller = createWorkoutController(workoutService);
    const router = createWorkoutsRouter({
      controller,
      verifyToken: mockVerifyToken,
      requireRole: mockRequireRole,
      requireActiveStatus: mockRequireActiveStatus,
    });

    const app = express();
    app.use(express.json());
    app.use('/api/workouts', router);
    app.use(notFound);
    app.use(errorHandler);

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();
    baseUrl = `http://127.0.0.1:${port}/api/workouts`;
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  // Test Fixtures Seed
  const trainerA = {
    uid: 'trainer-001',
    role: 'trainer',
    displayName: 'Coach Vikram',
    email: 'vikram@fitmax.com',
    approvalStatus: 'active',
  };

  const trainerB = {
    uid: 'trainer-002',
    role: 'trainer',
    displayName: 'Coach Priya',
    email: 'priya@fitmax.com',
    approvalStatus: 'active',
  };

  const memberA = {
    uid: 'member-101',
    role: 'member',
    displayName: 'Aman Verma',
    email: 'aman@example.com',
    approvalStatus: 'active',
    assignedTrainerId: 'trainer-001',
  };

  const memberB = {
    uid: 'member-102',
    role: 'member',
    displayName: 'Rohan Gupta',
    email: 'rohan@example.com',
    approvalStatus: 'active',
  };

  const seedDatabase = () => {
    mockDb.stores.clear();
    const usersStore = mockDb.getStore('users');
    usersStore.set(trainerA.uid, { ...trainerA });
    usersStore.set(trainerB.uid, { ...trainerB });
    usersStore.set(memberA.uid, { ...memberA });
    usersStore.set(memberB.uid, { ...memberB });

    // Active assignment: trainerA is assigned to memberA
    const assignStore = mockDb.getStore('trainerAssignments');
    assignStore.set('assign-1', {
      assignmentId: 'assign-1',
      trainerId: 'trainer-001',
      memberId: 'member-101',
      isActive: true,
      assignedAt: '2026-11-15T00:00:00.000Z',
    });
  };

  test('POST /api/workouts/plans returns 401 when unauthenticated', async () => {
    authContext = { user: null, profile: null };

    const res = await fetch(`${baseUrl}/plans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId: 'm1' }),
    });

    assert.equal(res.status, 401);
  });

  test('POST /api/workouts/plans returns 403 when called by member role', async () => {
    authContext = {
      user: { uid: 'member-101', role: 'member', approvalStatus: 'active' },
      profile: { uid: 'member-101', role: 'member', approvalStatus: 'active' },
    };

    const res = await fetch(`${baseUrl}/plans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        memberId: 'member-101',
        weekDay: 'mon',
        title: 'Push Day',
        exercises: [{ name: 'Bench Press', sets: 4, reps: '10' }],
      }),
    });

    assert.equal(res.status, 403);
  });

  test('POST /api/workouts/plans returns 422 if required fields are invalid or missing', async () => {
    authContext = {
      user: { uid: 'trainer-001', role: 'trainer', approvalStatus: 'active' },
      profile: { uid: 'trainer-001', role: 'trainer', approvalStatus: 'active' },
    };

    const res = await fetch(`${baseUrl}/plans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        memberId: 'member-101',
        weekDay: 'invalid-day',
        title: '',
        exercises: [],
      }),
    });

    assert.equal(res.status, 422);
  });

  test('POST /api/workouts/plans returns 403 when trainer is NOT assigned to member', async () => {
    seedDatabase();
    // TrainerB is NOT assigned to memberA
    authContext = {
      user: { uid: 'trainer-002', role: 'trainer', approvalStatus: 'active' },
      profile: { uid: 'trainer-002', role: 'trainer', approvalStatus: 'active' },
    };

    const res = await fetch(`${baseUrl}/plans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        memberId: 'member-101',
        weekDay: 'mon',
        title: 'Chest & Triceps',
        exercises: [{ name: 'Barbell Bench Press', sets: 4, reps: '8-10' }],
      }),
    });

    assert.equal(res.status, 403);
    const body = await res.json();
    assert.match(body.message, /not assigned/i);
  });

  let createdPlanId;

  test('POST /api/workouts/plans successfully creates workout plan for assigned member', async () => {
    seedDatabase();
    // TrainerA IS assigned to memberA
    authContext = {
      user: { uid: 'trainer-001', role: 'trainer', approvalStatus: 'active' },
      profile: { uid: 'trainer-001', role: 'trainer', approvalStatus: 'active' },
    };

    const res = await fetch(`${baseUrl}/plans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        memberId: 'member-101',
        weekDay: 'mon',
        title: 'Chest, Shoulders & Triceps',
        notes: 'Rest 90 seconds between compound heavy sets',
        exercises: [
          {
            name: 'Barbell Flat Bench Press',
            sets: 4,
            reps: '8-10',
            weightKg: 75,
            restSeconds: 90,
            videoUrl: 'https://youtube.com/watch?v=bench-press',
            notes: 'Touch mid-chest and pause 1 sec',
          },
          {
            name: 'Incline Dumbbell Press',
            sets: 3,
            reps: '10-12',
            weightKg: 24,
            restSeconds: 60,
          },
          {
            name: 'Overhead Cable Triceps Extension',
            sets: 3,
            reps: '15',
            restSeconds: 45,
          },
        ],
      }),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.status, 'success');
    assert.ok(body.data.planId);
    assert.equal(body.data.title, 'Chest, Shoulders & Triceps');
    assert.equal(body.data.weekDay, 'mon');
    assert.equal(body.data.exercises.length, 3);
    assert.equal(body.data.exercises[0].videoUrl, 'https://youtube.com/watch?v=bench-press');
    assert.equal(body.data.trainerId, 'trainer-001');

    createdPlanId = body.data.planId;
  });

  test('GET /api/workouts/plans allows member to retrieve their assigned workout plans', async () => {
    // Authenticate as memberA
    authContext = {
      user: { uid: 'member-101', role: 'member', approvalStatus: 'active' },
      profile: { uid: 'member-101', role: 'member', approvalStatus: 'active' },
    };

    const res = await fetch(`${baseUrl}/plans`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'success');
    assert.ok(body.results >= 1);
    const plan = body.data.find((p) => p.planId === createdPlanId);
    assert.ok(plan);
    assert.equal(plan.weekDay, 'mon');
  });

  test('PUT /api/workouts/plans/:planId updates workout plan exercises and sets', async () => {
    authContext = {
      user: { uid: 'trainer-001', role: 'trainer', approvalStatus: 'active' },
      profile: { uid: 'trainer-001', role: 'trainer', approvalStatus: 'active' },
    };

    const res = await fetch(`${baseUrl}/plans/${createdPlanId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Heavy Push Hypertrophy',
        exercises: [
          {
            name: 'Barbell Flat Bench Press',
            sets: 5,
            reps: '5',
            weightKg: 85,
          },
        ],
      }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'success');
    assert.equal(body.data.title, 'Heavy Push Hypertrophy');
    assert.equal(body.data.exercises[0].sets, 5);
  });

  test('PUT /api/workouts/plans/:planId rejects update from unassigned trainer with 403', async () => {
    authContext = {
      user: { uid: 'trainer-002', role: 'trainer', approvalStatus: 'active' },
      profile: { uid: 'trainer-002', role: 'trainer', approvalStatus: 'active' },
    };

    const res = await fetch(`${baseUrl}/plans/${createdPlanId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Unauthorized Hijack',
      }),
    });

    assert.equal(res.status, 403);
  });

  test('POST /api/workouts/logs allows member to record workout completion', async () => {
    authContext = {
      user: { uid: 'member-101', role: 'member', approvalStatus: 'active' },
      profile: { uid: 'member-101', role: 'member', approvalStatus: 'active' },
    };

    const res = await fetch(`${baseUrl}/logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workoutPlanId: createdPlanId,
        date: '2026-11-21',
        completedExercises: ['Barbell Flat Bench Press'],
        durationMinutes: 55,
        perceivedExertion: 8,
        notes: 'Felt great on bench press, hit 5 reps with 85kg smoothly',
      }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'success');
    assert.equal(body.data.memberId, 'member-101');
    assert.deepEqual(body.data.completedExercises, ['Barbell Flat Bench Press']);
    assert.equal(body.data.durationMinutes, 55);
  });

  test('GET /api/workouts/logs returns member workout history', async () => {
    authContext = {
      user: { uid: 'member-101', role: 'member', approvalStatus: 'active' },
      profile: { uid: 'member-101', role: 'member', approvalStatus: 'active' },
    };

    const res = await fetch(`${baseUrl}/logs`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'success');
    assert.ok(body.results >= 1);
    assert.equal(body.data[0].date, '2026-11-21');
  });

  test('DELETE /api/workouts/plans/:planId deletes workout plan', async () => {
    authContext = {
      user: { uid: 'trainer-001', role: 'trainer', approvalStatus: 'active' },
      profile: { uid: 'trainer-001', role: 'trainer', approvalStatus: 'active' },
    };

    const res = await fetch(`${baseUrl}/plans/${createdPlanId}`, {
      method: 'DELETE',
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'success');

    // Verify deletion
    const checkRes = await fetch(`${baseUrl}/plans/${createdPlanId}`);
    assert.equal(checkRes.status, 404);
  });
});
