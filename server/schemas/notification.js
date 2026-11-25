/**
 * schemas/notification.js — Zod validation schemas for In-App Notifications (Day 24 Task 47)
 */

import { z } from 'zod';

export const NOTIFICATION_TYPES = [
  'renewal_reminder',
  'payment_confirmed',
  'workout_assigned',
  'diet_assigned',
  'inactive_alert',
  'staff_approval',
  'system_alert',
];

export const TARGET_ROLES = ['member', 'trainer', 'reception', 'owner'];

export const createNotificationSchema = z
  .object({
    userId: z.string().trim().min(1, 'Target userId cannot be empty').optional(),
    targetRole: z.enum(TARGET_ROLES).optional(),
    targetRoles: z.array(z.enum(TARGET_ROLES)).min(1).max(4).optional(),
    type: z.enum(NOTIFICATION_TYPES).default('system_alert'),
    title: z
      .string({ required_error: 'Notification title is required' })
      .trim()
      .min(2, 'Title must be at least 2 characters')
      .max(120, 'Title cannot exceed 120 characters'),
    body: z
      .string({ required_error: 'Notification body is required' })
      .trim()
      .min(2, 'Body must be at least 2 characters')
      .max(1000, 'Body cannot exceed 1000 characters'),
    link: z
      .string()
      .trim()
      .max(200, 'Action link cannot exceed 200 characters')
      .refine((val) => !val || val.startsWith('/'), {
        message: 'Action link must be an internal relative route starting with /',
      })
      .optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .refine((data) => Boolean(data.userId || data.targetRole || (data.targetRoles && data.targetRoles.length > 0)), {
    message: 'Specify either a userId or at least one target role for delivery',
    path: ['userId'],
  });

export const listNotificationsQuerySchema = z.object({
  unreadOnly: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .optional()
    .transform((v) => v === true || v === 'true'),
  type: z.enum(NOTIFICATION_TYPES).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

export const markAllReadSchema = z.object({
  notificationIds: z.array(z.string().trim().min(1)).max(100).optional(),
});
