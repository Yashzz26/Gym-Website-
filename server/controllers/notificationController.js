/**
 * controllers/notificationController.js — HTTP handlers for In-App Notifications (Day 24 Task 47)
 */

import { notificationService as defaultService } from '../services/notificationService.js';

export const createNotificationController = (service = defaultService) => {
  return {
    async listNotifications(req, res, next) {
      try {
        const userId = req.user?.uid;
        const { unreadOnly, type, limit } = req.query;

        const result = await service.listUserNotifications(userId, {
          unreadOnly: unreadOnly === true || unreadOnly === 'true',
          type,
          limit,
        });

        res.status(200).json({
          status: 'success',
          data: result.notifications,
          total: result.total,
          unreadCount: result.unreadCount,
        });
      } catch (err) {
        next(err);
      }
    },

    async createNotification(req, res, next) {
      try {
        const senderContext = {
          uid: req.user?.uid,
          role: req.profile?.role,
        };

        if (req.body.userId) {
          const created = await service.createNotification(req.body, senderContext);
          return res.status(201).json({
            status: 'success',
            message: 'Notification created successfully',
            data: created,
          });
        }

        const delivered = await service.deliverToRoles(req.body, senderContext);
        res.status(201).json({
          status: 'success',
          message: `Delivered notification to ${delivered.deliveredCount} recipient(s)`,
          data: delivered,
        });
      } catch (err) {
        next(err);
      }
    },

    async markAsRead(req, res, next) {
      try {
        const notificationId = req.params.id;
        const userId = req.user?.uid;

        const updated = await service.markNotificationAsRead(notificationId, userId);

        res.status(200).json({
          status: 'success',
          message: 'Notification marked as read',
          data: updated,
        });
      } catch (err) {
        next(err);
      }
    },

    async markAllAsRead(req, res, next) {
      try {
        const userId = req.user?.uid;
        const notificationIds = req.body?.notificationIds || null;

        const result = await service.markAllNotificationsAsRead(userId, notificationIds);

        res.status(200).json({
          status: 'success',
          message: `Marked ${result.updatedCount} notification(s) as read`,
          data: result,
        });
      } catch (err) {
        next(err);
      }
    },
  };
};

export const notificationController = createNotificationController();
