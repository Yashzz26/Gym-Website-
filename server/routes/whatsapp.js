/**
 * routes/whatsapp.js — WhatsApp Business Cloud API Foundation Routes (Day 24 Task 48)
 */

import { Router } from 'express';
import { verifyToken as defaultVerifyToken } from '../middleware/auth.js';
import {
  requireRole as defaultRequireRole,
  requireActiveStatus as defaultRequireActiveStatus,
} from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';
import { previewTemplateSchema } from '../schemas/whatsapp.js';
import { whatsappController as defaultController } from '../controllers/whatsappController.js';

export const createWhatsAppRouter = ({
  controller = defaultController,
  verifyToken = defaultVerifyToken,
  requireRole = defaultRequireRole,
  requireActiveStatus = defaultRequireActiveStatus,
} = {}) => {
  const router = Router();
  const allowStaff = requireRole('owner', 'reception');

  // Protected configuration & template endpoints (Owner / Active Reception)
  router.get('/status', verifyToken, allowStaff, requireActiveStatus, controller.getStatus);
  router.get('/templates', verifyToken, allowStaff, requireActiveStatus, controller.listTemplates);
  router.post(
    '/templates/preview',
    verifyToken,
    allowStaff,
    requireActiveStatus,
    validate({ body: previewTemplateSchema }),
    controller.previewTemplatePayload
  );

  // Public Meta Webhook endpoints (Challenge verification + HMAC-SHA256 verified callbacks)
  router.get('/webhook', controller.verifyWebhook);
  router.post('/webhook', controller.handleWebhook);

  return router;
};

export const whatsappRouter = createWhatsAppRouter();
export default whatsappRouter;
