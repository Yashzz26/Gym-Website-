/**
 * schemas/workout.js — Validation Schemas for Workout Plans & Exercise Logs (Day 20 Task 39)
 */

import { z } from 'zod';

export const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun', 'all'];

/**
 * Exercise item schema within a workout plan.
 */
export const exerciseItemSchema = z.object({
  name: z
    .string({ required_error: 'Exercise name is required' })
    .trim()
    .min(2, 'Exercise name must be at least 2 characters')
    .max(120, 'Exercise name cannot exceed 120 characters'),

  sets: z
    .number({ required_error: 'Number of sets is required' })
    .int('Sets must be an integer')
    .min(1, 'At least 1 set is required')
    .max(50, 'Sets cannot exceed 50'),

  reps: z
    .union([z.string().trim().min(1), z.number().int().min(1)], {
      required_error: 'Reps target is required (e.g. 10 or "8-12" or "45 sec")',
    })
    .transform((val) => String(val)),

  weightKg: z
    .number()
    .nonnegative('Weight in kg cannot be negative')
    .max(1000, 'Weight cannot exceed 1000 kg')
    .optional()
    .nullable(),

  restSeconds: z
    .number()
    .int()
    .nonnegative('Rest seconds cannot be negative')
    .max(600, 'Rest cannot exceed 600 seconds')
    .optional()
    .nullable(),

  videoUrl: z
    .string()
    .trim()
    .url('Video URL must be a valid web address')
    .optional()
    .nullable()
    .or(z.literal('')),

  notes: z
    .string()
    .trim()
    .max(500, 'Exercise notes cannot exceed 500 characters')
    .optional()
    .nullable(),
});

/**
 * Create Workout Plan Schema (Trainer / Owner).
 */
export const createWorkoutPlanSchema = z.object({
  memberId: z
    .string({ required_error: 'Member ID is required' })
    .trim()
    .min(1, 'Member ID cannot be empty'),

  weekDay: z.enum(WEEKDAYS, {
    required_error: `Weekday must be one of: ${WEEKDAYS.join(', ')}`,
  }),

  title: z
    .string({ required_error: 'Workout title is required' })
    .trim()
    .min(2, 'Workout title must be at least 2 characters')
    .max(120, 'Workout title cannot exceed 120 characters'),

  notes: z
    .string()
    .trim()
    .max(1000, 'Plan instructions cannot exceed 1000 characters')
    .optional()
    .nullable(),

  exercises: z
    .array(exerciseItemSchema, {
      required_error: 'Exercises list is required',
    })
    .min(1, 'Workout plan must have at least 1 exercise'),
});

/**
 * Update Workout Plan Schema (Trainer / Owner).
 */
export const updateWorkoutPlanSchema = z.object({
  title: z
    .string()
    .trim()
    .min(2, 'Workout title must be at least 2 characters')
    .max(120, 'Workout title cannot exceed 120 characters')
    .optional(),

  weekDay: z.enum(WEEKDAYS).optional(),

  notes: z
    .string()
    .trim()
    .max(1000, 'Plan instructions cannot exceed 1000 characters')
    .optional()
    .nullable(),

  exercises: z
    .array(exerciseItemSchema)
    .min(1, 'Workout plan must have at least 1 exercise')
    .optional(),
});

/**
 * Log Daily Exercise Completion Schema (Member / Trainer).
 */
export const workoutLogSchema = z.object({
  workoutPlanId: z
    .string()
    .trim()
    .optional()
    .nullable(),

  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be formatted as YYYY-MM-DD')
    .optional(),

  completedExercises: z
    .array(z.string().trim().min(1))
    .default([]),

  notes: z
    .string()
    .trim()
    .max(500, 'Notes cannot exceed 500 characters')
    .optional()
    .nullable(),

  durationMinutes: z
    .number()
    .int()
    .positive('Duration must be greater than 0')
    .max(600, 'Duration cannot exceed 600 minutes')
    .optional()
    .nullable(),

  perceivedExertion: z
    .number()
    .int()
    .min(1)
    .max(10)
    .optional()
    .nullable(),
});
