/**
 * schemas/member.js — Validation schemas for Member Operations & Online Joining
 */

import { z } from 'zod';

export const selectPlanSchema = z.object({
  planId: z
    .string({ required_error: 'Plan selection is required' })
    .trim()
    .min(1, 'Please select a membership plan'),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9+\-\s()]{7,20}$/, 'Invalid phone number format')
    .optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date of birth must be in YYYY-MM-DD format')
    .optional(),
  address: z.string().trim().max(300).optional(),
  emergencyContact: z
    .object({
      name: z.string().trim().min(2, 'Emergency contact name required'),
      phone: z.string().trim().regex(/^[0-9+\-\s()]{7,20}$/, 'Invalid emergency phone number'),
      relation: z.string().trim().optional(),
    })
    .optional(),
});
