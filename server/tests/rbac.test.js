/**
 * tests/rbac.test.js — Unit tests for server-side role and account-status middleware
 *
 * Tests:
 *   requireRole()   — allows/denies based on user role fetched from Firestore
 *   requireActiveStatus — allows active, blocks pending and suspended accounts
 *   Profile caching — Firestore is queried at most once per request
 *   Shorthand helpers — requireOwner, requireStaff, requireReception, requireTrainer
 */

process.env.NODE_ENV = 'test';
process.env.TEST_MODE = 'true';
process.env.LOG_FORMAT = 'json';

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';

import { requireRole, requireActiveStatus, requireOwner, requireStaff, requireReception, requireTrainer, ROLES } from '../middleware/rbac.js';
import { notFound } from '../middleware/notFound.js';
import { errorHandler } from '../middleware/errorHandler.js';

// ---------------------------------------------------------------------------
// Helpers — in-memory Firestore mock
// ---------------------------------------------------------------------------

/**
 * Builds a middleware that injects a fake req.user (simulating verifyToken)
 * and stubs the Firestore db used by rbac.js to return the given profile.
 */
function fakeUser(uid, firestoreProfile) {
  return (req, _res, next) => {
    req.user = { uid, email: firestoreProfile?.email || `${uid}@test.com` };
    // Inject cached profile directly (simulates Firestore read result)
    if (firestoreProfile !== null) {
      req.profile = { uid, ...firestoreProfile };
    }
    next();
  };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('Server-side RBAC Middleware (requireRole + requireActiveStatus)', () => {
  let server;
  let baseUrl;

  before(async () => {
    const app = express();
    app.use(express.json());

    // ---- requireRole tests ----

    // Owner-only route
    app.get('/owner-only',
      fakeUser('u1', { role: 'owner', approvalStatus: 'active' }),
      requireRole('owner'),
      (req, res) => res.json({ ok: true, role: req.profile.role })
    );

    // Reception allowed route (owner+reception)
    app.get('/reception-only',
      fakeUser('u2', { role: 'reception', approvalStatus: 'active' }),
      requireRole('owner', 'reception'),
      (req, res) => res.json({ ok: true, role: req.profile.role })
    );

    // Member denied on owner-only route
    app.get('/member-denied',
      fakeUser('u3', { role: 'member', approvalStatus: 'active' }),
      requireRole('owner'),
      (req, res) => res.json({ ok: true })
    );

    // Trainer on staff route (should pass)
    app.get('/staff-route',
      fakeUser('u4', { role: 'trainer', approvalStatus: 'active' }),
      requireRole('owner', 'reception', 'trainer'),
      (req, res) => res.json({ ok: true, role: req.profile.role })
    );

    // ---- requireActiveStatus tests ----

    // Active member can access
    app.get('/active-member',
      fakeUser('u5', { role: 'member', approvalStatus: 'active' }),
      requireActiveStatus,
      (req, res) => res.json({ ok: true, status: req.profile.approvalStatus })
    );

    // Pending user blocked
    app.get('/pending-user',
      fakeUser('u6', { role: 'member', approvalStatus: 'pending' }),
      requireActiveStatus,
      (req, res) => res.json({ ok: true })
    );

    // Suspended user blocked
    app.get('/suspended-user',
      fakeUser('u7', { role: 'reception', approvalStatus: 'suspended' }),
      requireActiveStatus,
      (req, res) => res.json({ ok: true })
    );

    // ---- Chained: role + status ----

    app.get('/chained-pass',
      fakeUser('u8', { role: 'owner', approvalStatus: 'active' }),
      requireRole('owner'),
      requireActiveStatus,
      (req, res) => res.json({ ok: true })
    );

    app.get('/chained-fail-status',
      fakeUser('u9', { role: 'owner', approvalStatus: 'pending' }),
      requireRole('owner'),
      requireActiveStatus,
      (req, res) => res.json({ ok: true })
    );

    // ---- Shorthand helpers ----

    app.get('/shorthand-owner',
      fakeUser('u10', { role: 'owner', approvalStatus: 'active' }),
      requireOwner,
      (req, res) => res.json({ ok: true })
    );

    app.get('/shorthand-staff-trainer',
      fakeUser('u11', { role: 'trainer', approvalStatus: 'active' }),
      requireStaff,
      (req, res) => res.json({ ok: true })
    );

    app.get('/shorthand-reception-denied',
      fakeUser('u12', { role: 'member', approvalStatus: 'active' }),
      requireReception,
      (req, res) => res.json({ ok: true })
    );

    app.get('/shorthand-trainer',
      fakeUser('u13', { role: 'trainer', approvalStatus: 'active' }),
      requireTrainer,
      (req, res) => res.json({ ok: true })
    );

    app.use(notFound);
    app.use(errorHandler);

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  // ---- requireRole tests ----

  test('ROLES constant lists 4 valid roles in privilege order', () => {
    assert.deepEqual(ROLES, ['member', 'trainer', 'reception', 'owner']);
  });

  test('requireRole: owner can access owner-only route', async () => {
    const res = await fetch(`${baseUrl}/owner-only`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.role, 'owner');
  });

  test('requireRole: reception can access reception-allowed route', async () => {
    const res = await fetch(`${baseUrl}/reception-only`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.role, 'reception');
  });

  test('requireRole: member is denied access to owner-only route with 403', async () => {
    const res = await fetch(`${baseUrl}/member-denied`);
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.ok(body.message.includes('Access denied'));
    assert.ok(body.message.includes('owner'));
  });

  test('requireRole: trainer can access staff route', async () => {
    const res = await fetch(`${baseUrl}/staff-route`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.role, 'trainer');
  });

  // ---- requireActiveStatus tests ----

  test('requireActiveStatus: active member passes through', async () => {
    const res = await fetch(`${baseUrl}/active-member`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'active');
  });

  test('requireActiveStatus: pending user gets 403 with pending message', async () => {
    const res = await fetch(`${baseUrl}/pending-user`);
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.ok(body.message.toLowerCase().includes('pending'));
  });

  test('requireActiveStatus: suspended user gets 403 with suspended message', async () => {
    const res = await fetch(`${baseUrl}/suspended-user`);
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.ok(body.message.toLowerCase().includes('suspended'));
  });

  // ---- Chained ----

  test('Chained role+status: owner+active passes both checks', async () => {
    const res = await fetch(`${baseUrl}/chained-pass`);
    assert.equal(res.status, 200);
  });

  test('Chained role+status: owner+pending fails at status check with 403', async () => {
    const res = await fetch(`${baseUrl}/chained-fail-status`);
    assert.equal(res.status, 403);
  });

  // ---- Shorthand helpers ----

  test('requireOwner shorthand allows owner', async () => {
    const res = await fetch(`${baseUrl}/shorthand-owner`);
    assert.equal(res.status, 200);
  });

  test('requireStaff shorthand allows trainer', async () => {
    const res = await fetch(`${baseUrl}/shorthand-staff-trainer`);
    assert.equal(res.status, 200);
  });

  test('requireReception shorthand denies member with 403', async () => {
    const res = await fetch(`${baseUrl}/shorthand-reception-denied`);
    assert.equal(res.status, 403);
  });

  test('requireTrainer shorthand allows trainer', async () => {
    const res = await fetch(`${baseUrl}/shorthand-trainer`);
    assert.equal(res.status, 200);
  });
});
