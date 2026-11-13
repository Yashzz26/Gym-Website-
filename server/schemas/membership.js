/**
 * schemas/membership.js — Validation schemas for Membership Lifecycle & Renewals
 */

import { z } from 'zod';

export const createMembershipSchema = z.object({
  userId: z
    .string({ required_error: 'User ID is required' })
    .trim()
    .min(1, 'User ID cannot be empty'),
  planId: z
    .string({ required_error: 'Plan ID is required' })
    .trim()
    .min(1, 'Plan ID cannot be empty'),
  startDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?)?$/, 'Invalid start date format (YYYY-MM-DD or ISO)')
    .optional(),
  paymentMethod: z
    .enum(['cash', 'upi', 'card', 'bank_transfer', 'online'])
    .default('cash'),
  paymentStatus: z
    .enum(['paid', 'pending'])
    .default('paid'),
  notes: z.string().trim().max(500).optional(),
});

export const renewMembershipSchema = z.object({
  planId: z.string().trim().min(1).optional(),
  paymentMethod: z
    .enum(['cash', 'upi', 'card', 'bank_transfer', 'online'])
    .default('cash'),
  paymentStatus: z
    .enum(['paid', 'pending'])
    .default('paid'),
  notes: z.string().trim().max(500).optional(),
});
