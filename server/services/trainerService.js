/**
 * services/trainerService.js — Trainer Assignments & Member Management (Day 19 Task 37)
 *
 * Implements business logic for:
 * - Assigning members to trainers (Owner / Reception)
 * - Unassigning members (Owner / Reception)
 * - Strict enforcement of trainer access (Trainers may only view & manage assigned members)
 * - Tracking fitness goals, weights, attendance and progress history
 */

import { db as defaultDb } from '../config/firebase.js';
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from '../utils/errors.js';

export const createTrainerService = (customDb = defaultDb) => {
  const getCollection = (name) => {
    if (!customDb) throw new Error(`[TrainerService] Firestore DB is not initialized for ${name}`);
    return customDb.collection(name);
  };

  return {
    /**
     * Assign a gym member to a personal trainer.
     * Accessible by: Owner, Reception.
     *
     * @param {string} assignerUid - UID of staff making the assignment
     * @param {Object} data - Assignment details
     * @returns {Promise<Object>} Created assignment record
     */
    async assignMember(assignerUid, {
      trainerId,
      memberId,
      fitnessGoal = 'General Fitness',
      notes = null,
      targetWeightKg = null,
      currentWeightKg = null,
    }) {
      if (!trainerId || !memberId) {
        throw new BadRequestError('Both trainerId and memberId are required');
      }

      const usersCol = getCollection('users');
      const assignmentsCol = getCollection('trainerAssignments');
      const auditCol = getCollection('auditLogs');

      // 1. Validate Trainer
      const trainerSnap = await usersCol.doc(trainerId).get();
      if (!trainerSnap.exists) {
        throw new NotFoundError(`Trainer with ID '${trainerId}' does not exist`);
      }
      const trainer = trainerSnap.data();
      if (trainer.role !== 'trainer') {
        throw new BadRequestError(`User '${trainerId}' does not have the 'trainer' role`);
      }
      if (trainer.approvalStatus === 'suspended') {
        throw new BadRequestError('Cannot assign members to a suspended trainer');
      }

      // 2. Validate Member
      const memberSnap = await usersCol.doc(memberId).get();
      if (!memberSnap.exists) {
        throw new NotFoundError(`Member with ID '${memberId}' does not exist`);
      }
      const member = memberSnap.data();
      if (member.role !== 'member') {
        throw new BadRequestError(`User '${memberId}' does not have the 'member' role`);
      }

      const now = new Date().toISOString();

      // 3. Deactivate any existing active assignments for this member
      const existingSnap = await assignmentsCol
        .where('memberId', '==', memberId)
        .where('isActive', '==', true)
        .get();

      if (!existingSnap.empty) {
        const batch = customDb.batch ? customDb.batch() : null;
        for (const doc of existingSnap.docs) {
          const updateData = {
            isActive: false,
            unassignedAt: now,
            unassignedBy: assignerUid,
            reason: `Reassigned to trainer ${trainer.displayName || trainerId}`,
            updatedAt: now,
          };
          if (batch) {
            batch.update(doc.ref, updateData);
          } else {
            await doc.ref.update(updateData);
          }
        }
        if (batch) await batch.commit();
      }

      // 4. Create new trainer assignment record
      const assignmentDocRef = assignmentsCol.doc();
      const assignmentRecord = {
        assignmentId: assignmentDocRef.id,
        trainerId,
        trainerName: trainer.displayName || trainer.name || 'Trainer',
        trainerEmail: trainer.email || null,
        memberId,
        memberName: member.displayName || member.name || 'Member',
        memberEmail: member.email || null,
        memberPhone: member.phone || null,
        fitnessGoal: fitnessGoal || member.fitnessGoal || 'General Fitness',
        notes: notes || null,
        currentWeightKg: currentWeightKg ?? member.currentWeightKg ?? null,
        targetWeightKg: targetWeightKg ?? member.targetWeightKg ?? null,
        assignedBy: assignerUid,
        assignedAt: now,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      };

      await assignmentDocRef.set(assignmentRecord);

      // 5. Update Member User document with assigned trainer reference & goal
      const memberUpdates = {
        assignedTrainerId: trainerId,
        assignedTrainerName: trainer.displayName || trainer.name || 'Trainer',
        fitnessGoal: assignmentRecord.fitnessGoal,
        updatedAt: now,
      };
      if (currentWeightKg != null) memberUpdates.currentWeightKg = currentWeightKg;
      if (targetWeightKg != null) memberUpdates.targetWeightKg = targetWeightKg;

      await usersCol.doc(memberId).update(memberUpdates);

      // 6. Record Audit Log
      try {
        await auditCol.add({
          actorId: assignerUid,
          action: 'trainer_assigned_to_member',
          targetId: memberId,
          metadata: {
            trainerId,
            assignmentId: assignmentDocRef.id,
            fitnessGoal: assignmentRecord.fitnessGoal,
          },
          timestamp: now,
          createdAt: now,
        });
      } catch {
        // Audit log failure shouldn't block primary assignment
      }

      return assignmentRecord;
    },

    /**
     * Unassign a member from their current trainer.
     * Accessible by: Owner, Reception.
     *
     * @param {string} unassignerUid
     * @param {Object} param1
     * @returns {Promise<Object>}
     */
    async unassignMember(unassignerUid, { memberId, trainerId = null, reason = 'Unassigned by staff' }) {
      if (!memberId) {
        throw new BadRequestError('Member ID is required for unassignment');
      }

      const usersCol = getCollection('users');
      const assignmentsCol = getCollection('trainerAssignments');
      const auditCol = getCollection('auditLogs');

      // Verify Member exists
      const memberSnap = await usersCol.doc(memberId).get();
      if (!memberSnap.exists) {
        throw new NotFoundError(`Member with ID '${memberId}' does not exist`);
      }

      const now = new Date().toISOString();

      // Find active assignments for member
      const snap = await assignmentsCol
        .where('memberId', '==', memberId)
        .where('isActive', '==', true)
        .get();

      let unassignedCount = 0;
      for (const doc of snap.docs) {
        const data = doc.data();
        if (!trainerId || data.trainerId === trainerId) {
          await doc.ref.update({
            isActive: false,
            unassignedAt: now,
            unassignedBy: unassignerUid,
            reason: reason || 'Unassigned by staff',
            updatedAt: now,
          });
          unassignedCount++;
        }
      }

      // Clear member's trainer reference
      await usersCol.doc(memberId).update({
        assignedTrainerId: null,
        assignedTrainerName: null,
        updatedAt: now,
      });

      // Audit Log
      try {
        await auditCol.add({
          actorId: unassignerUid,
          action: 'trainer_unassigned_from_member',
          targetId: memberId,
          metadata: {
            trainerId: trainerId || 'all',
            unassignedCount,
            reason,
          },
          timestamp: now,
          createdAt: now,
        });
      } catch {
        // Non-blocking
      }

      return {
        success: true,
        memberId,
        unassignedCount,
        unassignedAt: now,
      };
    },

    /**
     * List all active assigned members for a specific trainer.
     * Strict Enforcement:
     * - Trainers can ONLY view their own assigned members.
     * - Owners can view any trainer's assigned members.
     *
     * @param {string} targetTrainerId
     * @param {Object} requester - { uid, role }
     * @returns {Promise<Array<Object>>}
     */
    async getAssignedMembers(targetTrainerId, requester) {
      if (!targetTrainerId) {
        throw new BadRequestError('Trainer ID is required');
      }

      // Security Check: Enforce trainer access
      if (requester.role === 'trainer' && requester.uid !== targetTrainerId) {
        throw new ForbiddenError('Access Denied: Trainers may only view their own assigned members');
      }

      const assignmentsCol = getCollection('trainerAssignments');
      const usersCol = getCollection('users');
      const membershipsCol = getCollection('memberships');
      const attendanceCol = getCollection('attendance');

      // Fetch active assignments for this trainer
      const snap = await assignmentsCol
        .where('trainerId', '==', targetTrainerId)
        .where('isActive', '==', true)
        .get();

      const membersList = [];

      for (const doc of snap.docs) {
        const assignment = doc.data();
        const memberId = assignment.memberId;

        // Fetch User profile
        const userSnap = await usersCol.doc(memberId).get();
        const userData = userSnap.exists ? userSnap.data() : {};

        // Fetch Active Membership
        let activePlan = null;
        if (userData.activeMembershipId) {
          const mSnap = await membershipsCol.doc(userData.activeMembershipId).get();
          if (mSnap.exists) {
            const mData = mSnap.data();
            activePlan = {
              planName: mData.planName,
              status: mData.status,
              endDate: mData.endDate,
            };
          }
        }

        // Fetch Attendance Summary (Last 30 days / streak)
        let attendanceSummary = {
          totalVisits: 0,
          currentStreak: Number(userData.streakDays) || 0,
          lastCheckInDate: userData.lastCheckInDate || null,
        };

        try {
          const attSnap = await attendanceCol
            .where('userId', '==', memberId)
            .limit(30)
            .get();
          attendanceSummary.totalVisits = attSnap.size || 0;
        } catch {
          // Fallback to user metadata
        }

        membersList.push({
          assignmentId: doc.id,
          memberId,
          displayName: userData.displayName || assignment.memberName,
          email: userData.email || assignment.memberEmail,
          phone: userData.phone || assignment.memberPhone,
          gender: userData.gender || null,
          membershipStatus: userData.membershipStatus || 'active',
          activePlan,
          fitnessGoal: assignment.fitnessGoal || userData.fitnessGoal || 'General Fitness',
          currentWeightKg: userData.currentWeightKg ?? assignment.currentWeightKg ?? null,
          targetWeightKg: userData.targetWeightKg ?? assignment.targetWeightKg ?? null,
          weightDeltaKg:
            userData.currentWeightKg != null && userData.targetWeightKg != null
              ? Number((userData.currentWeightKg - userData.targetWeightKg).toFixed(1))
              : null,
          notes: assignment.notes || null,
          assignedAt: assignment.assignedAt,
          attendance: attendanceSummary,
        });
      }

      return membersList;
    },

    /**
     * Retrieve single assigned member's profile & progress.
     * Enforces that the requesting trainer is currently assigned to this member.
     *
     * @param {string} memberId
     * @param {Object} requester - { uid, role }
     * @returns {Promise<Object>}
     */
    async getAssignedMemberDetails(memberId, requester) {
      if (!memberId) {
        throw new BadRequestError('Member ID is required');
      }

      const assignmentsCol = getCollection('trainerAssignments');
      const usersCol = getCollection('users');
      const membershipsCol = getCollection('memberships');
      const attendanceCol = getCollection('attendance');

      // Security check for Trainers: Enforce that member is actively assigned to this trainer
      if (requester.role === 'trainer') {
        const verifySnap = await assignmentsCol
          .where('trainerId', '==', requester.uid)
          .where('memberId', '==', memberId)
          .where('isActive', '==', true)
          .get();

        if (verifySnap.empty) {
          throw new ForbiddenError('Access Denied: You are not assigned to this member');
        }
      }

      const userSnap = await usersCol.doc(memberId).get();
      if (!userSnap.exists) {
        throw new NotFoundError(`Member '${memberId}' not found`);
      }
      const member = userSnap.data();

      // Active assignment details
      const assignSnap = await assignmentsCol
        .where('memberId', '==', memberId)
        .where('isActive', '==', true)
        .limit(1)
        .get();

      const assignment = !assignSnap.empty ? assignSnap.docs[0].data() : null;

      // Active membership
      let activeMembership = null;
      if (member.activeMembershipId) {
        const mSnap = await membershipsCol.doc(member.activeMembershipId).get();
        if (mSnap.exists) activeMembership = mSnap.data();
      }

      // Recent attendance check-ins
      const recentAttendance = [];
      try {
        const attSnap = await attendanceCol
          .where('userId', '==', memberId)
          .limit(10)
          .get();
        attSnap.forEach((d) => recentAttendance.push({ id: d.id, ...d.data() }));
      } catch {
        // Continue
      }

      return {
        member: {
          uid: memberId,
          displayName: member.displayName,
          email: member.email,
          phone: member.phone,
          gender: member.gender,
          dateOfBirth: member.dateOfBirth,
          membershipStatus: member.membershipStatus,
          fitnessGoal: assignment?.fitnessGoal || member.fitnessGoal || 'General Fitness',
          currentWeightKg: member.currentWeightKg ?? assignment?.currentWeightKg ?? null,
          targetWeightKg: member.targetWeightKg ?? assignment?.targetWeightKg ?? null,
          notes: assignment?.notes || null,
        },
        assignment,
        activeMembership,
        recentAttendance,
      };
    },

    /**
     * Update member's fitness progress / goal.
     * Accessible by: The assigned Trainer or Owner.
     *
     * @param {string} memberId
     * @param {Object} progressData
     * @param {Object} requester - { uid, role }
     * @returns {Promise<Object>}
     */
    async updateMemberProgress(memberId, progressData, requester) {
      if (!memberId) {
        throw new BadRequestError('Member ID is required');
      }

      const assignmentsCol = getCollection('trainerAssignments');
      const usersCol = getCollection('users');

      // Security check: If requester is a trainer, verify active assignment
      let activeAssignmentDoc = null;
      if (requester.role === 'trainer') {
        const verifySnap = await assignmentsCol
          .where('trainerId', '==', requester.uid)
          .where('memberId', '==', memberId)
          .where('isActive', '==', true)
          .get();

        if (verifySnap.empty) {
          throw new ForbiddenError('Access Denied: You cannot update progress for unassigned members');
        }
        activeAssignmentDoc = verifySnap.docs[0];
      } else {
        const assignSnap = await assignmentsCol
          .where('memberId', '==', memberId)
          .where('isActive', '==', true)
          .limit(1)
          .get();
        if (!assignSnap.empty) activeAssignmentDoc = assignSnap.docs[0];
      }

      const now = new Date().toISOString();
      const userUpdates = { updatedAt: now };
      const assignUpdates = { updatedAt: now };

      if (progressData.fitnessGoal) {
        userUpdates.fitnessGoal = progressData.fitnessGoal;
        assignUpdates.fitnessGoal = progressData.fitnessGoal;
      }
      if (progressData.currentWeightKg != null) {
        userUpdates.currentWeightKg = progressData.currentWeightKg;
        assignUpdates.currentWeightKg = progressData.currentWeightKg;
      }
      if (progressData.targetWeightKg != null) {
        userUpdates.targetWeightKg = progressData.targetWeightKg;
        assignUpdates.targetWeightKg = progressData.targetWeightKg;
      }
      if (progressData.notes != null) {
        assignUpdates.notes = progressData.notes;
      }

      await usersCol.doc(memberId).update(userUpdates);
      if (activeAssignmentDoc) {
        await activeAssignmentDoc.ref.update(assignUpdates);
      }

      return {
        memberId,
        ...progressData,
        updatedAt: now,
      };
    },

    /**
     * List all active trainers in the gym.
     * Useful for Owner/Reception assignment dropdowns.
     *
     * @returns {Promise<Array<Object>>}
     */
    async listTrainers() {
      const usersCol = getCollection('users');
      const assignmentsCol = getCollection('trainerAssignments');

      const snap = await usersCol.where('role', '==', 'trainer').get();
      const trainers = [];

      for (const doc of snap.docs) {
        const data = doc.data();
        if (data.approvalStatus !== 'suspended') {
          // Count active assigned members
          let activeClientsCount = 0;
          try {
            const countSnap = await assignmentsCol
              .where('trainerId', '==', doc.id)
              .where('isActive', '==', true)
              .get();
            activeClientsCount = countSnap.size;
          } catch {
            // Count fallback
          }

          trainers.push({
            uid: doc.id,
            trainerId: doc.id,
            displayName: data.displayName || data.name || 'Trainer',
            email: data.email,
            phone: data.phone || null,
            specialization: data.specialization || 'General Fitness & Conditioning',
            activeClientsCount,
            approvalStatus: data.approvalStatus || 'active',
          });
        }
      }

      return trainers;
    },

    /**
     * List assignments (with optional filters: trainerId, memberId, isActive).
     *
     * @param {Object} filter
     * @returns {Promise<Array<Object>>}
     */
    async listAssignments(filter = {}) {
      const assignmentsCol = getCollection('trainerAssignments');
      let query = assignmentsCol;

      if (filter.trainerId) {
        query = query.where('trainerId', '==', filter.trainerId);
      }
      if (filter.memberId) {
        query = query.where('memberId', '==', filter.memberId);
      }
      if (filter.isActive !== undefined) {
        query = query.where('isActive', '==', Boolean(filter.isActive));
      }

      const snap = await query.get();
      const records = [];
      snap.forEach((d) => records.push({ id: d.id, ...d.data() }));
      return records;
    },
  };
};

export const trainerService = createTrainerService();
export default trainerService;
