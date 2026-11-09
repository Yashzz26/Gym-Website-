/**
 * schemas/user.js — Zod Validation Schemas for User Profiles
 */

import { z } from 'zod';

export const USER_ROLES = ['member', 'trainer', 'reception', 'owner'];
export const USER_STATUSES = ['active', 'pending', 'suspended'];

/**
 * Schema for initial user profile creation
 */
export const createUserProfileSchema = z.object({
  displayName: z
    .string({ required_error: 'Display name is required' })
    .trim()
    .min(2, 'Display name must be at least 2 characters')
    .max(100, 'Display name cannot exceed 100 characters'),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9+\-\s()]{7,20}$/, 'Invalid phone number format')
    .optional()
    .nullable(),
  role: z
    .enum(['member', 'trainer', 'reception', 'owner'], {
      invalid_type_error: 'Invalid role specified',
    })
    .default('member'),
  whatsappOptIn: z.boolean().default(false),
  profilePhotoUrl: z
    .string()
    .url('Invalid photo URL')
    .optional()
    .nullable(),
});

/**
 * Schema for updating user profile (self-service)
 */
export const updateProfileSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(2, 'Display name must be at least 2 characters')
    .max(100, 'Display name cannot exceed 100 characters')
    .optional(),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9+\-\s()]{7,20}$/, 'Invalid phone number format')
    .optional()
    .nullable(),
  whatsappOptIn: z.boolean().optional(),
  profilePhotoUrl: z
    .string()
    .url('Invalid photo URL')
    .optional()
    .nullable(),
  bio: z
    .string()
    .trim()
    .max(500, 'Bio cannot exceed 500 characters')
    .optional()
    .nullable(),
  emergencyContact: z
    .object({
      name: z.string().trim().max(100).optional(),
      phone: z.string().trim().regex(/^[0-9+\-\s()]{7,20}$/).optional(),
      relationship: z.string().trim().max(50).optional(),
    })
    .optional()
    .nullable(),
});
