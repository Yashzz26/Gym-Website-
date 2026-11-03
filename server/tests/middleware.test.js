/**
 * tests/middleware.test.js — Automated test suite for Express middleware foundation
 * Uses Node.js native test runner (node --test)
 */

process.env.NODE_ENV = 'test';
process.env.TEST_MODE = 'true';
process.env.LOG_FORMAT = 'json';

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import { z } from 'zod';

import { createApp } from '../server.js';
import { validate } from '../middleware/validate.js';
import { notFound } from '../middleware/notFound.js';
import { errorHandler } from '../middleware/errorHandler.js';
import { BadRequestError, ForbiddenError } from '../utils/errors.js';

describe('Server & Middleware Foundation Tests', () => {
  let server;
  let baseUrl;

  before(async () => {
    const app = createApp();

    // Add test endpoints to verify validation and error classes
    const testRouter = express.Router();
    const sampleSchema = z.object({
      name: z.string().min(2, 'Name must be at least 2 characters'),
      email: z.string().email('Invalid email address'),
    });

    testRouter.post('/validate-test', validate({ body: sampleSchema }), (req, res) => {
      res.status(200).json({ status: 'success', data: req.body });
    });

    testRouter.get('/bad-request-test', (_req, _res, next) => {
      next(new BadRequestError('Custom bad request detail'));
    });

    testRouter.get('/forbidden-test', (_req, _res, next) => {
      next(new ForbiddenError('Custom forbidden access'));
    });

    app.use('/api/test', testRouter);

    // Mount error handlers
    app.use(notFound);
    app.use(errorHandler);

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  test('GET /api/health returns 200, status ok, and X-Request-Id header', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.equal(res.status, 200);

    const requestId = res.headers.get('x-request-id');
    assert.ok(requestId, 'Should include X-Request-Id header');

    const data = await res.json();
    assert.equal(data.status, 'ok');
    assert.equal(data.service, 'gym-management-server');
  });

  test('GET /api/non-existent-route returns structured 404 error with requestId', async () => {
    const res = await fetch(`${baseUrl}/api/non-existent-route`);
    assert.equal(res.status, 404);

    const data = await res.json();
    assert.equal(data.status, 'fail');
    assert.equal(data.statusCode, 404);
    assert.ok(data.message.includes('Route not found'));
    assert.ok(data.requestId, 'Should include requestId in error response');
  });

  test('POST with invalid payload triggers Zod validation error with 422 status and structured fields', async () => {
    const res = await fetch(`${baseUrl}/api/test/validate-test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'A', email: 'not-an-email' }),
    });

    assert.equal(res.status, 422);
    const data = await res.json();
    assert.equal(data.status, 'error');
    assert.equal(data.statusCode, 422);
    assert.equal(data.message, 'Request validation failed');
    assert.ok(Array.isArray(data.errors));
    assert.ok(data.errors.some((e) => e.field === 'name'));
    assert.ok(data.errors.some((e) => e.field === 'email'));
    assert.ok(data.requestId, 'Should include requestId');
  });

  test('POST with valid payload passes Zod validation with 200 status', async () => {
    const res = await fetch(`${baseUrl}/api/test/validate-test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'John Doe', email: 'john@example.com' }),
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.status, 'success');
    assert.equal(data.data.name, 'John Doe');
    assert.equal(data.data.email, 'john@example.com');
  });

  test('POST with malformed JSON triggers structured 400 error', async () => {
    const res = await fetch(`${baseUrl}/api/test/validate-test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"invalid": json payload',
    });

    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.status, 'error');
    assert.equal(data.statusCode, 400);
    assert.ok(data.message.includes('Malformed JSON payload'));
    assert.ok(data.requestId, 'Should include requestId');
  });

  test('AppError subclasses are formatted consistently with status codes', async () => {
    const badRes = await fetch(`${baseUrl}/api/test/bad-request-test`);
    assert.equal(badRes.status, 400);
    const badData = await badRes.json();
    assert.equal(badData.statusCode, 400);
    assert.equal(badData.message, 'Custom bad request detail');

    const forbidRes = await fetch(`${baseUrl}/api/test/forbidden-test`);
    assert.equal(forbidRes.status, 403);
    const forbidData = await forbidRes.json();
    assert.equal(forbidData.statusCode, 403);
    assert.equal(forbidData.message, 'Custom forbidden access');
  });

  test('CORS handles origin checks and preflight OPTIONS', async () => {
    const res = await fetch(`${baseUrl}/api/health`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:5173',
        'Access-Control-Request-Method': 'GET',
      },
    });

    assert.equal(res.status, 204);
    assert.equal(res.headers.get('access-control-allow-origin'), 'http://localhost:5173');
  });

  test('Rate limiter attaches RateLimit headers on non-exempt requests', async () => {
    const res = await fetch(`${baseUrl}/api/test/validate-test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Valid Name', email: 'valid@example.com' }),
    });

    assert.ok(
      res.headers.has('ratelimit-limit') ||
      res.headers.has('x-ratelimit-limit') ||
      res.headers.has('ratelimit-remaining')
    );
  });
});
