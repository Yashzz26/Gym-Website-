/**
 * tests/qr.test.js — Automated Tests for Rotating QR Token Service (Day 16 Task 31)
 */

process.env.NODE_ENV = 'test';
process.env.TEST_MODE = 'true';
process.env.LOG_FORMAT = 'json';

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';

import { createQrService } from '../services/qrService.js';
import { createQrController } from '../controllers/qrController.js';
import { createQrRouter } from '../routes/qr.js';
import { notFound } from '../middleware/notFound.js';
import { errorHandler } from '../middleware/errorHandler.js';
import { ForbiddenError, UnauthorizedError } from '../utils/errors.js';

function createMockFirestore() {
  const qrTokensStore = new Map();

  return {
    qrTokensStore,
    collection(name) {
      if (name === 'qrTokens') {
        return {
          doc(id) {
            return {
              id,
              async get() {
                const exists = qrTokensStore.has(id);
                return {
                  id,
                  exists,
                  data: () => (exists ? { ...qrTokensStore.get(id) } : undefined),
                };
              },
              async set(data) {
                qrTokensStore.set(id, { ...data });
              },
              async update(patch) {
                const current = qrTokensStore.get(id) || {};
                qrTokensStore.set(id, { ...current, ...patch });
              },
            };
          },
          where(field, op, val) {
            const queryConditions = [[field, op, val]];
            const chain = {
              where(f, o, v) {
                queryConditions.push([f, o, v]);
                return chain;
              },
              async get() {
                const docs = [];
                for (const [id, item] of qrTokensStore.entries()) {
                  const matches = queryConditions.every(([cf, co, cv]) => {
                    if (co === '==') return item[cf] === cv;
                    return false;
                  });
                  if (matches) {
                    docs.push({ id, data: () => ({ ...item }) });
                  }
                }
                return {
                  docs,
                  forEach(cb) {
                    docs.forEach(cb);
                  },
                };
              },
            };
            return chain;
          },
        };
      }
      throw new Error(`Collection '${name}' not implemented in mock`);
    },
    async runTransaction(updateFn) {
      const transaction = {
        async get(docRef) {
          return docRef.get();
        },
        update(docRef, patch) {
          docRef.update(patch);
        },
      };
      return updateFn(transaction);
    },
  };
}

