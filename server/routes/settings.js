/**
 * routes/settings.js — Gym Profile & Operating Settings Router
 */

import { Router } from 'express';
import { verifyToken as defaultVerifyToken } from '../middleware/auth.js';
import {
  requireOwner as defaultRequireOwner,
  requireActiveStatus as defaultRequireActiveStatus,
} from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';
import { updateGymSettingsSchema } from '../schemas/gymSettings.js';
import { gymSettingsController as defaultController } from '../controllers/gymSettingsController.js';

export const createSettingsRouter = ({
  controller = defaultController,
  verifyToken = defaultVerifyToken,
  requireOwner = defaultRequireOwner,
  requireActiveStatus = defaultRequireActiveStatus,
} = {}) => {
  const router = Router();

  // 1. Read gym settings (available to authenticated users)
  router.get('/', verifyToken, controller.getSettings);

  // 2. Update gym settings (owner-only + active status required)
  router.put(
    '/',
    verifyToken,
    requireOwner,
    requireActiveStatus,
    validate({ body: updateGymSettingsSchema }),
    controller.updateSettings
  );

  router.patch(
    '/',
    verifyToken,
    requireOwner,
    requireActiveStatus,
    validate({ body: updateGymSettingsSchema }),
    controller.updateSettings
  );

  return router;
};

export default createSettingsRouter();
