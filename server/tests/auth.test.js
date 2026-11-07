/**
 * tests/auth.test.js — Automated tests for Firebase Admin auth middleware & token verification
 */

process.env.NODE_ENV = 'test';
process.env.TEST_MODE = 'true';
process.env.LOG_FORMAT = 'json';

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';

import { createAuthMiddleware } from '../middleware/auth.js';
import { notFound } from '../middleware/notFound.js';
import { errorHandler } from '../middleware/errorHandler.js';

describe('Firebase Auth Middleware & ID-Token Verification', () => {
  let server;
  let baseUrl;

  // Mock token verifier function
  const mockTokenVerifier = async (token) => {
    if (token === 'valid-user-token') {
      return {
        uid: 'user_12345',
        email: 'member@example.com',
        email_verified: true,
        auth_time: Math.floor(Date.now() / 1000),
      };
    }
    if (token === 'expired-token') {
      const err = new Error('Token expired');
      err.code = 'auth/id-token-expired';
      throw err;
    }
    if (token === 'revoked-token') {
      const err = new Error('Token revoked');
      err.code = 'auth/id-token-revoked';
      throw err;
    }
    const err = new Error('Invalid token');
    err.code = 'auth/invalid-id-token';
    throw err;
  };

  before(async () => {
    const testApp = express();
    testApp.use(express.json());

    const testAuthMiddleware = createAuthMiddleware(mockTokenVerifier);

    // Protected test route
    testApp.get('/api/protected', testAuthMiddleware, (req, res) => {
      res.status(200).json({ status: 'success', user: req.user });
    });

    // Token verification route mimicking /api/auth/verify-token
    testApp.post('/api/auth/verify-token', testAuthMiddleware, (req, res) => {
      res.status(200).json({
        status: 'success',
        message: 'Authentication token verified successfully',
        user: {
          uid: req.user.uid,
          email: req.user.email,
          emailVerified: req.user.emailVerified,
        },
      });
    });

    testApp.use(notFound);
    testApp.use(errorHandler);

    server = http.createServer(testApp);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  test('returns 401 when Authorization header is missing', async () => {
    const res = await fetch(`${baseUrl}/api/protected`);
    assert.equal(res.status, 401);

    const body = await res.json();
    assert.equal(body.statusCode, 401);
    assert.ok(body.message.includes('Authentication token required'));
  });

  test('returns 401 when Authorization header does not start with Bearer', async () => {
    const res = await fetch(`${baseUrl}/api/protected`, {
      headers: { Authorization: 'Basic some-credentials' },
    });
    assert.equal(res.status, 401);

    const body = await res.json();
    assert.equal(body.statusCode, 401);
    assert.ok(body.message.includes('Malformed authorization header'));
  });

  test('returns 401 when Bearer token is empty', async () => {
    const res = await fetch(`${baseUrl}/api/protected`, {
      headers: { Authorization: 'Bearer ' },
    });
    assert.equal(res.status, 401);

    const body = await res.json();
    assert.equal(body.statusCode, 401);
    assert.ok(body.message.includes('cannot be empty'));
  });

  test('returns 401 when token is invalid', async () => {
    const res = await fetch(`${baseUrl}/api/protected`, {
      headers: { Authorization: 'Bearer invalid-token-string' },
    });
    assert.equal(res.status, 401);

    const body = await res.json();
    assert.equal(body.statusCode, 401);
    assert.ok(body.message.includes('Invalid authentication token'));
  });

  test('returns 401 with specific message when token has expired', async () => {
    const res = await fetch(`${baseUrl}/api/protected`, {
      headers: { Authorization: 'Bearer expired-token' },
    });
    assert.equal(res.status, 401);

    const body = await res.json();
    assert.equal(body.statusCode, 401);
    assert.ok(body.message.includes('expired'));
  });

  test('returns 401 with specific message when token has been revoked', async () => {
    const res = await fetch(`${baseUrl}/api/protected`, {
      headers: { Authorization: 'Bearer revoked-token' },
    });
    assert.equal(res.status, 401);

    const body = await res.json();
    assert.equal(body.statusCode, 401);
    assert.ok(body.message.includes('revoked'));
  });

  test('attaches user and returns 200 on valid token', async () => {
    const res = await fetch(`${baseUrl}/api/protected`, {
      headers: { Authorization: 'Bearer valid-user-token' },
    });
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.status, 'success');
    assert.equal(body.user.uid, 'user_12345');
    assert.equal(body.user.email, 'member@example.com');
    assert.equal(body.user.emailVerified, true);
  });

  test('POST /api/auth/verify-token verifies valid token and returns user details', async () => {
    const res = await fetch(`${baseUrl}/api/auth/verify-token`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer valid-user-token',
        'Content-Type': 'application/json',
      },
    });
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.status, 'success');
    assert.equal(body.user.uid, 'user_12345');
    assert.equal(body.user.email, 'member@example.com');
  });
});