describe('QR Attendance Token Service (Day 16 Task 31)', () => {
  let server;
  let baseUrl;
  let mockDb;
  let authContext = {
    isAuthenticated: true,
    user: { uid: 'reception-staff-1' },
    profile: { role: 'reception', status: 'active' },
  };

  before(async () => {
    mockDb = createMockFirestore();
    const service = createQrService(mockDb);
    const controller = createQrController(service);

    const mockVerifyToken = (req, res, next) => {
      if (!authContext.isAuthenticated) {
        return next(new UnauthorizedError('Missing or invalid authorization token'));
      }
      req.user = authContext.user;
      next();
    };

    const mockRequireRole = (...roles) => (req, res, next) => {
      req.profile = authContext.profile;
      if (!roles.includes(req.profile?.role)) {
        return next(new ForbiddenError('Insufficient permissions'));
      }
      next();
    };

    const mockRequireActiveStatus = (req, res, next) => {
      if (authContext.profile?.status !== 'active') {
        return next(new ForbiddenError('Account is not active'));
      }
      next();
    };

    const router = createQrRouter({
      controller,
      verifyToken: mockVerifyToken,
      requireRole: mockRequireRole,
      requireActiveStatus: mockRequireActiveStatus,
    });

    const app = express();
    app.use(express.json());
    app.use('/api/qr', router);
    app.use(notFound);
    app.use(errorHandler);

    await new Promise((resolve) => {
      server = http.createServer(app);
      server.listen(0, '127.0.0.1', () => {
        const address = server.address();
        baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  test('GET /api/qr/current returns 401 when unauthenticated', async () => {
    authContext = { isAuthenticated: false, user: null, profile: null };

    const res = await fetch(`${baseUrl}/api/qr/current`);
    assert.equal(res.status, 401);
  });

  test('GET /api/qr/current returns 403 when role is member', async () => {
    authContext = {
      isAuthenticated: true,
      user: { uid: 'member-1' },
      profile: { role: 'member', status: 'active' },
    };

    const res = await fetch(`${baseUrl}/api/qr/current`);
    assert.equal(res.status, 403);
  });

  test('GET /api/qr/current returns active rotating token to reception/owner', async () => {
    authContext = {
      isAuthenticated: true,
      user: { uid: 'reception-1' },
      profile: { role: 'reception', status: 'active' },
    };

    const res = await fetch(`${baseUrl}/api/qr/current`);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.status, 'success');
    assert.ok(body.data.token);
    assert.equal(body.data.gymId, 'fitmax-main');
    assert.ok(body.data.exp > body.data.iat);
    assert.ok(body.data.expiresInSeconds <= 60);
    assert.ok(body.data.nonce);

    // Verify token exists in database
    const savedDoc = mockDb.qrTokensStore.get(body.data.nonce);
    assert.ok(savedDoc);
    assert.equal(savedDoc.isConsumed, false);
  });

  test('GET /api/qr/current reuses active token within validity window', async () => {
    authContext = {
      isAuthenticated: true,
      user: { uid: 'reception-1' },
      profile: { role: 'reception', status: 'active' },
    };

    const res1 = await fetch(`${baseUrl}/api/qr/current`);
    const body1 = await res1.json();

    const res2 = await fetch(`${baseUrl}/api/qr/current`);
    const body2 = await res2.json();

    assert.equal(body1.data.token, body2.data.token);
    assert.equal(body1.data.nonce, body2.data.nonce);
  });

  test('POST /api/qr/rotate generates a fresh new token', async () => {
    authContext = {
      isAuthenticated: true,
      user: { uid: 'reception-1' },
      profile: { role: 'reception', status: 'active' },
    };

    const res = await fetch(`${baseUrl}/api/qr/rotate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ttlSeconds: 90 }),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.status, 'success');
    assert.ok(body.data.token);
    assert.equal(body.data.expiresInSeconds, 90);
  });

  test('POST /api/qr/validate returns 200 for a valid unconsumed token', async () => {
    authContext = {
      isAuthenticated: true,
      user: { uid: 'member-101' },
      profile: { role: 'member', status: 'active' },
    };

    // Get current token first
    const service = createQrService(mockDb);
    const tokenData = await service.generateToken();

    const res = await fetch(`${baseUrl}/api/qr/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: tokenData.token }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'success');
    assert.equal(body.data.valid, true);
    assert.equal(body.data.payload.nonce, tokenData.nonce);
  });

  test('POST /api/qr/validate returns 400 with code "invalid" for forged or tampered token', async () => {
    authContext = {
      isAuthenticated: true,
      user: { uid: 'member-101' },
      profile: { role: 'member', status: 'active' },
    };

    const res = await fetch(`${baseUrl}/api/qr/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'forgedPayload.invalidSignature' }),
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.code, 'invalid');
    assert.match(body.message, /invalid/i);
  });

  test('POST /api/qr/validate returns 400 with code "expired" for an expired token', async () => {
    authContext = {
      isAuthenticated: true,
      user: { uid: 'member-101' },
      profile: { role: 'member', status: 'active' },
    };

    const service = createQrService(mockDb);
    // Generate token with negative TTL (already expired)
    const tokenData = await service.generateToken({ ttlSeconds: -10 });

    const res = await fetch(`${baseUrl}/api/qr/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: tokenData.token }),
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.code, 'expired');
    assert.match(body.message, /expired/i);
  });

  test('POST /api/qr/consume successfully marks token consumed and rejects replay with code "replayed"', async () => {
    authContext = {
      isAuthenticated: true,
      user: { uid: 'member-101' },
      profile: { role: 'member', status: 'active' },
    };

    const service = createQrService(mockDb);
    const tokenData = await service.generateToken();

    // First consumption: success
    const res1 = await fetch(`${baseUrl}/api/qr/consume`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: tokenData.token }),
    });

    assert.equal(res1.status, 200);
    const body1 = await res1.json();
    assert.equal(body1.status, 'success');
    assert.equal(body1.data.consumed, true);
    assert.equal(body1.data.consumedBy, 'member-101');

    // Second consumption attempt: must be rejected with 409 code "replayed"
    const res2 = await fetch(`${baseUrl}/api/qr/consume`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: tokenData.token }),
    });

    assert.equal(res2.status, 409);
    const body2 = await res2.json();
    assert.equal(body2.code, 'replayed');
    assert.match(body2.message, /already been used/i);
  });
});
