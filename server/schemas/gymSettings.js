import { z } from 'zod';

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const gymSettingsSchema = z.object({
  gymName: z.string().trim().min(2, 'Gym name must be at least 2 characters').max(100),
  logoUrl: z.string().url('Invalid logo URL').optional().or(z.literal('')),
  address: z.string().trim().min(5, 'Address must be at least 5 characters').max(300),
  phone: z.string().trim().min(7, 'Phone number must be at least 7 digits').max(20),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  gstin: z
    .string()
    .trim()
    .regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, 'Invalid GSTIN format')
    .optional()
    .or(z.literal('')),
  upiId: z
    .string()
    .trim()
    .regex(/^[\w.-]+@[\w.-]+$/, 'Invalid UPI ID format (e.g. gym@upi)')
    .optional()
    .or(z.literal('')),
  timezone: z.string().default('Asia/Kolkata'),
  operatingHours: z.object({
    openingTime: z.string().regex(timeRegex, 'Opening time must be HH:mm (e.g. 05:30)'),
    closingTime: z.string().regex(timeRegex, 'Closing time must be HH:mm (e.g. 22:30)'),
  }),
  morningSession: z.object({
    startTime: z.string().regex(timeRegex, 'Morning start time must be HH:mm (e.g. 06:00)'),
    endTime: z.string().regex(timeRegex, 'Morning end time must be HH:mm (e.g. 12:00)'),
  }),
  eveningSession: z.object({
    startTime: z.string().regex(timeRegex, 'Evening start time must be HH:mm (e.g. 16:00)'),
    endTime: z.string().regex(timeRegex, 'Evening end time must be HH:mm (e.g. 22:00)'),
  }),
  qrRefreshIntervalSeconds: z.number().int().min(60).max(3600).default(300),
});

export const updateGymSettingsSchema = gymSettingsSchema;

