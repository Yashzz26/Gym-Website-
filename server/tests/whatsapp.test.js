/**
 * tests/whatsapp.test.js — Tests for WhatsApp Business Cloud API Foundation (Day 24 Task 48)
 */

process.env.NODE_ENV = 'test';
process.env.TEST_MODE = 'true';
process.env.LOG_FORMAT = 'json';

import crypto from 'node:crypto';
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';

import {
  getWhatsAppConfig,
  isWhatsAppConfigured,
  isWhatsAppMockMode,
  getGraphApiMessagesUrl,
  getSanitizedWhatsAppStatus,
} from '../config/whatsapp.js';
import { createWhatsAppService } from '../services/whatsappService.js';
import { createWhatsAppController } from '../controllers/whatsappController.js';
import { createWhatsAppRouter } from '../routes/whatsapp.js';
import { notFound } from '../middleware/notFound.js';
import { errorHandler } from '../middleware/errorHandler.js';
import { ForbiddenError, UnauthorizedError } from '../utils/errors.js';

function createMockDb() {
  const whatsappLogs = new Map([
    [
      'wa-log-1',
      {
        waMessageId: 'wamid.HBgMOTE5ODc2NTQzMjEwFQIAERgSNjM5',
        status: 'sent',
        recipientPhone: '919876543210',
        createdAt: new Date().toISOString(),
      },
    ],
  ]);
  const reminderLogs = new Map();
  const users = new Map([
    [
      'user-active-optin',
      {
        id: 'user-active-optin',
        displayName: 'Rahul Sharma',
        phone: '919876543210',
        whatsappOptIn: true,
      },
    ],
    [
      'user-opted-out',
      {
        id: 'user-opted-out',
        displayName: 'Pooja Verma',
        phone: '919876543299',
        whatsappOptIn: false,
      },
    ],
  ]);

  const makeCollection = (store) => ({
    where(field, op, val) {
      return {
        async get() {
          const matches = [];
          for (const [id, item] of store.entries()) {
            if (op === '==' && item[field] === val) {
              matches.push({ id, data: () => ({ ...item }) });
            }
          }
          return { empty: matches.length === 0, docs: matches };
        },
      };
    },
    doc(id) {
      const docId = id || `doc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      return {
        id: docId,
        async get() {
          if (!store.has(docId)) return { exists: false, data: () => null };
          return { exists: true, data: () => ({ ...store.get(docId) }) };
        },
        async set(data) {
          store.set(docId, { ...data });
        },
        async update(updates) {
          const current = store.get(docId) || {};
          store.set(docId, { ...current, ...updates });
        },
      };
    },
    async get() {
      const matches = [];
      for (const [id, item] of store.entries()) {
        matches.push({ id, data: () => ({ ...item }) });
      }
      return { empty: matches.length === 0, docs: matches };
    },
  });

  return {
    collection(name) {
      if (name === 'whatsappLogs') return makeCollection(whatsappLogs);
      if (name === 'reminderLogs') return makeCollection(reminderLogs);
      if (name === 'users') return makeCollection(users);
      throw new Error(`Unexpected collection: ${name}`);
    },
    _stores: { whatsappLogs, reminderLogs, users },
  };
}

describe('WhatsApp Cloud API Configuration & Foundation (Day 24 Task 48)', () => {
  const TEST_VERIFY_TOKEN = 'test_verify_token_12345';
  const TEST_APP_SECRET = 'test_meta_app_secret_98765';

  let server;
  let baseUrl;
  let activeUser = null;
  let mockDb;

  before(async () => {
    mockDb = createMockDb();

    const testConfigGetter = () =>
      getWhatsAppConfig({
        WHATSAPP_API_VERSION: 'v21.0',
        WHATSAPP_PHONE_NUMBER_ID: '10492837465',
        WHATSAPP_BUSINESS_ACCOUNT_ID: '20495867123',
        WHATSAPP_ACCESS_TOKEN: 'EAAG_test_secret_token_never_expose',
        WHATSAPP_APP_SECRET: TEST_APP_SECRET,
        WHATSAPP_VERIFY_TOKEN: TEST_VERIFY_TOKEN,
        WHATSAPP_MOCK_DISPATCH: 'true',
      });

    const service = createWhatsAppService({
      customDb: mockDb,
      configGetter: testConfigGetter,
    });
    const controller = createWhatsAppController(service);

    const fakeVerifyToken = (req, _res, next) => {
      if (!activeUser) {
        return next(new UnauthorizedError('Authentication required'));
      }
      req.user = { uid: activeUser.uid, email: activeUser.email };
      req.profile = {
        uid: activeUser.uid,
        role: activeUser.role,
        approvalStatus: activeUser.approvalStatus || 'active',
      };
      next();
    };

    const fakeRequireRole = (...allowedRoles) => {
      const allowed = new Set(allowedRoles);
      return (req, _res, next) => {
        if (!allowed.has(req.profile?.role)) {
          return next(new ForbiddenError(`Required role: ${allowedRoles.join(' or ')}`));
        }
        next();
      };
    };

    const fakeRequireActiveStatus = (req, _res, next) => {
      if (req.profile?.approvalStatus !== 'active') {
        return next(new ForbiddenError('Active account required'));
      }
      next();
    };

    const router = createWhatsAppRouter({
      controller,
      verifyToken: fakeVerifyToken,
      requireRole: fakeRequireRole,
      requireActiveStatus: fakeRequireActiveStatus,
    });

    const app = express();
    app.use(
      express.json({
        verify: (req, _res, buf) => {
          req.rawBody = buf;
        },
      })
    );
    app.use('/api/whatsapp', router);
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

  test('Config helpers reject placeholder credentials and never leak secrets in sanitized status', () => {
    const placeholderCfg = getWhatsAppConfig({
      WHATSAPP_PHONE_NUMBER_ID: 'your_phone_number_id',
      WHATSAPP_ACCESS_TOKEN: 'your_whatsapp_access_token',
    });
    assert.equal(isWhatsAppConfigured(placeholderCfg), false);
    assert.equal(isWhatsAppMockMode(placeholderCfg, { TEST_MODE: 'false' }), true);

    const liveCfg = getWhatsAppConfig({
      WHATSAPP_API_VERSION: 'v21.0',
      WHATSAPP_PHONE_NUMBER_ID: '1234567890',
      WHATSAPP_ACCESS_TOKEN: 'secret_live_token_abc',
      WHATSAPP_APP_SECRET: 'secret_app_xyz',
      WHATSAPP_VERIFY_TOKEN: 'verify_tok',
      WHATSAPP_MOCK_DISPATCH: 'false',
    });
    assert.equal(isWhatsAppConfigured(liveCfg), true);
    assert.equal(getGraphApiMessagesUrl(liveCfg), 'https://graph.facebook.com/v21.0/1234567890/messages');

    const safe = getSanitizedWhatsAppStatus(liveCfg, { TEST_MODE: 'false' });
    assert.equal(safe.configured, true);
    assert.equal(safe.mockMode, false);
    assert.equal(safe.hasAccessToken, true);
    assert.equal('accessToken' in safe, false);
    assert.equal('appSecret' in safe, false);
    assert.equal('verifyToken' in safe, false);
  });

  test('GET /api/whatsapp/status and /templates enforce auth and staff roles, and never expose secrets', async () => {
    activeUser = null;
    const unauthRes = await fetch(`${baseUrl}/api/whatsapp/status`);
    assert.equal(unauthRes.status, 401);

    activeUser = { uid: 'member-1', email: 'member@ironcore.fit', role: 'member' };
    const memberRes = await fetch(`${baseUrl}/api/whatsapp/templates`);
    assert.equal(memberRes.status, 403);

    activeUser = { uid: 'owner-1', email: 'owner@ironcore.fit', role: 'owner' };
    const statusRes = await fetch(`${baseUrl}/api/whatsapp/status`);
    assert.equal(statusRes.status, 200);
    const statusBody = await statusRes.json();
    assert.equal(statusBody.data.apiVersion, 'v21.0');
    assert.equal(statusBody.data.templateCount, 5);
    assert.equal(JSON.stringify(statusBody).includes('EAAG_test_secret_token_never_expose'), false);
    assert.equal(JSON.stringify(statusBody).includes(TEST_APP_SECRET), false);

    const tmplRes = await fetch(`${baseUrl}/api/whatsapp/templates`);
    assert.equal(tmplRes.status, 200);
    const tmplBody = await tmplRes.json();
    assert.equal(tmplBody.total, 5);
    assert.ok(tmplBody.data.some((t) => t.name === 'ironcore_gym_welcome'));
    assert.ok(tmplBody.data.some((t) => t.name === 'ironcore_renewal_reminder_3days'));
    assert.ok(tmplBody.data.some((t) => t.name === 'ironcore_payment_receipt'));
  });

  test('POST /api/whatsapp/templates/preview constructs valid Meta Cloud API payload and validates variables', async () => {
    activeUser = { uid: 'reception-1', email: 'reception@ironcore.fit', role: 'reception' };

    // Valid 10-digit Indian phone normalization + variable ordering
    const validRes = await fetch(`${baseUrl}/api/whatsapp/templates/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: '98765 43210',
        templateName: 'ironcore_inactive_member_checkin',
        languageCode: 'en_US',
        variables: ['Rajesh', 'IRONCORE Gym', '12'],
      }),
    });
    assert.equal(validRes.status, 200);
    const validBody = await validRes.json();
    assert.equal(validBody.data.messaging_product, 'whatsapp');
    assert.equal(validBody.data.to, '919876543210');
    assert.equal(validBody.data.type, 'template');
    assert.equal(validBody.data.template.name, 'ironcore_inactive_member_checkin');
    assert.equal(validBody.data.template.components[0].parameters.length, 3);
    assert.equal(validBody.data.template.components[0].parameters[2].text, '12');

    // Variable count mismatch returns 400
    const badVarsRes = await fetch(`${baseUrl}/api/whatsapp/templates/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: '9876543210',
        templateName: 'ironcore_renewal_reminder_3days',
        variables: ['OnlyOneVar'],
      }),
    });
    assert.equal(badVarsRes.status, 400);

    // Unknown template returns 404
    const unknownRes = await fetch(`${baseUrl}/api/whatsapp/templates/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: '9876543210',
        templateName: 'nonexistent_template',
        variables: [],
      }),
    });
    assert.equal(unknownRes.status, 404);
  });

  test('GET /api/whatsapp/webhook verifies Meta challenge token and rejects mismatches', async () => {
    const validChallengeRes = await fetch(
      `${baseUrl}/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=${TEST_VERIFY_TOKEN}&hub.challenge=challenge_998877`
    );
    assert.equal(validChallengeRes.status, 200);
    const challengeText = await validChallengeRes.text();
    assert.equal(challengeText, 'challenge_998877');

    // Wrong token -> 403
    const invalidTokenRes = await fetch(
      `${baseUrl}/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=wrong_token&hub.challenge=123`
    );
    assert.equal(invalidTokenRes.status, 403);

    // Wrong mode -> 400
    const invalidModeRes = await fetch(
      `${baseUrl}/api/whatsapp/webhook?hub.mode=unsubscribe&hub.verify_token=${TEST_VERIFY_TOKEN}&hub.challenge=123`
    );
    assert.equal(invalidModeRes.status, 400);
  });

  test('POST /api/whatsapp/webhook enforces X-Hub-Signature-256 HMAC verification and updates delivery logs', async () => {
    const webhookPayload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: '20495867123',
          changes: [
            {
              field: 'messages',
              value: {
                statuses: [
                  {
                    id: 'wamid.HBgMOTE5ODc2NTQzMjEwFQIAERgSNjM5',
                    status: 'delivered',
                    timestamp: '1795632000',
                    recipient_id: '919876543210',
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    const rawBody = JSON.stringify(webhookPayload);

    // Missing signature -> 401
    const missingSigRes = await fetch(`${baseUrl}/api/whatsapp/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: rawBody,
    });
    assert.equal(missingSigRes.status, 401);

    // Forged signature -> 403
    const forgedSigRes = await fetch(`${baseUrl}/api/whatsapp/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': 'sha256=' + '0'.repeat(64),
      },
      body: rawBody,
    });
    assert.equal(forgedSigRes.status, 403);

    // Valid HMAC-SHA256 signature -> 200 and updates whatsappLogs status
    const validHmac = crypto
      .createHmac('sha256', TEST_APP_SECRET)
      .update(rawBody)
      .digest('hex');

    const validWebhookRes = await fetch(`${baseUrl}/api/whatsapp/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': `sha256=${validHmac}`,
      },
      body: rawBody,
    });
    assert.equal(validWebhookRes.status, 200);
    const body = await validWebhookRes.json();
    assert.equal(body.data.processedStatuses, 1);
    assert.equal(body.data.updatedLogs, 1);
    assert.equal(mockDb._stores.whatsappLogs.get('wa-log-1').status, 'delivered');
  });

  test('POST /api/whatsapp/send enforces auth and role guards', async () => {
    // 1. Unauthenticated -> 401
    activeUser = null;
    const unauthRes = await fetch(`${baseUrl}/api/whatsapp/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: '919876543210',
        templateName: 'ironcore_gym_welcome',
        variables: ['Rahul Sharma', 'IRONCORE Fitness', '1 Month Starter'],
      }),
    });
    assert.equal(unauthRes.status, 401);

    // 2. Member role -> 403
    activeUser = { uid: 'mem-1', role: 'member', email: 'member@test.com' };
    const forbiddenRes = await fetch(`${baseUrl}/api/whatsapp/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: '919876543210',
        templateName: 'ironcore_gym_welcome',
        variables: ['Rahul Sharma', 'IRONCORE Fitness', '1 Month Starter'],
      }),
    });
    assert.equal(forbiddenRes.status, 403);
  });

  test('POST /api/whatsapp/send dispatches template and creates delivery log', async () => {
    activeUser = { uid: 'owner-1', role: 'owner', email: 'owner@test.com' };
    const res = await fetch(`${baseUrl}/api/whatsapp/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: '919876543210',
        templateName: 'ironcore_gym_welcome',
        languageCode: 'en_US',
        variables: ['Rahul Sharma', 'IRONCORE Fitness', '3 Months Pro'],
        memberId: 'user-active-optin',
        metadata: { membershipId: 'mem-101' },
      }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'success');
    assert.equal(body.data.success, true);
    assert.equal(body.data.status, 'sent');
    assert.ok(body.data.waMessageId.startsWith('wamid.MOCK_'));

    // Check delivery log exists in mockDb
    const logDoc = mockDb._stores.whatsappLogs.get(body.data.logId);
    assert.ok(logDoc, 'Delivery log must be persisted in whatsappLogs');
    assert.equal(logDoc.recipientPhone, '919876543210');
    assert.equal(logDoc.templateName, 'ironcore_gym_welcome');
    assert.equal(logDoc.status, 'sent');
  });

  test('POST /api/whatsapp/send respects user opt-out and does not dispatch', async () => {
    activeUser = { uid: 'reception-1', role: 'reception', email: 'reception@test.com' };
    const res = await fetch(`${baseUrl}/api/whatsapp/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: '919876543299',
        templateName: 'ironcore_renewal_reminder_3days',
        variables: ['Pooja Verma', '1 Month Starter', 'IRONCORE', '3', '2026-12-01'],
        memberId: 'user-opted-out',
      }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'opted_out');
    assert.equal(body.data.success, false);
    assert.equal(body.data.status, 'opted_out');

    // Confirm opted_out record was saved
    const logDoc = mockDb._stores.whatsappLogs.get(body.data.logId);
    assert.ok(logDoc);
    assert.equal(logDoc.status, 'opted_out');
    assert.equal(logDoc.waMessageId, null);
  });

  test('POST /api/whatsapp/send rejects invalid variables or unregistered template', async () => {
    activeUser = { uid: 'owner-1', role: 'owner', email: 'owner@test.com' };

    // Mismatched variable count
    const varRes = await fetch(`${baseUrl}/api/whatsapp/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: '919876543210',
        templateName: 'ironcore_gym_welcome',
        variables: ['OnlyOneVar'], // requires 3
      }),
    });
    assert.equal(varRes.status, 400);

    // Non-existent template
    const tmplRes = await fetch(`${baseUrl}/api/whatsapp/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: '919876543210',
        templateName: 'invalid_template_name',
        variables: [],
      }),
    });
    assert.equal(tmplRes.status, 404);
  });

  test('GET /api/whatsapp/logs returns delivery history with filtering', async () => {
    activeUser = { uid: 'owner-1', role: 'owner', email: 'owner@test.com' };
    const res = await fetch(`${baseUrl}/api/whatsapp/logs?limit=10`, {
      headers: { 'Content-Type': 'application/json' },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'success');
    assert.ok(Array.isArray(body.data));
    assert.ok(body.data.length >= 1);
  });

  test('PATCH /api/whatsapp/opt-status/:userId updates member opt preferences', async () => {
    activeUser = { uid: 'reception-1', role: 'reception', email: 'reception@test.com' };
    const res = await fetch(`${baseUrl}/api/whatsapp/opt-status/user-opted-out`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ optIn: true }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'success');
    assert.equal(body.data.whatsappOptIn, true);
    assert.equal(mockDb._stores.users.get('user-opted-out').whatsappOptIn, true);
  });

  test('Inbound webhook STOP keyword automatically flags user as opted out', async () => {
    const rawBody = JSON.stringify({
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'WABA_ENTRY_1',
          changes: [
            {
              value: {
                messaging_product: 'whatsapp',
                messages: [
                  {
                    id: 'wamid.INBOUND_MSG_STOP_1',
                    from: '919876543210',
                    type: 'text',
                    text: { body: 'STOP' },
                    timestamp: String(Math.floor(Date.now() / 1000)),
                  },
                ],
              },
            },
          ],
        },
      ],
    });

    const validHmac = crypto
      .createHmac('sha256', TEST_APP_SECRET)
      .update(rawBody)
      .digest('hex');

    const res = await fetch(`${baseUrl}/api/whatsapp/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': `sha256=${validHmac}`,
      },
      body: rawBody,
    });
    assert.equal(res.status, 200);
    assert.equal(mockDb._stores.users.get('user-active-optin').whatsappOptIn, false);
  });
});
