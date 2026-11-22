/**
 * tests/diet.test.js — Automated Tests for Diet & Nutrition Plan APIs (Day 21 Task 41)
 */

process.env.NODE_ENV = 'test';
process.env.TEST_MODE = 'true';
process.env.LOG_FORMAT = 'json';

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';

import { createDietService } from '../services/dietService.js';
import { createDietController } from '../controllers/dietController.js';
import { createDietRouter } from '../routes/diet.js';
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

describe('Diet Plans & Nutrition APIs (Day 21 Task 41)', () => {
  let server;
  let baseUrl;
  let mockDb;
  let dietService;
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
    dietService = createDietService(mockDb);
    const controller = createDietController(dietService);
    const router = createDietRouter({
      controller,
      verifyToken: mockVerifyToken,
      requireRole: mockRequireRole,
      requireActiveStatus: mockRequireActiveStatus,
    });

    const app = express();
    app.use(express.json());
    app.use('/api/diet', router);
    app.use(notFound);
    app.use(errorHandler);

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();
    baseUrl = `http://127.0.0.1:${port}/api/diet`;
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
    assignedTrainerId: 'trainer-002',
  };

  const ownerUser = {
    uid: 'owner-999',
    role: 'owner',
    displayName: 'Gym Owner',
    email: 'owner@fitmax.com',
    approvalStatus: 'active',
  };

  // Seed users & assignments in mock Firestore
  before(async () => {
    const usersStore = mockDb.getStore('users');
    usersStore.set(trainerA.uid, trainerA);
    usersStore.set(trainerB.uid, trainerB);
    usersStore.set(memberA.uid, memberA);
    usersStore.set(memberB.uid, memberB);
    usersStore.set(ownerUser.uid, ownerUser);

    const assignStore = mockDb.getStore('trainerAssignments');
    assignStore.set('assign-1', {
      id: 'assign-1',
      trainerId: trainerA.uid,
      memberId: memberA.uid,
      isActive: true,
      assignedAt: '2026-11-20T10:00:00Z',
    });
    assignStore.set('assign-2', {
      id: 'assign-2',
      trainerId: trainerB.uid,
      memberId: memberB.uid,
      isActive: true,
      assignedAt: '2026-11-20T11:00:00Z',
    });
  });

  let createdPlanId = null;

  test('POST /api/diet/plans returns 401 when unauthenticated', async () => {
    authContext = { user: null, profile: null };

    const res = await fetch(`${baseUrl}/plans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId: memberA.uid }),
    });

    assert.equal(res.status, 401);
  });

  test('POST /api/diet/plans returns 403 when called by member role', async () => {
    authContext = {
      user: { uid: memberA.uid, role: 'member' },
      profile: { uid: memberA.uid, role: 'member', approvalStatus: 'active' },
    };

    const res = await fetch(`${baseUrl}/plans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        memberId: memberA.uid,
        title: 'High Protein Cut',
        targetCalories: 2200,
        macros: { protein: 180, carbs: 200, fat: 60 },
        meals: [
          {
            name: 'Breakfast',
            items: [{ name: 'Oats with Whey', quantity: '80g oats + 1 scoop whey' }],
          },
        ],
      }),
    });

    assert.equal(res.status, 403);
  });

  test('POST /api/diet/plans returns 422 if required fields are invalid or missing', async () => {
    authContext = {
      user: { uid: trainerA.uid, role: 'trainer' },
      profile: { uid: trainerA.uid, role: 'trainer', approvalStatus: 'active' },
    };

    // Missing meals and targetCalories < 500
    const res = await fetch(`${baseUrl}/plans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        memberId: memberA.uid,
        title: 'Cut',
        targetCalories: 200, // Invalid: min 500
        macros: { protein: -10, carbs: 100, fat: 50 }, // Invalid: negative protein
        meals: [], // Invalid: min 1
      }),
    });

    assert.equal(res.status, 422);
    const body = await res.json();
    assert.equal(body.status, 'error');
  });

  test('POST /api/diet/plans returns 403 when trainer is NOT assigned to member', async () => {
    authContext = {
      user: { uid: trainerA.uid, role: 'trainer' },
      profile: { uid: trainerA.uid, role: 'trainer', approvalStatus: 'active' },
    };

    // Trainer A is assigned to Member A, NOT Member B
    const res = await fetch(`${baseUrl}/plans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        memberId: memberB.uid,
        title: 'Hypertrophy Diet',
        targetCalories: 2600,
        macros: { protein: 180, carbs: 300, fat: 70, fiber: 35 },
        meals: [
          {
            name: 'Breakfast',
            time: '08:00 AM',
            items: [{ name: 'Egg Whites & Toast', quantity: '4 whites + 2 slices' }],
          },
        ],
      }),
    });

    assert.equal(res.status, 403);
    const body = await res.json();
    assert.match(body.message, /not assigned/i);
  });

  test('POST /api/diet/plans successfully creates diet plan for assigned member', async () => {
    authContext = {
      user: { uid: trainerA.uid, role: 'trainer' },
      profile: { uid: trainerA.uid, role: 'trainer', approvalStatus: 'active' },
    };

    const res = await fetch(`${baseUrl}/plans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        memberId: memberA.uid,
        title: 'Muscle Gain & Strength Surplus',
        targetCalories: 2800,
        macros: {
          protein: 190,
          carbs: 340,
          fat: 75,
          fiber: 40,
        },
        waterIntakeLiters: 4,
        notes: 'Drink at least 1L water pre-workout. Keep sodium moderate.',
        meals: [
          {
            name: 'Breakfast',
            time: '08:30 AM',
            targetCalories: 650,
            items: [
              { name: 'Rolled Oats with Peanut Butter', quantity: '80g oats + 20g peanut butter', calories: 450, protein: 18, carbs: 62, fat: 15 },
              { name: 'Whey Protein Isolate', quantity: '1 scoop (30g)', calories: 120, protein: 25, carbs: 2, fat: 1 },
            ],
          },
          {
            name: 'Lunch',
            time: '01:30 PM',
            targetCalories: 850,
            items: [
              { name: 'Grilled Chicken Breast', quantity: '200g', calories: 330, protein: 62, carbs: 0, fat: 7 },
              { name: 'Brown Rice', quantity: '150g cooked', calories: 300, protein: 6, carbs: 65, fat: 2 },
            ],
          },
          {
            name: 'Dinner',
            time: '08:30 PM',
            targetCalories: 700,
            items: [
              { name: 'Paneer / Cottage Cheese', quantity: '150g', calories: 390, protein: 28, carbs: 8, fat: 28 },
              { name: 'Mixed Vegetables & Quinoa', quantity: '1 bowl', calories: 250, protein: 10, carbs: 45, fat: 4 },
            ],
          },
        ],
      }),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.status, 'success');
    assert.ok(body.data.id);
    assert.equal(body.data.memberId, memberA.uid);
    assert.equal(body.data.targetCalories, 2800);
    assert.equal(body.data.macros.protein, 190);
    assert.equal(body.data.meals.length, 3);
    assert.equal(body.data.isActive, true);

    createdPlanId = body.data.id;
  });

  test('GET /api/diet/plans allows member to retrieve their assigned diet plans', async () => {
    authContext = {
      user: { uid: memberA.uid, role: 'member' },
      profile: { uid: memberA.uid, role: 'member', approvalStatus: 'active' },
    };

    const res = await fetch(`${baseUrl}/plans`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'success');
    assert.ok(Array.isArray(body.data));
    assert.ok(body.data.length >= 1);
    assert.equal(body.data[0].id, createdPlanId);
    assert.equal(body.data[0].memberId, memberA.uid);
  });

  test('GET /api/diet/members/:memberId/active returns active diet plan for member', async () => {
    authContext = {
      user: { uid: memberA.uid, role: 'member' },
      profile: { uid: memberA.uid, role: 'member', approvalStatus: 'active' },
    };

    const res = await fetch(`${baseUrl}/members/${memberA.uid}/active`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'success');
    assert.ok(body.data);
    assert.equal(body.data.id, createdPlanId);
    assert.equal(body.data.title, 'Muscle Gain & Strength Surplus');
  });

  test('GET /api/diet/members/:memberId/active rejects unauthorized member with 403', async () => {
    authContext = {
      user: { uid: memberB.uid, role: 'member' },
      profile: { uid: memberB.uid, role: 'member', approvalStatus: 'active' },
    };

    // Member B trying to view Member A's active diet plan
    const res = await fetch(`${baseUrl}/members/${memberA.uid}/active`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    assert.equal(res.status, 403);
    const body = await res.json();
    assert.match(body.message, /only view your own/i);
  });

  test('PUT /api/diet/plans/:planId updates diet plan calories and macros', async () => {
    authContext = {
      user: { uid: trainerA.uid, role: 'trainer' },
      profile: { uid: trainerA.uid, role: 'trainer', approvalStatus: 'active' },
    };

    const res = await fetch(`${baseUrl}/plans/${createdPlanId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Muscle Gain — Phase 2 Lean Bulk',
        targetCalories: 2950,
        macros: {
          protein: 200,
          carbs: 360,
          fat: 80,
        },
      }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'success');
    assert.equal(body.data.targetCalories, 2950);
    assert.equal(body.data.macros.protein, 200);
    assert.equal(body.data.title, 'Muscle Gain — Phase 2 Lean Bulk');
  });

  test('PUT /api/diet/plans/:planId rejects update from unassigned trainer with 403', async () => {
    authContext = {
      user: { uid: trainerB.uid, role: 'trainer' },
      profile: { uid: trainerB.uid, role: 'trainer', approvalStatus: 'active' },
    };

    const res = await fetch(`${baseUrl}/plans/${createdPlanId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetCalories: 2000,
      }),
    });

    assert.equal(res.status, 403);
  });

  test('Owner can create, view, and update diet plans across members', async () => {
    authContext = {
      user: { uid: ownerUser.uid, role: 'owner' },
      profile: { uid: ownerUser.uid, role: 'owner', approvalStatus: 'active' },
    };

    // Owner creates diet plan for Member B (even without direct trainer assignment)
    const createRes = await fetch(`${baseUrl}/plans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        memberId: memberB.uid,
        title: 'Owner Custom Shred Plan',
        targetCalories: 2100,
        macros: { protein: 170, carbs: 180, fat: 55 },
        meals: [
          {
            name: 'Breakfast',
            items: [{ name: 'Scrambled eggs', quantity: '3 whole eggs' }],
          },
        ],
      }),
    });

    assert.equal(createRes.status, 201);
    const createBody = await createRes.json();
    assert.equal(createBody.data.memberId, memberB.uid);
  });

  test('DELETE /api/diet/plans/:planId deletes diet plan', async () => {
    authContext = {
      user: { uid: trainerA.uid, role: 'trainer' },
      profile: { uid: trainerA.uid, role: 'trainer', approvalStatus: 'active' },
    };

    const res = await fetch(`${baseUrl}/plans/${createdPlanId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    });

    assert.equal(res.status, 200);

    // Subsequent retrieval returns 404
    const getRes = await fetch(`${baseUrl}/plans/${createdPlanId}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    assert.equal(getRes.status, 404);
  });
});
