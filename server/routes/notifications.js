/**
 * routes/notifications.js — In-App Notification Routes (Day 24 Task 47)
 */

import { Router } from 'express';
import { verifyToken as defaultVerifyToken } from '../middleware/auth.js';
import {
  requireRole as defaultRequireRole,
  requireActiveStatus as defaultRequireActiveStatus,
} from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';
import {
  createNotificationSchema,
  listNotificationsQuerySchema,
  markAllReadSchema,
} from '../schemas/notification.js';
import { notificationController as defaultController } from '../controllers/notificationController.js';

export const createNotificationsRouter = ({
  controller = defaultController,
  verifyToken = defaultVerifyToken,
  requireRole = defaultRequireRole,
  requireActiveStatus = defaultRequireActiveStatus,
} = {}) => {
  const router = Router();
  const allowStaffDispatch = requireRole('owner', 'reception', 'trainer');

  // List authenticated user's own notifications
  router.get(
    '/',
    verifyToken,
    requireActiveStatus,
    validate({ query: listNotificationsQuerySchema }),
    controller.listNotifications
  );

  // Mark all (or selected) unread notifications as read — must precede /:id/read
  router.patch(
    '/read-all',
    verifyToken,
    requireActiveStatus,
    validate({ body: markAllReadSchema }),
    controller.markAllAsRead
  );

  // Mark a single notification as read (owner-of-record check enforced in service)
  router.patch(
    '/:id/read',
    verifyToken,
    requireActiveStatus,
    controller.markAsRead
  );

  // Dispatch a notification to a user or role(s) (Staff/Owner only, role-appropriate rules enforced)
  router.post(
    '/',
    verifyToken,
    allowStaffDispatch,
    requireActiveStatus,
    validate({ body: createNotificationSchema }),
    controller.createNotification
  );

  return router;
};

export const notificationsRouter = createNotificationsRouter();
export default notificationsRouter;
