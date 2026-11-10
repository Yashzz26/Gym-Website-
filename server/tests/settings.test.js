/**
 * tests/settings.test.js — Automated Tests for Gym Profile & Operating Settings APIs
 */

process.env.NODE_ENV = 'test';
process.env.TEST_MODE = 'true';
process.env.LOG_FORMAT = 'json';

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';

import { createGymSettingsService, DEFAULT_GYM_SETTINGS } from '../services/gymSettingsService.js';
import { createGymSettingsController } from '../controllers/gymSettingsController.js';
import { createSettingsRouter } from '../routes/settings.js';
import { notFound } from '../middleware/notFound.js';
import { errorHandler } from '../middleware/errorHandler.js';
import { ForbiddenError, UnauthorizedError } from '../utils/errors.js';

// ---------------------------------------------------------------------------
// In-Memory Firestore Mock
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
        async set(data, options = {}) {
          if (options.merge && store.has(id)) {
            const current = store.get(id);
            store.set(id, { ...current, ...data });
          } else {
            store.set(id, { ...data });
          }
        },
      };
    },
  };

  return {
    collection(name) {
      if (name === 'gymSettings') return collection;
      throw new Error(`Unexpected collection in mock: ${name}`);
    },
    _store: store,
  };
}

describe('Gym Profile & Session Settings API (Day 9 Task 18)', () => {
  let server;
  let baseUrl;
  let mockDb;
  let service;
  let activeUser = null;

  // Mock verifyToken that reads from activeUser variable
  const mockVerifyToken = (req, _res, next) => {
    if (!activeUser) {
      return next(new UnauthorizedError('Authentication token required'));
    }
    req.user = { uid: activeUser.uid, email: activeUser.email };
    req.profile = {
      uid: activeUser.uid,
      role: activeUser.role,
      approvalStatus: activeUser.approvalStatus,
    };
    next();
  };

  const mockRequireOwner = (req, _res, next) => {
    if (req.profile?.role !== 'owner') {
      return next(new ForbiddenError('Access denied. Required role: owner.'));
    }
    next();
  };

  const mockRequireActiveStatus = (req, _res, next) => {
    if (req.profile?.approvalStatus !== 'active') {
      return next(
        new ForbiddenError(`Account status (${req.profile?.approvalStatus}) does not permit access.`)
      );
    }
    next();
  };

  before(async () => {
    mockDb = createMockFirestore();
    service = createGymSettingsService(mockDb);
    const controller = createGymSettingsController(service);

    const testApp = express();
    testApp.use(express.json());

    const router = createSettingsRouter({
      controller,
      verifyToken: mockVerifyToken,
      requireOwner: mockRequireOwner,
      requireActiveStatus: mockRequireActiveStatus,
    });

    testApp.use('/api/settings', router);
    testApp.use(notFound);
    testApp.use(errorHandler);

    server = http.createServer(testApp);
    await new Promise((resolve) => server.listen(0, resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  test('GET /api/settings returns 401 when unauthenticated', async () => {
    activeUser = null;
    const res = await fetch(`${baseUrl}/api/settings`);
    assert.equal(res.status, 401);
  });

  test('GET /api/settings returns default settings when no Firestore record exists', async () => {
    activeUser = { uid: 'member-1', email: 'member@gym.com', role: 'member', approvalStatus: 'active' };
    const res = await fetch(`${baseUrl}/api/settings`);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.status, 'success');
    assert.equal(body.data.gymName, 'IronPulse Fitness Club');
    assert.equal(body.data.timezone, 'Asia/Kolkata');
    assert.equal(body.data.morningSession.startTime, '06:00');
    assert.equal(body.data.eveningSession.endTime, '22:00');
  });

  test('PUT /api/settings allows owner to update gym profile and operating sessions', async () => {
    activeUser = { uid: 'owner-1', email: 'owner@gym.com', role: 'owner', approvalStatus: 'active' };

    const updatePayload = {
      gymName: 'Titan Power Gym & Spa',
      logoUrl: 'https://example.com/logo.png',
      address: 'Shop 10-12, Elite Arcade, Andheri East, Mumbai 400069',
      phone: '+91 98200 12345',
      email: 'owner@titanpower.fit',
      gstin: '27AABCU9603R1ZX',
      upiId: 'titanpower@okhdfcbank',
      timezone: 'Asia/Kolkata',
      operatingHours: {
        openingTime: '05:00',
        closingTime: '23:00',
      },
      morningSession: {
        startTime: '05:30',
        endTime: '11:30',
      },
      eveningSession: {
        startTime: '17:00',
        endTime: '22:30',
      },
      qrRefreshIntervalSeconds: 600,
    };

    const res = await fetch(`${baseUrl}/api/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatePayload),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'success');
    assert.equal(body.data.gymName, 'Titan Power Gym & Spa');
    assert.equal(body.data.phone, '+91 98200 12345');
    assert.equal(body.data.morningSession.startTime, '05:30');
    assert.equal(body.data.qrRefreshIntervalSeconds, 600);
    assert.equal(body.data.updatedBy, 'owner-1');

    // Verify Firestore mock holds the updated document
    assert.ok(mockDb._store.has('default'));
    const saved = mockDb._store.get('default');
    assert.equal(saved.gymName, 'Titan Power Gym & Spa');
  });

  test('PUT /api/settings returns 403 when a non-owner (member, trainer, reception) attempts to edit', async () => {
    // 1. Member attempt
    activeUser = { uid: 'member-1', email: 'member@gym.com', role: 'member', approvalStatus: 'active' };
    const resMember = await fetch(`${baseUrl}/api/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...DEFAULT_GYM_SETTINGS, gymName: 'Hacked Gym' }),
    });
    assert.equal(resMember.status, 403);

    // 2. Trainer attempt
    activeUser = { uid: 'trainer-1', email: 'trainer@gym.com', role: 'trainer', approvalStatus: 'active' };
    const resTrainer = await fetch(`${baseUrl}/api/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...DEFAULT_GYM_SETTINGS, gymName: 'Trainer Gym' }),
    });
    assert.equal(resTrainer.status, 403);

    // 3. Reception attempt
    activeUser = { uid: 'reception-1', email: 'reception@gym.com', role: 'reception', approvalStatus: 'active' };
    const resReception = await fetch(`${baseUrl}/api/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...DEFAULT_GYM_SETTINGS, gymName: 'Reception Gym' }),
    });
    assert.equal(resReception.status, 403);
  });

  test('PUT /api/settings returns 403 when owner account is pending or suspended', async () => {
    activeUser = { uid: 'pending-owner', email: 'pending@gym.com', role: 'owner', approvalStatus: 'pending' };
    const res = await fetch(`${baseUrl}/api/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(DEFAULT_GYM_SETTINGS),
    });
    assert.equal(res.status, 403);
  });

  test('PUT /api/settings returns 422 when time format or payload validation fails', async () => {
    activeUser = { uid: 'owner-1', email: 'owner@gym.com', role: 'owner', approvalStatus: 'active' };

    // Invalid time "99:99"
    const invalidPayload = {
      ...DEFAULT_GYM_SETTINGS,
      morningSession: {
        startTime: '99:99',
        endTime: '12:00',
      },
    };

    const res = await fetch(`${baseUrl}/api/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invalidPayload),
    });

    assert.equal(res.status, 422);
    const body = await res.json();
    assert.equal(body.statusCode, 422);
  });
});
