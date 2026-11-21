/**
 * services/workoutService.js — Workout Plans & Exercise Progress Operations (Day 20 Task 39)
 *
 * Implements business logic for:
 * - Creating, updating, deleting workout routines by trainers/owners
 * - Enforcing trainer access only to assigned members
 * - Retrieving personalized workout plans by weekday
 * - Persisting daily exercise completion logs and progress
 */

import { db as defaultDb } from '../config/firebase.js';
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from '../utils/errors.js';

export const createWorkoutService = (customDb = defaultDb) => {
  const getCollection = (name) => {
    if (!customDb) throw new Error(`[WorkoutService] Firestore DB is not initialized for ${name}`);
    return customDb.collection(name);
  };

  /**
   * Helper to verify if trainer is assigned to a member.
   */
  async function verifyTrainerAssignment(trainerId, memberId) {
    const assignmentsCol = getCollection('trainerAssignments');
    const snap = await assignmentsCol
      .where('trainerId', '==', trainerId)
      .where('memberId', '==', memberId)
      .where('isActive', '==', true)
      .get();

    return !snap.empty;
  }

  return {
    /**
     * Create a new workout plan for an assigned member.
     * Accessible by: Assigned Trainer, Owner.
     *
     * @param {string} creatorUid - UID of requesting trainer or owner
     * @param {Object} planData - { memberId, weekDay, title, notes, exercises }
     * @param {Object} requester - { uid, role }
     * @returns {Promise<Object>} Created workout plan document
     */
    async createWorkoutPlan(creatorUid, planData, requester) {
      const { memberId, weekDay, title, notes, exercises } = planData;

      const usersCol = getCollection('users');
      const workoutPlansCol = getCollection('workoutPlans');

      // 1. Verify Member Exists
      const memberSnap = await usersCol.doc(memberId).get();
      if (!memberSnap.exists) {
        throw new NotFoundError(`Member with ID '${memberId}' does not exist`);
      }
      const memberData = memberSnap.data();
      if (memberData.role !== 'member') {
        throw new BadRequestError(`Target user '${memberId}' does not have role 'member'`);
      }

      // 2. Enforce Trainer Assignment (Trainers can only create plans for assigned members)
      if (requester.role === 'trainer') {
        const isAssigned = await verifyTrainerAssignment(requester.uid, memberId);
        if (!isAssigned) {
          throw new ForbiddenError('Access Denied: You are not assigned to this member');
        }
      }

      // 3. Fetch Trainer Details
      let trainerName = 'Gym Coach';
      if (requester.role === 'trainer') {
        const trainerSnap = await usersCol.doc(requester.uid).get();
        if (trainerSnap.exists) {
          trainerName = trainerSnap.data().displayName || trainerSnap.data().name || 'Trainer';
        }
      } else {
        trainerName = memberData.assignedTrainerName || 'FitMax Coach';
      }

      const now = new Date().toISOString();
      const planDocRef = workoutPlansCol.doc();

      // Clean exercises array
      const cleanedExercises = (exercises || []).map((ex, idx) => ({
        id: ex.id || `ex-${idx + 1}-${Date.now().toString(36)}`,
        name: ex.name.trim(),
        sets: Number(ex.sets),
        reps: String(ex.reps).trim(),
        weightKg: ex.weightKg != null ? Number(ex.weightKg) : null,
        restSeconds: ex.restSeconds != null ? Number(ex.restSeconds) : null,
        videoUrl: ex.videoUrl ? ex.videoUrl.trim() : null,
        notes: ex.notes ? ex.notes.trim() : null,
      }));

      const planRecord = {
        planId: planDocRef.id,
        trainerId: requester.role === 'trainer' ? requester.uid : (memberData.assignedTrainerId || requester.uid),
        trainerName,
        memberId,
        memberName: memberData.displayName || memberData.name || 'Member',
        weekDay: weekDay.toLowerCase(),
        title: title.trim(),
        notes: notes ? notes.trim() : null,
        exercises: cleanedExercises,
        createdBy: creatorUid,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      };

      await planDocRef.set(planRecord);
      return planRecord;
    },

    /**
     * Update an existing workout plan.
     * Accessible by: Assigned Trainer, Owner.
     *
     * @param {string} planId
     * @param {Object} updateData - Partial fields to update
     * @param {Object} requester - { uid, role }
     * @returns {Promise<Object>} Updated plan document
     */
    async updateWorkoutPlan(planId, updateData, requester) {
      if (!planId) {
        throw new BadRequestError('Workout plan ID is required');
      }

      const workoutPlansCol = getCollection('workoutPlans');
      const planDoc = await workoutPlansCol.doc(planId).get();

      if (!planDoc.exists) {
        throw new NotFoundError(`Workout plan with ID '${planId}' does not exist`);
      }

      const existingPlan = planDoc.data();

      // Enforce Trainer Assignment
      if (requester.role === 'trainer') {
        const isAssigned = await verifyTrainerAssignment(requester.uid, existingPlan.memberId);
        if (!isAssigned && existingPlan.trainerId !== requester.uid) {
          throw new ForbiddenError('Access Denied: You may only modify workout plans for assigned members');
        }
      }

      const now = new Date().toISOString();
      const updates = { updatedAt: now };

      if (updateData.title !== undefined) updates.title = updateData.title.trim();
      if (updateData.weekDay !== undefined) updates.weekDay = updateData.weekDay.toLowerCase();
      if (updateData.notes !== undefined) updates.notes = updateData.notes ? updateData.notes.trim() : null;

      if (Array.isArray(updateData.exercises)) {
        updates.exercises = updateData.exercises.map((ex, idx) => ({
          id: ex.id || `ex-${idx + 1}-${Date.now().toString(36)}`,
          name: ex.name.trim(),
          sets: Number(ex.sets),
          reps: String(ex.reps).trim(),
          weightKg: ex.weightKg != null ? Number(ex.weightKg) : null,
          restSeconds: ex.restSeconds != null ? Number(ex.restSeconds) : null,
          videoUrl: ex.videoUrl ? ex.videoUrl.trim() : null,
          notes: ex.notes ? ex.notes.trim() : null,
        }));
      }

      await workoutPlansCol.doc(planId).update(updates);
      return { ...existingPlan, ...updates };
    },

    /**
     * Delete a workout plan.
     * Accessible by: Assigned Trainer, Owner.
     *
     * @param {string} planId
     * @param {Object} requester - { uid, role }
     * @returns {Promise<{success: boolean, planId: string}>}
     */
    async deleteWorkoutPlan(planId, requester) {
      if (!planId) {
        throw new BadRequestError('Workout plan ID is required');
      }

      const workoutPlansCol = getCollection('workoutPlans');
      const planDoc = await workoutPlansCol.doc(planId).get();

      if (!planDoc.exists) {
        throw new NotFoundError(`Workout plan with ID '${planId}' does not exist`);
      }

      const plan = planDoc.data();

      if (requester.role === 'trainer') {
        const isAssigned = await verifyTrainerAssignment(requester.uid, plan.memberId);
        if (!isAssigned && plan.trainerId !== requester.uid) {
          throw new ForbiddenError('Access Denied: You may only delete workout plans for assigned members');
        }
      }

      await workoutPlansCol.doc(planId).delete();
      return { success: true, planId };
    },

    /**
     * List workout plans based on caller role & query filters.
     * - Members can ONLY see their own plans.
     * - Trainers can see plans for their assigned members.
     * - Owners can see all plans.
     *
     * @param {Object} filter - { memberId, weekDay, trainerId }
     * @param {Object} requester - { uid, role }
     * @returns {Promise<Array<Object>>}
     */
    async getWorkoutPlans(filter = {}, requester) {
      const workoutPlansCol = getCollection('workoutPlans');
      let query = workoutPlansCol;

      // Security Enforcement: Members can only view their own plans
      let targetMemberId = filter.memberId;
      if (requester.role === 'member') {
        targetMemberId = requester.uid;
      }

      // Security Enforcement: Trainers querying a member must be assigned to them
      if (requester.role === 'trainer' && targetMemberId) {
        const isAssigned = await verifyTrainerAssignment(requester.uid, targetMemberId);
        if (!isAssigned) {
          throw new ForbiddenError('Access Denied: You are not assigned to this member');
        }
      }

      if (targetMemberId) {
        query = query.where('memberId', '==', targetMemberId);
      } else if (requester.role === 'trainer') {
        // If trainer asks without memberId, filter by trainerId
        query = query.where('trainerId', '==', requester.uid);
      }

      if (filter.weekDay) {
        query = query.where('weekDay', '==', filter.weekDay.toLowerCase());
      }

      const snap = await query.get();
      const plans = [];
      snap.forEach((d) => plans.push({ id: d.id, ...d.data() }));

      return plans;
    },

    /**
     * Get single workout plan by ID.
     *
     * @param {string} planId
     * @param {Object} requester - { uid, role }
     * @returns {Promise<Object>}
     */
    async getWorkoutPlanById(planId, requester) {
      if (!planId) {
        throw new BadRequestError('Workout plan ID is required');
      }

      const workoutPlansCol = getCollection('workoutPlans');
      const planDoc = await workoutPlansCol.doc(planId).get();

      if (!planDoc.exists) {
        throw new NotFoundError(`Workout plan '${planId}' not found`);
      }

      const plan = planDoc.data();

      // Check access permission
      if (requester.role === 'member' && plan.memberId !== requester.uid) {
        throw new ForbiddenError('Access Denied: You can only view your own workout plans');
      }

      if (requester.role === 'trainer' && plan.trainerId !== requester.uid) {
        const isAssigned = await verifyTrainerAssignment(requester.uid, plan.memberId);
        if (!isAssigned) {
          throw new ForbiddenError('Access Denied: You are not assigned to this member');
        }
      }

      return { id: planDoc.id, ...plan };
    },

    /**
     * Log daily workout completion (Member / Trainer).
     * Persists in `workoutLogs` collection.
     *
     * @param {string} userId - Requesting user
     * @param {Object} logData - { workoutPlanId, date, completedExercises, notes, durationMinutes, perceivedExertion }
     * @param {Object} requester - { uid, role }
     * @returns {Promise<Object>} Persisted workout log
     */
    async logWorkoutCompletion(userId, logData, requester) {
      const {
        workoutPlanId = null,
        date,
        completedExercises = [],
        notes = null,
        durationMinutes = null,
        perceivedExertion = null,
      } = logData;

      const targetMemberId = requester.role === 'member' ? requester.uid : (logData.memberId || requester.uid);

      if (requester.role === 'trainer') {
        const isAssigned = await verifyTrainerAssignment(requester.uid, targetMemberId);
        if (!isAssigned) {
          throw new ForbiddenError('Access Denied: You are not assigned to this member');
        }
      }

      const todayStr = date || new Date().toISOString().split('T')[0];
      const now = new Date().toISOString();
      const logsCol = getCollection('workoutLogs');

      // Check if a log already exists for this member on this date
      const existingSnap = await logsCol
        .where('memberId', '==', targetMemberId)
        .where('date', '==', todayStr)
        .limit(1)
        .get();

      let logDocRef;
      let logRecord;

      if (!existingSnap.empty) {
        const doc = existingSnap.docs[0];
        logDocRef = doc.ref;
        logRecord = {
          ...doc.data(),
          workoutPlanId: workoutPlanId || doc.data().workoutPlanId || null,
          completedExercises,
          notes: notes !== null ? notes : doc.data().notes,
          durationMinutes: durationMinutes !== null ? durationMinutes : doc.data().durationMinutes,
          perceivedExertion: perceivedExertion !== null ? perceivedExertion : doc.data().perceivedExertion,
          updatedAt: now,
          completedAt: completedExercises.length > 0 ? now : doc.data().completedAt,
        };
        await logDocRef.update(logRecord);
      } else {
        logDocRef = logsCol.doc();
        logRecord = {
          logId: logDocRef.id,
          memberId: targetMemberId,
          workoutPlanId,
          date: todayStr,
          completedExercises,
          notes,
          durationMinutes,
          perceivedExertion,
          loggedBy: userId,
          createdAt: now,
          updatedAt: now,
          completedAt: completedExercises.length > 0 ? now : null,
        };
        await logDocRef.set(logRecord);
      }

      return { id: logDocRef.id, ...logRecord };
    },

    /**
     * Get workout logs for a member.
     *
     * @param {Object} filter - { memberId, date, limit }
     * @param {Object} requester - { uid, role }
     * @returns {Promise<Array<Object>>}
     */
    async getWorkoutLogs(filter = {}, requester) {
      const targetMemberId = requester.role === 'member' ? requester.uid : (filter.memberId || requester.uid);

      if (requester.role === 'trainer') {
        const isAssigned = await verifyTrainerAssignment(requester.uid, targetMemberId);
        if (!isAssigned) {
          throw new ForbiddenError('Access Denied: You are not assigned to this member');
        }
      }

      const logsCol = getCollection('workoutLogs');
      let query = logsCol.where('memberId', '==', targetMemberId);

      if (filter.date) {
        query = query.where('date', '==', filter.date);
      }

      const limit = Number(filter.limit) || 30;
      query = query.limit(limit);

      const snap = await query.get();
      const logs = [];
      snap.forEach((d) => logs.push({ id: d.id, ...d.data() }));

      return logs;
    },
  };
};

export const workoutService = createWorkoutService();
export default workoutService;
