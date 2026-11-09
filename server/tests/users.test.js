/**
 * tests/users.test.js — Automated Tests for User Profiles & Staff Approval APIs
 *
 * Verifies:
 *   - GET /api/users/me returns authenticated user's profile
 *   - POST /api/users safely initializes profile; denies owner role self-assignment
 *   - PATCH /api/users/me updates allowed fields (displayName, phone, etc.)
 *   - PATCH /api/users/me with {role: 'owner'} or {approvalStatus: 'approved'} returns 403 and leaves Firestore unchanged
 *   - Staff approval workflow: list pending staff, approve, suspend
 */

process.env.NODE_ENV = 'test';
process.env.TEST_MODE = 'true';
process.env.LOG_FORMAT = 'json';

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';

import { createUserService } from '../services/userService.js';
import { createUserController } from '../controllers/userController.js';
import { createUsersRouter } from '../routes/users.js';
import { notFound } from '../middleware/notFound.js';
import { errorHandler } from '../middleware/errorHandler.js';
import { ForbiddenError } from '../utils/errors.js';

// ---------------------------------------------------------------------------
// In-Memory Firestore Mock for isolated, deterministic testing
// ---------------------------------------------------------------------------
function createMockFirestore(initialData = {}) {
  const store = new Map(Object.entries(initialData));

  const collection = {
    doc(id) {
      return {
        id,
        async get() {
          const exists = store.has(id);
          const data = exists ? { ...store.get(id) } : undefined;
          return {
            id,
            exists,
            data: () => data,
          };
        },
        async set(data) {
          store.set(id, { ...data });
        },
        async update(updates) {
          if (!store.has(id)) {
            const err = new Error(`No document to update: ${id}`);
            err.code = 5; // NOT_FOUND
            throw err;
          }
          const current = store.get(id);
          store.set(id, { ...current, ...updates });
        },
      };
    },
    where(field, op, val) {
      return {
        async get() {
          const docs = [];
          for (const [id, data] of store.entries()) {
            if (op === '==' && data[field] === val) {
              docs.push({
                id,
                exists: true,
                data: () => ({ ...data }),
              });
            }
          }
          return {
            forEach(callback) {
              docs.forEach(callback);
            },
            docs,
          };
        },
      };
    },
  };

  return {
    collection(name) {
      if (name !== 'users') {
        throw new Error(`Mock only supports 'users' collection`);
      }
      return collection;
    },
    _getRawStore() {
      return store;
    },
  };
}

