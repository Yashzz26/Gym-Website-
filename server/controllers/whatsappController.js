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

    async sendMessage(req, res, next) {
      try {
        const actorId = req.user?.uid || null;
        const result = await service.sendTemplateMessage({
          ...req.body,
          actorId,
        });

        const statusCode = result.success ? 200 : result.status === 'opted_out' ? 200 : 400;
        res.status(statusCode).json({
          status: result.success ? 'success' : result.status === 'opted_out' ? 'opted_out' : 'fail',
          data: result,
        });
      } catch (err) {
        next(err);
      }
    },

    async getDeliveryLogs(req, res, next) {
      try {
        const logs = await service.getDeliveryLogs(req.query || {});
        res.status(200).json({
          status: 'success',
          results: logs.length,
          data: logs,
        });
      } catch (err) {
        next(err);
      }
    },

    async updateOptStatus(req, res, next) {
      try {
        const { userId } = req.params;
        const { optIn } = req.body;
        const result = await service.updateMemberOptStatus(userId, optIn);
        res.status(200).json({
          status: 'success',
          data: result,
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
