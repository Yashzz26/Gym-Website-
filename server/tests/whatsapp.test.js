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
        recipientId: '919876543210',
      },
    ],
  ]);
  const reminderLogs = new Map();

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
      return {
        id,
        async update(updates) {
          store.set(id, { ...store.get(id), ...updates });
        },
      };
    },
  });

  return {
    collection(name) {
      if (name === 'whatsappLogs') return makeCollection(whatsappLogs);
      if (name === 'reminderLogs') return makeCollection(reminderLogs);
      throw new Error(`Unexpected collection: ${name}`);
    },
    _stores: { whatsappLogs, reminderLogs },
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
});