describe('User Profiles API & Security Validation', () => {
  let server;
  let baseUrl;
  let mockDb;
  let currentAuthUser = null;

  // In-memory seed state
  const SEED_USERS = {
    'user-member-1': {
      uid: 'user-member-1',
      email: 'member@test.com',
      displayName: 'Active Member',
      phone: '+919876543210',
      role: 'member',
      approvalStatus: 'active',
      whatsappOptIn: true,
      createdAt: '2026-11-01T10:00:00.000Z',
      updatedAt: '2026-11-01T10:00:00.000Z',
    },
    'user-owner-1': {
      uid: 'user-owner-1',
      email: 'owner@test.com',
      displayName: 'Gym Owner',
      role: 'owner',
      approvalStatus: 'active',
      createdAt: '2026-11-01T08:00:00.000Z',
      updatedAt: '2026-11-01T08:00:00.000Z',
    },
    'user-trainer-pending': {
      uid: 'user-trainer-pending',
      email: 'trainer.pending@test.com',
      displayName: 'New Trainer',
      role: 'trainer',
      approvalStatus: 'pending',
      createdAt: '2026-11-08T12:00:00.000Z',
      updatedAt: '2026-11-08T12:00:00.000Z',
    },
  };

  before(async () => {
    mockDb = createMockFirestore(SEED_USERS);
    const userService = createUserService(mockDb);
    const userController = createUserController(userService);

    // Mock auth middleware that reads currentAuthUser
    const testVerifyToken = (req, _res, next) => {
      if (!currentAuthUser) {
        return next(new Error('Unauthorized in test'));
      }
      req.user = { ...currentAuthUser };
      // Also attach profile if present in db
      const profile = mockDb._getRawStore().get(currentAuthUser.uid);
      if (profile) {
        req.profile = { ...profile };
      }
      next();
    };

    const testRequireOwner = (req, _res, next) => {
      const profile = mockDb._getRawStore().get(req.user?.uid);
      if (profile?.role !== 'owner') {
        return next(new ForbiddenError('Access denied. Required role: owner'));
      }
      next();
    };

    const router = createUsersRouter({
      controller: userController,
      verifyToken: testVerifyToken,
      requireOwner: testRequireOwner,
    });

    const app = express();
    app.use(express.json());
    app.use('/api/users', router);
    app.use(notFound);
    app.use(errorHandler);

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  // -------------------------------------------------------------------------
  // GET /api/users/me
  // -------------------------------------------------------------------------
  test('GET /api/users/me returns authenticated user profile', async () => {
    currentAuthUser = { uid: 'user-member-1', email: 'member@test.com' };

    const res = await fetch(`${baseUrl}/api/users/me`);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.status, 'success');
    assert.equal(body.data.user.uid, 'user-member-1');
    assert.equal(body.data.user.role, 'member');
    assert.equal(body.data.user.displayName, 'Active Member');
  });

  test('GET /api/users/me returns 404 if profile does not exist in Firestore', async () => {
    currentAuthUser = { uid: 'unregistered-uid', email: 'ghost@test.com' };

    const res = await fetch(`${baseUrl}/api/users/me`);
    assert.equal(res.status, 404);

    const body = await res.json();
    assert.equal(body.statusCode, 404);
    assert.ok(body.message.includes('not found'));
  });

  // -------------------------------------------------------------------------
  // POST /api/users (Profile creation)
  // -------------------------------------------------------------------------
  test('POST /api/users successfully initializes a new member profile as pending', async () => {
    currentAuthUser = { uid: 'new-user-123', email: 'newmember@test.com' };

    const res = await fetch(`${baseUrl}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'John Gymgoer',
        phone: '+919999988888',
        role: 'member',
        whatsappOptIn: true,
      }),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.status, 'success');
    assert.equal(body.data.user.uid, 'new-user-123');
    assert.equal(body.data.user.role, 'member');
    assert.equal(body.data.user.approvalStatus, 'pending');

    // Verify stored in Firestore
    const stored = mockDb._getRawStore().get('new-user-123');
    assert.equal(stored.displayName, 'John Gymgoer');
  });

  test('POST /api/users rejects self-assignment of owner role with 403', async () => {
    currentAuthUser = { uid: 'attacker-uid', email: 'hacker@test.com' };

    const res = await fetch(`${baseUrl}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'Fake Owner',
        role: 'owner',
      }),
    });

    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.statusCode, 403);
    assert.ok(body.message.includes('cannot grant the owner role'));

    // Verify NOT saved in Firestore
    assert.equal(mockDb._getRawStore().has('attacker-uid'), false);
  });

  test('POST /api/users returns 422 on validation failure (missing name)', async () => {
    currentAuthUser = { uid: 'invalid-payload-user', email: 'invalid@test.com' };

    const res = await fetch(`${baseUrl}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'A', // too short
      }),
    });

    assert.equal(res.status, 422);
    const body = await res.json();
    assert.equal(body.statusCode, 422);
  });

  // -------------------------------------------------------------------------
  // PATCH /api/users/me (Safe Profile Updates)
  // -------------------------------------------------------------------------
  test('PATCH /api/users/me updates allowed fields successfully', async () => {
    currentAuthUser = { uid: 'user-member-1', email: 'member@test.com' };

    const res = await fetch(`${baseUrl}/api/users/me`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'Active Member Renamed',
        phone: '+911234567890',
        whatsappOptIn: false,
      }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'success');
    assert.equal(body.data.user.displayName, 'Active Member Renamed');
    assert.equal(body.data.user.phone, '+911234567890');
    assert.equal(body.data.user.whatsappOptIn, false);

    // Verify Firestore updated
    const stored = mockDb._getRawStore().get('user-member-1');
    assert.equal(stored.displayName, 'Active Member Renamed');
  });

  // -------------------------------------------------------------------------
  // CRITICAL REQUIREMENT TESTS:
  // "Add a test proving PATCH /users/me with {role: 'owner'} or
  // {approvalStatus: 'approved'} returns 403 and leaves Firestore unchanged."
  // -------------------------------------------------------------------------
  test("PATCH /api/users/me with {role: 'owner'} returns 403 and leaves Firestore unchanged", async () => {
    currentAuthUser = { uid: 'user-member-1', email: 'member@test.com' };
    const beforeSnapshot = JSON.parse(
      JSON.stringify(mockDb._getRawStore().get('user-member-1'))
    );

    const res = await fetch(`${baseUrl}/api/users/me`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: 'owner',
      }),
    });

    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.statusCode, 403);
    assert.ok(body.message.includes("Modifying protected field 'role' is strictly forbidden"));

    // Verify Firestore is completely unchanged
    const afterSnapshot = mockDb._getRawStore().get('user-member-1');
    assert.deepEqual(
      afterSnapshot,
      beforeSnapshot,
      'Firestore user document must remain strictly unchanged'
    );
    assert.equal(afterSnapshot.role, 'member');
  });

  test("PATCH /api/users/me with {approvalStatus: 'approved'} returns 403 and leaves Firestore unchanged", async () => {
    currentAuthUser = { uid: 'user-member-1', email: 'member@test.com' };
    const beforeSnapshot = JSON.parse(
      JSON.stringify(mockDb._getRawStore().get('user-member-1'))
    );

    const res = await fetch(`${baseUrl}/api/users/me`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        approvalStatus: 'approved',
      }),
    });

    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.statusCode, 403);
    assert.ok(body.message.includes("Modifying protected field 'approvalStatus' is strictly forbidden"));

    // Verify Firestore is completely unchanged
    const afterSnapshot = mockDb._getRawStore().get('user-member-1');
    assert.deepEqual(
      afterSnapshot,
      beforeSnapshot,
      'Firestore user document must remain strictly unchanged'
    );
    assert.equal(afterSnapshot.approvalStatus, 'active');
  });

  // -------------------------------------------------------------------------
  // Staff Approval Endpoints (Owner only)
  // -------------------------------------------------------------------------
  test('GET /api/users/staff/pending returns pending staff to owner', async () => {
    currentAuthUser = { uid: 'user-owner-1', email: 'owner@test.com' };

    const res = await fetch(`${baseUrl}/api/users/staff/pending`);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.status, 'success');
    assert.ok(Array.isArray(body.data.staff));
    assert.equal(body.data.staff.length, 1);
    assert.equal(body.data.staff[0].uid, 'user-trainer-pending');
  });

  test('GET /api/users/staff/pending returns 403 for non-owner', async () => {
    currentAuthUser = { uid: 'user-member-1', email: 'member@test.com' };

    const res = await fetch(`${baseUrl}/api/users/staff/pending`);
    assert.equal(res.status, 403);
  });

  test('PATCH /api/users/:uid/approve approves pending staff account', async () => {
    currentAuthUser = { uid: 'user-owner-1', email: 'owner@test.com' };

    const res = await fetch(`${baseUrl}/api/users/user-trainer-pending/approve`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignedRole: 'trainer' }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'success');
    assert.equal(body.data.user.approvalStatus, 'active');
    assert.equal(body.data.user.approvedBy, 'user-owner-1');

    // Verify Firestore doc is active
    const stored = mockDb._getRawStore().get('user-trainer-pending');
    assert.equal(stored.approvalStatus, 'active');
    assert.equal(stored.approvedBy, 'user-owner-1');
  });

  test('PATCH /api/users/:uid/suspend suspends a staff account', async () => {
    currentAuthUser = { uid: 'user-owner-1', email: 'owner@test.com' };

    const res = await fetch(`${baseUrl}/api/users/user-trainer-pending/suspend`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Contract ended' }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'success');
    assert.equal(body.data.user.approvalStatus, 'suspended');

    const stored = mockDb._getRawStore().get('user-trainer-pending');
    assert.equal(stored.approvalStatus, 'suspended');
    assert.equal(stored.suspensionReason, 'Contract ended');
  });
});
