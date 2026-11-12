/**
 * services/memberService.js — Online Joining & Member Plan Selection Operations
 */

import { db as defaultDb } from '../config/firebase.js';
import {
  BadRequestError,
  NotFoundError,
} from '../utils/errors.js';

export const createMemberService = (customDb = defaultDb) => {
  const getUsersCollection = () => {
    if (!customDb) throw new Error('[MemberService] Firestore DB is not initialized');
    return customDb.collection('users');
  };

  const getPlansCollection = () => {
    if (!customDb) throw new Error('[MemberService] Firestore DB is not initialized');
    return customDb.collection('membershipPlans');
  };

  const getMembershipsCollection = () => {
    if (!customDb) throw new Error('[MemberService] Firestore DB is not initialized');
    return customDb.collection('memberships');
  };

  return {
    /**
     * Select a membership plan online.
     * Creates a new membership document with status: 'payment_pending' and updates user profile.
     *
     * @param {string} userId - Authenticated user UID
     * @param {Object} selectionData - Plan ID and optional contact updates
     * @returns {Promise<{membership: Object, plan: Object}>}
     */
    async selectPlan(userId, selectionData) {
      if (!userId) {
        throw new BadRequestError('User authentication required');
      }

      const { planId } = selectionData;
      if (!planId) {
        throw new BadRequestError('Plan ID is required');
      }

      // 1. Fetch Plan details
      const planDoc = await getPlansCollection().doc(planId).get();
      if (!planDoc.exists) {
        throw new NotFoundError(`Membership plan '${planId}' not found`);
      }

      const plan = planDoc.data();
      if (plan.isActive === false) {
        throw new BadRequestError('Selected plan is currently inactive and unavailable for joining');
      }

      const now = new Date().toISOString();
      const startDate = new Date();
      const durationDays = plan.durationDays || 30;
      const endDate = new Date(startDate.getTime() + durationDays * 24 * 60 * 60 * 1000);

      // 2. Create Membership with payment_pending status
      const membershipData = {
        userId,
        planId: plan.planId || planId,
        planName: plan.name,
        durationDays,
        priceInPaise: plan.priceInPaise || 0,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        status: 'payment_pending', // Key architectural state requirement
        paymentStatus: 'pending',
        createdBy: userId,
        createdAt: now,
        updatedAt: now,
      };

      const docRef = await getMembershipsCollection().add(membershipData);
      const membershipId = docRef.id;

      // 3. Update User profile with membershipStatus and activeMembershipId
      const userUpdates = {
        membershipStatus: 'payment_pending',
        activeMembershipId: membershipId,
        updatedAt: now,
      };

      if (selectionData.phone) userUpdates.phone = selectionData.phone;
      if (selectionData.gender) userUpdates.gender = selectionData.gender;
      if (selectionData.dateOfBirth) userUpdates.dateOfBirth = selectionData.dateOfBirth;
      if (selectionData.address) userUpdates.address = selectionData.address;
      if (selectionData.emergencyContact) userUpdates.emergencyContact = selectionData.emergencyContact;

      await getUsersCollection().doc(userId).set(userUpdates, { merge: true });

      return {
        membership: { membershipId, ...membershipData },
        plan,
      };
    },

    /**
     * Get the active or pending membership record for a member.
     *
     * @param {string} userId
     * @returns {Promise<Object|null>}
     */
    async getCurrentMembership(userId) {
      if (!userId) {
        throw new BadRequestError('User ID is required');
      }

      const snapshot = await getMembershipsCollection()
        .where('userId', '==', userId)
        .get();

      if (snapshot.empty) {
        return null;
      }

      const records = [];
      snapshot.forEach((doc) => {
        records.push({ membershipId: doc.id, ...doc.data() });
      });

      // Sort newest first
      records.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      return records[0];
    },
  };
};

export const memberService = createMemberService();

