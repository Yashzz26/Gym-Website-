/**
 * controllers/whatsappController.js — HTTP handlers for WhatsApp Cloud API Foundation (Day 24 Task 48)
 */

import { whatsappService as defaultService } from '../services/whatsappService.js';

export const createWhatsAppController = (service = defaultService) => {
  return {
    async getStatus(_req, res, next) {
      try {
        const status = service.getServiceStatus();
        res.status(200).json({
          status: 'success',
          data: status,
        });
      } catch (err) {
        next(err);
      }
    },

    async listTemplates(_req, res, next) {
      try {
        const templates = service.listTemplates();
        res.status(200).json({
          status: 'success',
          data: templates,
          total: templates.length,
        });
      } catch (err) {
        next(err);
      }
    },

    async previewTemplatePayload(req, res, next) {
      try {
        const payload = service.buildTemplatePayload(req.body);
        res.status(200).json({
          status: 'success',
          data: payload,
        });
      } catch (err) {
        next(err);
      }
    },

    async verifyWebhook(req, res, next) {
      try {
        const mode = req.query['hub.mode'];
        const token = req.query['hub.verify_token'];
        const challenge = req.query['hub.challenge'];

        const echo = service.verifyWebhookChallenge({ mode, token, challenge });
        res.status(200).type('text/plain').send(echo);
      } catch (err) {
        next(err);
      }
    },

    async handleWebhook(req, res, next) {
      try {
        const signatureHeader = req.get('X-Hub-Signature-256');
        const rawBody = req.rawBody || JSON.stringify(req.body || {});

        service.verifyWebhookSignature(rawBody, signatureHeader);

        const summary = await service.processWebhookPayload(req.body || {});
        res.status(200).json({
          status: 'success',
          data: summary,
        });
      } catch (err) {
        next(err);
      }
    },
  };
};

export const whatsappController = createWhatsAppController();
