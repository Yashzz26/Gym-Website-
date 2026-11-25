/**
 * services/notificationService.js — In-App Notification Lifecycle & Role-Based Delivery (Day 24 Task 47)
 */

import { db as defaultDb } from '../config/firebase.js';
import { NOTIFICATION_TYPES } from '../schemas/notification.js';
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from '../utils/errors.js';

/**
 * Defines which notification types each sender role is permitted to dispatch.
 */
export const SENDER_ALLOWED_TYPES = Object.freeze({
  owner: new Set(NOTIFICATION_TYPES),
  reception: new Set(['renewal_reminder', 'payment_confirmed', 'inactive_alert', 'system_alert']),
  trainer: new Set(['workout_assigned', 'diet_assigned', 'system_alert']),
  member: new Set([]),
  system: new Set(NOTIFICATION_TYPES),
});

/**
 * Defines appropriate recipient roles for each notification category.
 */
export const TYPE_APPROPRIATE_ROLES = Object.freeze({
  renewal_reminder: new Set(['member', 'reception', 'owner']),
  payment_confirmed: new Set(['member', 'reception', 'owner']),
  workout_assigned: new Set(['member']),
  diet_assigned: new Set(['member']),
  inactive_alert: new Set(['member', 'reception', 'owner']),
  staff_approval: new Set(['owner']),
  system_alert: new Set(['member', 'trainer', 'reception', 'owner']),
});

