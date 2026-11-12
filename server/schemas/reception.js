/**
 * schemas/reception.js — Validation schemas for Reception Desk Operations
 */

import { z } from 'zod';

export const registerMemberSchema = z.object({
  displayName: z
    .string({ required_error: 'Full name is required' })
    .trim()
    .min(2, 'Full name must be at least 2 characters')
    .max(100, 'Full name cannot exceed 100 characters'),
  email: z
    .string({ required_error: 'Email address is required' })
    .trim()
    .email('Please provide a valid email address')
    .toLowerCase(),
  phone: z
    .string({ required_error: 'Phone number is required' })
    .trim()
    .regex(/^[0-9+\-\s()]{7,20}$/, 'Please provide a valid phone number (7-20 digits)'),
  password: z
    .string()
    .min(6, 'Password must be at least 6 characters')
    .optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date of birth must be in YYYY-MM-DD format')
    .optional(),
  address: z.string().trim().max(300).optional(),
  emergencyContact: z
    .object({
      name: z.string().trim().min(2, 'Emergency contact name is required'),
      phone: z.string().trim().regex(/^[0-9+\-\s()]{7,20}$/, 'Invalid emergency phone number'),
      relation: z.string().trim().optional(),
    })
    .optional(),
  assignedPlanId: z.string().trim().optional(),
  whatsappOptIn: z.boolean().default(true),
});
