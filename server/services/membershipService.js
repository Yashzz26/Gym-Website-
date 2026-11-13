/**
 * services/membershipService.js — Membership Lifecycle, Creation & Renewal Operations
 */

import { db as defaultDb } from '../config/firebase.js';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../utils/errors.js';

export const createMembershipService = (customDb = defaultDb) => {
  const getUsersCollection = () => {
    if (!customDb) throw new Error('[MembershipService] Firestore DB is not initialized');
    return customDb.collection('users');
  };

  const getPlansCollection = () => {
    if (!customDb) throw new Error('[MembershipService] Firestore DB is not initialized');
    return customDb.collection('membershipPlans');
  };

  const getMembershipsCollection = () => {
    if (!customDb) throw new Error('[MembershipService] Firestore DB is not initialized');
    return customDb.collection('memberships');
  };

  return {
    /**
     * Create and activate a new membership record for a member.
     *
     * @param {string} creatorUid - UID of staff/owner creating the membership
     * @param {Object} data - Validated membership creation data
     * @returns {Promise<Object>} Created membership record
     */
    async createMembership(creatorUid, data) {
      const { userId, planId, paymentMethod = 'cash', paymentStatus = 'paid', notes } = data;

      // 1. Verify User exists
      const userDoc = await getUsersCollection().doc(userId).get();
      if (!userDoc.exists) {
        throw new NotFoundError(`User not found with ID: ${userId}`);
      }

      // 2. Verify Plan exists and is active
      const planDoc = await getPlansCollection().doc(planId).get();
      if (!planDoc.exists) {
        throw new NotFoundError(`Membership plan '${planId}' not found`);
      }

      const plan = planDoc.data();
      if (plan.isActive === false) {
        throw new BadRequestError('Cannot assign an inactive membership plan');
      }

      const now = new Date().toISOString();
      const startDate = data.startDate ? new Date(data.startDate).toISOString() : now;
      const durationDays = plan.durationDays || 30;
      const endDate = new Date(new Date(startDate).getTime() + durationDays * 24 * 60 * 60 * 1000).toISOString();

      const status = paymentStatus === 'paid' ? 'active' : 'payment_pending';

      const membershipData = {
        userId,
        planId: plan.planId || planId,
        planName: plan.name,
        durationDays,
        priceInPaise: plan.priceInPaise || 0,
        startDate,
        endDate,
        status,
        paymentStatus,
        paymentMethod,
        notes: notes || null,
        renewedFrom: null,
        createdBy: creatorUid,
        createdAt: now,
        updatedAt: now,
      };

      const docRef = await getMembershipsCollection().add(membershipData);
      const membershipId = docRef.id;

      // Update User profile
      await getUsersCollection().doc(userId).set(
        {
          membershipStatus: status,
          activeMembershipId: membershipId,
          updatedAt: now,
        },
        { merge: true }
      );

      return { membershipId, ...membershipData };
    },

    /**
     * Renew an existing membership.
     * Preserves previous membership history by creating a new membership record
     * linked via `renewedFrom: previousMembershipId`.
     *
     * @param {string} creatorUid - Staff or Member UID initiating renewal
     * @param {string} membershipId - Previous membership ID to renew
     * @param {Object} data - Renewal details (optional new planId, payment details)
     * @param {boolean} [isMemberSelf=false] - Whether member is renewing their own plan
     * @returns {Promise<{membership: Object, previousMembership: Object}>}
     */
    async renewMembership(creatorUid, membershipId, data = {}, isMemberSelf = false) {
      // 1. Fetch previous membership
      const prevDoc = await getMembershipsCollection().doc(membershipId).get();
      if (!prevDoc.exists) {
        throw new NotFoundError(`Membership record '${membershipId}' not found`);
      }

      const prevMembership = { membershipId: prevDoc.id, ...prevDoc.data() };

      if (isMemberSelf && prevMembership.userId !== creatorUid) {
        throw new ForbiddenError('You can only renew your own membership');
      }

      // 2. Fetch Plan to renew
      const planId = data.planId || prevMembership.planId;
      const planDoc = await getPlansCollection().doc(planId).get();
      if (!planDoc.exists) {
        throw new NotFoundError(`Membership plan '${planId}' not found`);
      }

      const plan = planDoc.data();
      if (plan.isActive === false) {
        throw new BadRequestError('Cannot renew with an inactive membership plan');
      }

      const now = new Date();
      const prevEndDate = new Date(prevMembership.endDate);

      // Renewal extension calculation:
      // If previous membership is still active and ends in the future, extend from that end date!
      // If already expired or in the past, start from right now.
      let newStartDate;
      if (prevMembership.status === 'active' && prevEndDate > now) {
        newStartDate = prevEndDate.toISOString();
      } else {
        newStartDate = now.toISOString();
      }

      const durationDays = plan.durationDays || 30;
      const newEndDate = new Date(new Date(newStartDate).getTime() + durationDays * 24 * 60 * 60 * 1000).toISOString();

      const paymentStatus = data.paymentStatus || 'paid';
      const status = paymentStatus === 'paid' ? 'active' : 'payment_pending';
      const nowIso = now.toISOString();

      // 3. Mark previous membership as renewed without overwriting its historical data
      await getMembershipsCollection().doc(membershipId).update({
        renewedAt: nowIso,
        status: prevEndDate < now ? 'expired' : prevMembership.status,
        updatedAt: nowIso,
      });

      // 4. Create new Membership record with renewedFrom link
      const newMembershipData = {
        userId: prevMembership.userId,
        planId: plan.planId || planId,
        planName: plan.name,
        durationDays,
        priceInPaise: plan.priceInPaise || 0,
        startDate: newStartDate,
        endDate: newEndDate,
        status,
        paymentStatus,
        paymentMethod: data.paymentMethod || 'cash',
        notes: data.notes || null,
        renewedFrom: membershipId, // Explicit historical reference
        createdBy: creatorUid,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      const newDocRef = await getMembershipsCollection().add(newMembershipData);
      const newMembershipId = newDocRef.id;

      // Link previous membership to the new membership ID
      await getMembershipsCollection().doc(membershipId).update({
        nextMembershipId: newMembershipId,
      });

      // 5. Update User Profile
      await getUsersCollection().doc(prevMembership.userId).set(
        {
          membershipStatus: status,
          activeMembershipId: newMembershipId,
          updatedAt: nowIso,
        },
        { merge: true }
      );

      return {
        membership: { membershipId: newMembershipId, ...newMembershipData },
        previousMembership: prevMembership,
      };
    },

    /**
     * Retrieve a single membership by ID.
     */
    async getMembershipById(membershipId) {
      if (!membershipId) {
        throw new BadRequestError('Membership ID is required');
      }

      const docSnap = await getMembershipsCollection().doc(membershipId).get();
      if (!docSnap.exists) {
        throw new NotFoundError(`Membership '${membershipId}' not found`);
      }

      const data = docSnap.data();
      const now = new Date();
      const endDate = new Date(data.endDate);
      const daysRemaining = Math.max(0, Math.ceil((endDate - now) / (1000 * 60 * 60 * 24)));
      const isExpired = data.status !== 'cancelled' && endDate < now;

      return {
        membershipId: docSnap.id,
        ...data,
        daysRemaining,
        isExpired,
      };
    },

    /**
     * Retrieve full membership history and current active membership for a user.
     */
    async getUserMemberships(userId) {
      if (!userId) {
        throw new BadRequestError('User ID is required');
      }

      const snapshot = await getMembershipsCollection()
        .where('userId', '==', userId)
        .get();

      const now = new Date();
      const records = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        const endDate = new Date(data.endDate);
        const daysRemaining = Math.max(0, Math.ceil((endDate - now) / (1000 * 60 * 60 * 24)));
        const isExpired = data.status !== 'cancelled' && endDate < now;

        records.push({
          membershipId: doc.id,
          ...data,
          daysRemaining,
          isExpired,
        });
      });

      // Sort newest first by startDate
      records.sort((a, b) => new Date(b.startDate || b.createdAt) - new Date(a.startDate || a.createdAt));

      // Find active or payment_pending membership
      const activeMembership =
        records.find((m) => m.status === 'active' && !m.isExpired) ||
        records.find((m) => m.status === 'payment_pending') ||
        records[0] ||
        null;

      return {
        userId,
        activeMembership,
        history: records,
        totalMemberships: records.length,
      };
    },
  };
};

export const membershipService = createMembershipService();