export const createNotificationService = (customDb = defaultDb) => {
  const getNotificationsCollection = () => {
    if (!customDb) throw new Error('[NotificationService] Firestore DB is not initialized');
    return customDb.collection('notifications');
  };

  const getUsersCollection = () => {
    if (!customDb) throw new Error('[NotificationService] Firestore DB is not initialized');
    return customDb.collection('users');
  };

  const assertDeliveryPermissions = (senderRole, type, recipientRole) => {
    const effectiveSender = senderRole || 'system';
    const allowedSenderTypes = SENDER_ALLOWED_TYPES[effectiveSender];

    if (!allowedSenderTypes || !allowedSenderTypes.has(type)) {
      throw new ForbiddenError(
        `Role '${effectiveSender}' is not authorized to send '${type}' notifications`
      );
    }

    const appropriateTargets = TYPE_APPROPRIATE_ROLES[type];
    if (recipientRole && appropriateTargets && !appropriateTargets.has(recipientRole)) {
      throw new ForbiddenError(
        `Notification type '${type}' is not appropriate for target role '${recipientRole}'`
      );
    }
  };

  const buildNotificationRecord = ({
    userId,
    targetRole,
    type = 'system_alert',
    title,
    body,
    link = null,
    metadata = {},
    createdBy = 'system',
    now = new Date().toISOString(),
  }) => ({
    userId,
    targetRole: targetRole || null,
    type,
    title: title.trim(),
    body: body.trim(),
    link: link || null,
    metadata: metadata || {},
    isRead: false,
    readAt: null,
    createdBy,
    createdAt: now,
    updatedAt: now,
  });

  return {
    /**
     * Create and store a single notification for a specific user, validating
     * target existence, account status, and role-appropriate delivery rules.
     */
    async createNotification(payload, senderContext = { uid: 'system', role: 'system' }) {
      const { userId, type = 'system_alert', title, body, link, metadata } = payload;

      if (!userId) {
        throw new BadRequestError('Recipient userId is required');
      }

      const userDoc = await getUsersCollection().doc(userId).get();
      if (!userDoc.exists) {
        throw new NotFoundError(`Recipient user '${userId}' not found`);
      }

      const recipient = userDoc.data();
      const recipientRole = recipient.role || 'member';
      const recipientStatus = recipient.approvalStatus || recipient.status || 'active';

      if (recipientStatus !== 'active') {
        throw new BadRequestError(
          `Cannot deliver notification to user with '${recipientStatus}' account status`
        );
      }

      assertDeliveryPermissions(senderContext?.role, type, recipientRole);

      const now = new Date().toISOString();
      const record = buildNotificationRecord({
        userId,
        targetRole: recipientRole,
        type,
        title,
        body,
        link,
        metadata,
        createdBy: senderContext?.uid || 'system',
        now,
      });

      const docRef = await getNotificationsCollection().add(record);
      return {
        notificationId: docRef.id,
        ...record,
      };
    },

    /**
     * Deliver a notification to all active users matching one or more target roles.
     * Enforces role-appropriate notification delivery and skips pending/suspended accounts.
     */
    async deliverToRoles(payload, senderContext = { uid: 'system', role: 'system' }) {
      const { targetRole, targetRoles, type = 'system_alert', title, body, link, metadata } = payload;
      const rolesList = [
        ...new Set([
          ...(Array.isArray(targetRoles) ? targetRoles : []),
          ...(targetRole ? [targetRole] : []),
        ]),
      ];

      if (rolesList.length === 0) {
        throw new BadRequestError('At least one target role is required');
      }

      for (const role of rolesList) {
        assertDeliveryPermissions(senderContext?.role, type, role);
      }

      // Collect unique active users across requested roles
      const recipientMap = new Map();
      for (const role of rolesList) {
        const snapshot = await getUsersCollection().where('role', '==', role).get();
        snapshot.forEach((doc) => {
          const userData = doc.data();
          const status = userData.approvalStatus || userData.status || 'active';
          if (status === 'active' && !recipientMap.has(doc.id)) {
            recipientMap.set(doc.id, { uid: doc.id, role: userData.role || role });
          }
        });
      }

      const now = new Date().toISOString();
      const delivered = [];

      for (const recipient of recipientMap.values()) {
        const record = buildNotificationRecord({
          userId: recipient.uid,
          targetRole: recipient.role,
          type,
          title,
          body,
          link,
          metadata,
          createdBy: senderContext?.uid || 'system',
          now,
        });

        const docRef = await getNotificationsCollection().add(record);
        delivered.push({
          notificationId: docRef.id,
          ...record,
        });
      }

      return {
        deliveredCount: delivered.length,
        recipientIds: delivered.map((n) => n.userId),
        targetRoles: rolesList,
        notifications: delivered,
      };
    },

    /**
     * List notifications belonging to a specific user, sorted newest first.
     */
    async listUserNotifications(userId, { unreadOnly = false, type, limit = 30 } = {}) {
      if (!userId) {
        throw new BadRequestError('User ID is required');
      }

      const snapshot = await getNotificationsCollection().where('userId', '==', userId).get();
      const allRecords = [];
      let unreadCount = 0;

      snapshot.forEach((doc) => {
        const data = doc.data();
        const item = { notificationId: doc.id, ...data };
        if (!item.isRead) {
          unreadCount += 1;
        }
        allRecords.push(item);
      });

      // Sort newest first by createdAt
      allRecords.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

      let filtered = allRecords;
      if (unreadOnly) {
        filtered = filtered.filter((item) => !item.isRead);
      }
      if (type) {
        filtered = filtered.filter((item) => item.type === type);
      }

      const maxLimit = Number(limit) > 0 ? Math.min(Number(limit), 100) : 30;
      const notifications = filtered.slice(0, maxLimit);

      return {
        notifications,
        total: filtered.length,
        unreadCount,
      };
    },

    /**
     * Mark a single notification as read for its owning user.
     */
    async markNotificationAsRead(notificationId, requestingUserId) {
      if (!notificationId) {
        throw new BadRequestError('Notification ID is required');
      }

      const docRef = getNotificationsCollection().doc(notificationId);
      const doc = await docRef.get();

      if (!doc.exists) {
        throw new NotFoundError(`Notification '${notificationId}' not found`);
      }

      const data = doc.data();
      if (data.userId !== requestingUserId) {
        throw new ForbiddenError('You can only mark your own notifications as read');
      }

      // Idempotent behavior if already marked read
      if (data.isRead) {
        return {
          notificationId: doc.id,
          ...data,
        };
      }

      const now = new Date().toISOString();
      const updates = {
        isRead: true,
        readAt: now,
        updatedAt: now,
      };

      await docRef.update(updates);

      return {
        notificationId: doc.id,
        ...data,
        ...updates,
      };
    },

    /**
     * Mark all unread notifications (or a specific subset) for a user as read.
     */
    async markAllNotificationsAsRead(requestingUserId, notificationIds = null) {
      if (!requestingUserId) {
        throw new BadRequestError('User ID is required');
      }

      const snapshot = await getNotificationsCollection()
        .where('userId', '==', requestingUserId)
        .get();

      const idFilterSet = Array.isArray(notificationIds) && notificationIds.length > 0
        ? new Set(notificationIds)
        : null;

      const now = new Date().toISOString();
      let updatedCount = 0;

      for (const doc of snapshot.docs) {
        const data = doc.data();
        if (data.isRead) continue;
        if (idFilterSet && !idFilterSet.has(doc.id)) continue;

        await getNotificationsCollection().doc(doc.id).update({
          isRead: true,
          readAt: now,
          updatedAt: now,
        });
        updatedCount += 1;
      }

      return {
        updatedCount,
        readAt: updatedCount > 0 ? now : null,
      };
    },
  };
};

export const notificationService = createNotificationService();
