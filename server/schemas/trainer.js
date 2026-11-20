/**
 * schemas/trainer.js — Validation Schemas for Trainer Assignment & Member Workouts (Day 19 Task 37)
 */

import { z } from 'zod';

/** Allowed standard fitness goals */
export const FITNESS_GOALS = [
  'Fat Loss',
  'Muscle Gain',
  'General Fitness',
  'Endurance',
  'Strength Training',
  'Flexibility & Mobility',
];

/**
 * Schema for assigning a member to a trainer (Owner or Reception).
 */
export const assignMemberSchema = z.object({
  trainerId: z
    .string({ required_error: 'Trainer ID is required' })
    .trim()
    .min(1, 'Trainer ID cannot be empty'),

  memberId: z
    .string({ required_error: 'Member ID is required' })
    .trim()
    .min(1, 'Member ID cannot be empty'),

  fitnessGoal: z
    .string()
    .trim()
    .min(2, 'Fitness goal must be at least 2 characters')
    .max(100, 'Fitness goal cannot exceed 100 characters')
    .optional()
    .default('General Fitness'),

  notes: z
    .string()
    .trim()
    .max(500, 'Notes cannot exceed 500 characters')
    .optional(),

  targetWeightKg: z
    .number()
    .positive('Target weight must be greater than 0')
    .max(300, 'Target weight cannot exceed 300 kg')
    .optional(),

  currentWeightKg: z
    .number()
    .positive('Current weight must be greater than 0')
    .max(300, 'Current weight cannot exceed 300 kg')
    .optional(),
});

/**
 * Schema for unassigning a member from a trainer (Owner or Reception).
 */
export const unassignMemberSchema = z.object({
  memberId: z
    .string({ required_error: 'Member ID is required' })
    .trim()
    .min(1, 'Member ID cannot be empty'),

  trainerId: z
    .string()
    .trim()
    .optional(),

  reason: z
    .string()
    .trim()
    .max(500, 'Reason cannot exceed 500 characters')
    .optional(),
});

/**
 * Schema for trainer updating member fitness progress/goal.
 */
export const updateMemberProgressSchema = z.object({
  fitnessGoal: z
    .string()
    .trim()
    .min(2, 'Fitness goal must be at least 2 characters')
    .max(100, 'Fitness goal cannot exceed 100 characters')
    .optional(),

  currentWeightKg: z
    .number()
    .positive('Current weight must be greater than 0')
    .max(300, 'Current weight cannot exceed 300 kg')
    .optional(),

  targetWeightKg: z
    .number()
    .positive('Target weight must be greater than 0')
    .max(300, 'Target weight cannot exceed 300 kg')
    .optional(),

  notes: z
    .string()
    .trim()
    .max(1000, 'Notes cannot exceed 1000 characters')
    .optional(),
});
