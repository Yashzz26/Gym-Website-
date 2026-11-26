/**
 * schemas/whatsapp.js — Validation schemas for WhatsApp Cloud API Foundation (Day 24 Task 48)
 */

import { z } from 'zod';

export const previewTemplateSchema = z.object({
  to: z
    .string({ required_error: 'Recipient phone number is required' })
    .trim()
    .min(7, 'Phone number is too short')
    .max(25, 'Phone number is too long'),
  templateName: z
    .string({ required_error: 'Template name is required' })
    .trim()
    .min(1, 'Template name cannot be empty'),
  languageCode: z.enum(['en_US', 'hi']).default('en_US'),
  variables: z.array(z.union([z.string(), z.number()]).transform((v) => String(v))).default([]),
  buttonParams: z.array(z.string()).default([]),
});

export const sendTemplateSchema = z.object({
  to: z
    .string({ required_error: 'Recipient phone number is required' })
    .trim()
    .min(7, 'Phone number must be at least 7 digits')
    .max(25, 'Phone number cannot exceed 25 characters'),
  templateName: z
    .string({ required_error: 'Template name is required' })
    .trim()
    .min(1, 'Template name cannot be empty'),
  languageCode: z.enum(['en_US', 'hi']).default('en_US'),
  variables: z.array(z.union([z.string(), z.number()]).transform((v) => String(v))).default([]),
  buttonParams: z.array(z.string()).default([]),
  memberId: z.string().trim().optional(),
  triggerType: z.enum(['manual', 'automated_job', 'transactional']).default('manual'),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const deliveryLogsQuerySchema = z.object({
  recipientPhone: z.string().trim().optional(),
  templateName: z.string().trim().optional(),
  status: z.string().trim().optional(),
  memberId: z.string().trim().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
});

export const updateOptStatusSchema = z.object({
  optIn: z.boolean({ required_error: 'optIn boolean value is required' }),
});
