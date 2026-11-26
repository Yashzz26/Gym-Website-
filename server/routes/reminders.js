/**
 * routes/reminders.js — Express Router for Automated Reminder Jobs (Day 25 Task 50)
 */

import { Router } from 'express';
import { verifyToken as defaultVerifyToken } from '../middleware/auth.js';
import {
  requireRole as defaultRequireRole,
  requireActiveStatus as defaultRequireActiveStatus,
} from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';
import {
  runRenewalReminderSchema,
  runInactiveReminderSchema,
  runAllRemindersSchema,
  reminderLogsQuerySchema,
} from '../schemas/reminder.js';
import { reminderController as defaultController } from '../controllers/reminderController.js';

export const createRemindersRouter = ({
  controller = defaultController,
  verifyToken = defaultVerifyToken,
  requireRole = defaultRequireRole,
  requireActiveStatus = defaultRequireActiveStatus,
} = {}) => {
  const router = Router();
  const allowStaff = requireRole('owner', 'reception');

  // Trigger 3-day renewal reminder automation job
  router.post(
    '/run-renewal',
    verifyToken,
    allowStaff,
    requireActiveStatus,
    validate({ body: runRenewalReminderSchema }),
    controller.runRenewalReminders
  );

  // Trigger inactive member retention follow-up job
  router.post(
    '/run-inactive',
    verifyToken,
    allowStaff,
    requireActiveStatus,
    validate({ body: runInactiveReminderSchema }),
    controller.runInactiveReminders
  );

  // Trigger all daily reminder jobs
  router.post(
    '/run-all',
    verifyToken,
    allowStaff,
    requireActiveStatus,
    validate({ body: runAllRemindersSchema }),
    controller.runAllReminders
  );

  // Query reminder execution logs
  router.get(
    '/logs',
    verifyToken,
    allowStaff,
    requireActiveStatus,
    validate({ query: reminderLogsQuerySchema }),
    controller.getReminderLogs
  );

  return router;
};

export const remindersRouter = createRemindersRouter();
export default remindersRouter;
