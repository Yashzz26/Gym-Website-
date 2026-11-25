/**
 * services/whatsappService.js — WhatsApp Business Cloud API Foundation Service (Day 24 Task 48)
 *
 * Provides:
 * - Meta message template registry & validation matching docs/WHATSAPP_TEMPLATES.md
 * - E.164 phone normalization and Cloud API v21.0 payload construction
 * - Webhook GET hub challenge verification
 * - Webhook POST X-Hub-Signature-256 HMAC-SHA256 raw-body verification
 * - Webhook status update event parsing & safe log updating
 */

import crypto from 'node:crypto';
import { db as defaultDb } from '../config/firebase.js';
import {
  getWhatsAppConfig,
  getSanitizedWhatsAppStatus,
} from '../config/whatsapp.js';
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from '../utils/errors.js';

/**
 * Registry of proposed and approved Meta WhatsApp Business templates.
 * Synced with docs/WHATSAPP_TEMPLATES.md.
 */
export const WHATSAPP_TEMPLATES = Object.freeze({
  ironcore_gym_welcome: {
    name: 'ironcore_gym_welcome',
    purpose: 'Welcome onboarding confirmation sent when a new member activates their plan',
    category: 'UTILITY',
    languages: ['en_US', 'hi'],
    approvalStatus: 'PENDING_APPROVAL',
    submissionId: 'WABA-TMPL-891023-WELC',
    variables: ['memberName', 'gymName', 'planName'],
    hasUrlButton: false,
  },
  ironcore_renewal_reminder_3days: {
    name: 'ironcore_renewal_reminder_3days',
    purpose: 'Proactive expiration reminder sent 3 days prior to membership expiry',
    category: 'UTILITY',
    languages: ['en_US', 'hi'],
    approvalStatus: 'PENDING_APPROVAL',
    submissionId: 'WABA-TMPL-891024-REN3D',
    variables: ['memberName', 'planName', 'gymName', 'daysRemaining', 'expiryDate'],
    hasUrlButton: false,
  },
  ironcore_membership_expired: {
    name: 'ironcore_membership_expired',
    purpose: 'Notice dispatched on the day an active membership transitions to expired',
    category: 'UTILITY',
    languages: ['en_US', 'hi'],
    approvalStatus: 'PENDING_APPROVAL',
    submissionId: 'WABA-TMPL-891025-EXP',
    variables: ['memberName', 'planName', 'gymName', 'expiryDate'],
    hasUrlButton: false,
  },
  ironcore_payment_receipt: {
    name: 'ironcore_payment_receipt',
    purpose: 'Instant digital receipt sent upon Razorpay online capture or reception payment',
    category: 'UTILITY',
    languages: ['en_US'],
    approvalStatus: 'PENDING_APPROVAL',
    submissionId: 'WABA-TMPL-891026-RCPT',
    variables: [
      'memberName',
      'formattedAmount',
      'planName',
      'gymName',
      'receiptId',
      'startDate',
      'endDate',
      'paymentMethod',
    ],
    hasUrlButton: true,
  },
  ironcore_inactive_member_checkin: {
    name: 'ironcore_inactive_member_checkin',
    purpose: 'Retention check-in message for active members absent 7 or more consecutive days',
    category: 'UTILITY',
    languages: ['en_US', 'hi'],
    approvalStatus: 'PENDING_APPROVAL',
    submissionId: 'WABA-TMPL-891027-INACT',
    variables: ['memberName', 'gymName', 'daysAbsent'],
    hasUrlButton: false,
  },
});

function timingSafeStringEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export const createWhatsAppService = ({
  customDb = defaultDb,
  configGetter = getWhatsAppConfig,
} = {}) => {
  const getLogsCollection = () => {
    if (!customDb) throw new Error('[WhatsAppService] Firestore DB is not initialized');
    return customDb.collection('whatsappLogs');
  };

  const getReminderLogsCollection = () => {
    if (!customDb) throw new Error('[WhatsAppService] Firestore DB is not initialized');
    return customDb.collection('reminderLogs');
  };

  return {
    /**
     * Return safe diagnostic status (no credentials) plus template summary.
     */
    getServiceStatus() {
      const config = configGetter();
      const status = getSanitizedWhatsAppStatus(config);
      const templates = this.listTemplates();
      const approvedCount = templates.filter((t) => t.approvalStatus === 'APPROVED').length;

      return {
        ...status,
        templateCount: templates.length,
        approvedTemplateCount: approvedCount,
        pendingTemplateCount: templates.length - approvedCount,
      };
    },

    /**
     * List all registered Meta WhatsApp templates with purpose, variables, languages, and status.
     */
    listTemplates() {
      return Object.values(WHATSAPP_TEMPLATES).map((tmpl) => ({ ...tmpl }));
    },

    /**
     * Retrieve a single registered template definition by name.
     */
    getTemplateDefinition(templateName) {
      const template = WHATSAPP_TEMPLATES[templateName];
      if (!template) {
        throw new NotFoundError(`WhatsApp template '${templateName}' is not registered`);
      }
      return { ...template };
    },

    /**
     * Normalize a member phone number into Meta Cloud API digits-only international format.
     * Assumes Indian +91 country code when a 10-digit local mobile number is provided.
     */
    formatPhoneE164(phone) {
      if (!phone || typeof phone !== 'string') {
        throw new BadRequestError('Valid phone number is required');
      }

      const digits = phone.replace(/[^0-9]/g, '');
      const normalized = digits.length === 10 ? `91${digits}` : digits;

      if (normalized.length < 10 || normalized.length > 15) {
        throw new BadRequestError('Phone number must contain 10 to 15 digits in international format');
      }

      return normalized;
    },

    /**
     * Construct a validated Meta WhatsApp Business Cloud API template message payload.
     */
    buildTemplatePayload({
      to,
      templateName,
      languageCode = 'en_US',
      variables = [],
      buttonParams = [],
    }) {
      const template = this.getTemplateDefinition(templateName);

      if (!template.languages.includes(languageCode)) {
        throw new BadRequestError(
          `Language '${languageCode}' is not configured for template '${templateName}'. Supported: ${template.languages.join(', ')}`
        );
      }

      if (!Array.isArray(variables) || variables.length !== template.variables.length) {
        throw new BadRequestError(
          `Template '${templateName}' expects ${template.variables.length} variables (${template.variables.join(', ')}), received ${Array.isArray(variables) ? variables.length : 0}`
        );
      }

      const formattedTo = this.formatPhoneE164(to);

      const components = [];
      if (variables.length > 0) {
        components.push({
          type: 'body',
          parameters: variables.map((val) => ({
            type: 'text',
            text: String(val),
          })),
        });
      }

      if (template.hasUrlButton && Array.isArray(buttonParams) && buttonParams.length > 0) {
        components.push({
          type: 'button',
          sub_type: 'url',
          index: '0',
          parameters: buttonParams.map((val) => ({
            type: 'text',
            text: String(val),
          })),
        });
      }

      return {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: formattedTo,
        type: 'template',
        template: {
          name: template.name,
          language: {
            code: languageCode,
          },
          components,
        },
        _meta: {
          approvalStatus: template.approvalStatus,
          purpose: template.purpose,
        },
      };
    },

    /**
     * Verify Meta Webhook GET challenge subscription request.
     *
     * @param {Object} params - { mode, token, challenge } from req.query['hub.*']
     * @returns {string} Challenge echo string if valid
     */
    verifyWebhookChallenge({ mode, token, challenge }) {
      const config = configGetter();

      if (mode !== 'subscribe') {
        throw new BadRequestError("Invalid webhook hub.mode; expected 'subscribe'");
      }

      if (!config.verifyToken) {
        throw new ForbiddenError('WhatsApp webhook verification token is not configured on the server');
      }

      if (!token || !timingSafeStringEqual(String(token), config.verifyToken)) {
        throw new ForbiddenError('Invalid webhook verify token');
      }

      return String(challenge || '');
    },

    /**
     * Verify Meta Webhook POST X-Hub-Signature-256 HMAC-SHA256 signature against raw body.
     *
     * @param {Buffer|string} rawBody - Exact raw request bytes
     * @param {string} signatureHeader - Header value formatted as "sha256=<hex>"
     */
    verifyWebhookSignature(rawBody, signatureHeader) {
      const config = configGetter();

      if (!config.appSecret) {
        throw new UnauthorizedError('WhatsApp app secret is not configured for webhook verification');
      }

      if (!signatureHeader || typeof signatureHeader !== 'string' || !signatureHeader.startsWith('sha256=')) {
        throw new UnauthorizedError('Missing or malformed X-Hub-Signature-256 header');
      }

      if (!rawBody) {
        throw new BadRequestError('Raw request body is required for webhook signature verification');
      }

      const providedHex = signatureHeader.slice('sha256='.length).trim();
      const expectedHex = crypto
        .createHmac('sha256', config.appSecret)
        .update(rawBody)
        .digest('hex');

      if (!timingSafeStringEqual(providedHex, expectedHex)) {
        throw new ForbiddenError('Invalid X-Hub-Signature-256 webhook signature');
      }

      return true;
    },

    /**
     * Extract delivery status updates and inbound message objects from Meta webhook payload.
     */
    parseWebhookEvents(payload = {}) {
      const statuses = [];
      const messages = [];

      const entries = Array.isArray(payload.entry) ? payload.entry : [];
      for (const entry of entries) {
        const changes = Array.isArray(entry.changes) ? entry.changes : [];
        for (const change of changes) {
          const value = change?.value || {};

          if (Array.isArray(value.statuses)) {
            for (const s of value.statuses) {
              statuses.push({
                waMessageId: s.id || null,
                status: s.status || 'unknown',
                recipientId: s.recipient_id || null,
                timestamp: s.timestamp ? new Date(Number(s.timestamp) * 1000).toISOString() : new Date().toISOString(),
                errors: Array.isArray(s.errors) ? s.errors : [],
              });
            }
          }

          if (Array.isArray(value.messages)) {
            for (const m of value.messages) {
              messages.push({
                waMessageId: m.id || null,
                from: m.from || null,
                type: m.type || 'text',
                text: m.text?.body || m.button?.text || null,
                timestamp: m.timestamp ? new Date(Number(m.timestamp) * 1000).toISOString() : new Date().toISOString(),
              });
            }
          }
        }
      }

      return { statuses, messages };
    },

    /**
     * Process parsed webhook status updates against whatsappLogs / reminderLogs.
     */
    async processWebhookPayload(payload) {
      const { statuses, messages } = this.parseWebhookEvents(payload);
      let updatedLogs = 0;

      for (const statusItem of statuses) {
        if (!statusItem.waMessageId) continue;

        for (const colGetter of [getLogsCollection, getReminderLogsCollection]) {
          try {
            const snap = await colGetter().where('waMessageId', '==', statusItem.waMessageId).get();
            if (!snap.empty) {
              for (const doc of snap.docs) {
                await colGetter().doc(doc.id).update({
                  status: statusItem.status,
                  deliveryUpdatedAt: statusItem.timestamp,
                  webhookErrors: statusItem.errors,
                  updatedAt: new Date().toISOString(),
                });
                updatedLogs += 1;
              }
            }
          } catch {
            // Resilient log collection lookup in case collection doesn't exist yet
          }
        }
      }

      return {
        processedStatuses: statuses.length,
        receivedMessages: messages.length,
        updatedLogs,
        statuses,
        messages,
      };
    },
  };
};

export const whatsappService = createWhatsAppService();
