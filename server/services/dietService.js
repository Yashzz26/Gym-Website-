/**
 * services/dietService.js — Diet & Nutrition Plans Operations (Day 21 Task 41)
 *
 * Implements business logic for:
 * - Creating, updating, and deleting diet plans with calories, macros, and meal breakdown
 * - Enforcing trainer access only to assigned members
 * - Retrieving personalized active diet plans for members
 */

import { db as defaultDb } from '../config/firebase.js';
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from '../utils/errors.js';

export const createDietService = (customDb = defaultDb) => {
  const getCollection = (name) => {
    if (!customDb) throw new Error(`[DietService] Firestore DB is not initialized for ${name}`);
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
     * Create a new diet plan for an assigned member.
     * Accessible by: Assigned Trainer, Owner.
     *
     * @param {string} creatorUid - UID of requesting trainer or owner
     * @param {Object} planData - Diet plan details
     * @param {Object} requester - { uid, role }
     * @returns {Promise<Object>} Created diet plan document
     */
    async createDietPlan(creatorUid, planData, requester) {
      const {
        memberId,
        title,
        targetCalories,
        macros,
        waterIntakeLiters,
        meals,
        notes,
        isActive = true,
      } = planData;

      const usersCol = getCollection('users');
      const dietPlansCol = getCollection('dietPlans');

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

      // 4. If new plan is active, deactivate previous active plans for this member
      if (isActive) {
        const existingActive = await dietPlansCol
          .where('memberId', '==', memberId)
          .where('isActive', '==', true)
          .get();

        const deactivateBatch = existingActive.docs.map((docSnap) =>
          docSnap.ref.update({ isActive: false, updatedAt: new Date().toISOString() })
        );
        await Promise.all(deactivateBatch);
      }

      const now = new Date().toISOString();
      const planDoc = {
        memberId,
        trainerId: requester.role === 'trainer' ? requester.uid : null,
        trainerName,
        title,
        targetCalories: Number(targetCalories),
        macros: {
          protein: Number(macros.protein),
          carbs: Number(macros.carbs),
          fat: Number(macros.fat),
          fiber: macros.fiber !== undefined && macros.fiber !== null ? Number(macros.fiber) : 0,
        },
        waterIntakeLiters: waterIntakeLiters !== undefined && waterIntakeLiters !== null ? Number(waterIntakeLiters) : 3,
        meals,
        notes: notes || null,
        isActive: Boolean(isActive),
        createdBy: creatorUid,
        createdAt: now,
        updatedAt: now,
      };

      const docRef = await dietPlansCol.add(planDoc);
      return { id: docRef.id, ...planDoc };
    },

    /**
     * Update an existing diet plan.
     * Accessible by: Assigned Trainer, Creator Trainer, Owner.
     *
     * @param {string} updaterUid - UID of requester
     * @param {string} planId - Document ID of diet plan
     * @param {Object} updateData - Partial plan updates
     * @param {Object} requester - { uid, role }
     * @returns {Promise<Object>} Updated diet plan document
     */
    async updateDietPlan(updaterUid, planId, updateData, requester) {
      const dietPlansCol = getCollection('dietPlans');
      const planRef = dietPlansCol.doc(planId);
      const planSnap = await planRef.get();

      if (!planSnap.exists) {
        throw new NotFoundError(`Diet plan '${planId}' not found`);
      }

      const currentPlan = planSnap.data();

      // Enforce Trainer Authorization
      if (requester.role === 'trainer') {
        const isAssigned = await verifyTrainerAssignment(requester.uid, currentPlan.memberId);
        const isCreator = currentPlan.createdBy === requester.uid || currentPlan.trainerId === requester.uid;
        if (!isAssigned && !isCreator) {
          throw new ForbiddenError('Access Denied: You are not authorized to update this diet plan');
        }
      }

      // If updating to isActive: true, deactivate others for this member
      if (updateData.isActive === true && !currentPlan.isActive) {
        const existingActive = await dietPlansCol
          .where('memberId', '==', currentPlan.memberId)
          .where('isActive', '==', true)
          .get();

        const deactivateBatch = existingActive.docs
          .filter((doc) => doc.id !== planId)
          .map((doc) => doc.ref.update({ isActive: false, updatedAt: new Date().toISOString() }));
        await Promise.all(deactivateBatch);
      }

      const now = new Date().toISOString();
      const fieldsToUpdate = {
        ...updateData,
        updatedAt: now,
      };

      if (updateData.macros) {
        fieldsToUpdate.macros = {
          ...currentPlan.macros,
          ...updateData.macros,
        };
      }

      await planRef.update(fieldsToUpdate);

      return {
        id: planId,
        ...currentPlan,
        ...fieldsToUpdate,
      };
    },

    /**
     * Delete a diet plan.
     * Accessible by: Assigned Trainer, Creator Trainer, Owner.
     */
    async deleteDietPlan(planId, requester) {
      const dietPlansCol = getCollection('dietPlans');
      const planRef = dietPlansCol.doc(planId);
      const planSnap = await planRef.get();

      if (!planSnap.exists) {
        throw new NotFoundError(`Diet plan '${planId}' not found`);
      }

      const currentPlan = planSnap.data();

      if (requester.role === 'trainer') {
        const isAssigned = await verifyTrainerAssignment(requester.uid, currentPlan.memberId);
        const isCreator = currentPlan.createdBy === requester.uid || currentPlan.trainerId === requester.uid;
        if (!isAssigned && !isCreator) {
          throw new ForbiddenError('Access Denied: You are not authorized to delete this diet plan');
        }
      }

      await planRef.delete();
      return { success: true, deletedPlanId: planId };
    },

    /**
     * Retrieve a specific diet plan by ID.
     */
    async getDietPlanById(planId, requester) {
      const dietPlansCol = getCollection('dietPlans');
      const planSnap = await dietPlansCol.doc(planId).get();

      if (!planSnap.exists) {
        throw new NotFoundError(`Diet plan '${planId}' not found`);
      }

      const plan = { id: planSnap.id, ...planSnap.data() };

      // Role authorization
      if (requester.role === 'member') {
        if (plan.memberId !== requester.uid) {
          throw new ForbiddenError('Access Denied: You can only view your own diet plan');
        }
      } else if (requester.role === 'trainer') {
        const isAssigned = await verifyTrainerAssignment(requester.uid, plan.memberId);
        const isCreator = plan.createdBy === requester.uid || plan.trainerId === requester.uid;
        if (!isAssigned && !isCreator) {
          throw new ForbiddenError('Access Denied: You are not authorized to view this member\'s diet plan');
        }
      }

      return plan;
    },

    /**
     * Retrieve the currently active diet plan for a member.
     */
    async getMemberActiveDietPlan(memberId, requester) {
      if (requester.role === 'member' && requester.uid !== memberId) {
        throw new ForbiddenError('Access Denied: You can only view your own diet plan');
      }

      if (requester.role === 'trainer') {
        const isAssigned = await verifyTrainerAssignment(requester.uid, memberId);
        if (!isAssigned) {
          throw new ForbiddenError('Access Denied: You are not assigned to this member');
        }
      }

      const dietPlansCol = getCollection('dietPlans');
      const snap = await dietPlansCol
        .where('memberId', '==', memberId)
        .where('isActive', '==', true)
        .get();

      if (snap.empty) {
        return null;
      }

      // Return the most recently updated active plan
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      docs.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
      return docs[0];
    },

    /**
     * List diet plans based on role and filters.
     */
    async getDietPlans(requester, filters = {}) {
      const dietPlansCol = getCollection('dietPlans');
      let query = dietPlansCol;

      if (requester.role === 'member') {
        query = query.where('memberId', '==', requester.uid);
      } else if (filters.memberId) {
        if (requester.role === 'trainer') {
          const isAssigned = await verifyTrainerAssignment(requester.uid, filters.memberId);
          if (!isAssigned) {
            throw new ForbiddenError('Access Denied: You are not assigned to this member');
          }
        }
        query = query.where('memberId', '==', filters.memberId);
      } else if (requester.role === 'trainer') {
        query = query.where('trainerId', '==', requester.uid);
      }

      const snap = await query.get();
      const plans = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

      // Sort in-memory: active first, then most recently updated
      plans.sort((a, b) => {
        if (a.isActive && !b.isActive) return -1;
        if (!a.isActive && b.isActive) return 1;
        return new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt);
      });

      return plans;
    },
  };
};

export default createDietService();
