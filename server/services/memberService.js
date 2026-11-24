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

  const getReminderLogsCollection = () => {
    if (!customDb) throw new Error('[MemberService] Firestore DB is not initialized');
    return customDb.collection('reminderLogs');
  };

  const toDate = (val) => {
    if (!val) return null;
    if (typeof val.toDate === 'function') return val.toDate();
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
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

    /**
     * Retrieve members with active memberships who have not checked in
     * for at least `daysInactive` consecutive days (or since start date if never attended).
     * Excludes expired memberships and ineligible/suspended accounts.
     *
     * @param {Object} [options]
     * @param {number} [options.daysInactive=7] - Minimum days absent (default 7)
     * @param {number} [options.limit=50] - Result limit
     * @returns {Promise<Object>} Inactive members list with urgency breakdown and summary stats
     */
    async getInactiveMembers({ daysInactive = 7, limit = 50 } = {}) {
      const now = new Date();
      const thresholdDays = Number(daysInactive) > 0 ? Number(daysInactive) : 7;
      const maxResults = Number(limit) > 0 ? Number(limit) : 50;

      // 1. Fetch all active memberships
      const membershipsSnapshot = await getMembershipsCollection()
        .where('status', '==', 'active')
        .get();

      if (membershipsSnapshot.empty) {
        return {
          members: [],
          total: 0,
          summary: {
            totalInactive: 0,
            criticalCount: 0,
            urgentCount: 0,
            moderateCount: 0,
            neverAttendedCount: 0,
          },
          daysInactiveThreshold: thresholdDays,
        };
      }

      // Group active memberships by user (latest membership per user)
      const activeMembershipsByUser = new Map();
      membershipsSnapshot.forEach((doc) => {
        const mem = { membershipId: doc.id, ...doc.data() };
        // Check not expired: endDate must be in future (or today)
        const endDate = toDate(mem.endDate);
        if (endDate && endDate.getTime() >= now.getTime()) {
          const existing = activeMembershipsByUser.get(mem.userId);
          if (!existing || new Date(mem.createdAt || mem.startDate || 0) > new Date(existing.createdAt || existing.startDate || 0)) {
            activeMembershipsByUser.set(mem.userId, mem);
          }
        }
      });

      if (activeMembershipsByUser.size === 0) {
        return {
          members: [],
          total: 0,
          summary: {
            totalInactive: 0,
            criticalCount: 0,
            urgentCount: 0,
            moderateCount: 0,
            neverAttendedCount: 0,
          },
          daysInactiveThreshold: thresholdDays,
        };
      }

      // 2. Fetch user profiles and evaluate inactivity
      const inactiveMembers = [];
      let criticalCount = 0;
      let urgentCount = 0;
      let moderateCount = 0;
      let neverAttendedCount = 0;

      for (const [userId, membership] of activeMembershipsByUser.entries()) {
        const userDoc = await getUsersCollection().doc(userId).get();
        if (!userDoc.exists) continue;

        const userData = userDoc.data();

        // Must be a member (exclude staff accounts)
        if (userData.role && userData.role !== 'member') continue;

        // Account must be active (exclude pending, suspended, rejected)
        const accountStatus = userData.approvalStatus || userData.status || 'active';
        if (accountStatus !== 'active') continue;

        // Determine absence
        let daysAbsent = 0;
        let neverAttended = false;
        let lastVisitIso = null;
        let lastVisitDateStr = null;

        const lastCheckIn = toDate(userData.lastCheckIn);
        if (lastCheckIn) {
          lastVisitIso = lastCheckIn.toISOString();
          lastVisitDateStr = userData.lastCheckInDate || lastCheckIn.toISOString().split('T')[0];
          const msAbsent = now.getTime() - lastCheckIn.getTime();
          daysAbsent = Math.floor(msAbsent / (24 * 60 * 60 * 1000));
        } else if (userData.lastCheckInDate) {
          lastVisitDateStr = userData.lastCheckInDate;
          const parsed = new Date(userData.lastCheckInDate + 'T00:00:00.000Z');
          const msAbsent = now.getTime() - parsed.getTime();
          daysAbsent = Math.floor(msAbsent / (24 * 60 * 60 * 1000));
        } else {
          // Member has never checked in since joining
          neverAttended = true;
          const joinDate = toDate(membership.startDate) || toDate(userData.createdAt) || now;
          const msAbsent = now.getTime() - joinDate.getTime();
          daysAbsent = Math.max(0, Math.floor(msAbsent / (24 * 60 * 60 * 1000)));
        }

        // Only include if absent for at least thresholdDays (default 7)
        if (daysAbsent >= thresholdDays) {
          let urgency = 'moderate';
          if (daysAbsent >= 21) {
            urgency = 'critical';
            criticalCount++;
          } else if (daysAbsent >= 14) {
            urgency = 'urgent';
            urgentCount++;
          } else {
            urgency = 'moderate';
            moderateCount++;
          }

          if (neverAttended) {
            neverAttendedCount++;
          }

          const endDate = toDate(membership.endDate);
          const daysLeft = endDate ? Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))) : 0;

          inactiveMembers.push({
            userId,
            fullName: userData.fullName || userData.displayName || userData.name || userData.email?.split('@')[0] || 'Gym Member',
            email: userData.email || null,
            phone: userData.phone || null,
            avatarUrl: userData.avatarUrl || userData.photoURL || null,
            activeMembershipId: membership.membershipId,
            planId: membership.planId,
            planName: membership.planName || 'Active Plan',
            membershipStartDate: membership.startDate,
            membershipEndDate: membership.endDate,
            daysLeft,
            lastCheckIn: lastVisitIso,
            lastCheckInDate: lastVisitDateStr,
            daysAbsent,
            urgency,
            neverAttended,
            streakDays: userData.streakDays || 0,
            lastFollowUp: userData.lastFollowUp || null,
          });
        }
      }

      // Sort chronologically descending by daysAbsent (most absent first)
      inactiveMembers.sort((a, b) => b.daysAbsent - a.daysAbsent);

      const paginatedMembers = inactiveMembers.slice(0, maxResults);

      return {
        members: paginatedMembers,
        total: inactiveMembers.length,
        summary: {
          totalInactive: inactiveMembers.length,
          criticalCount,
          urgentCount,
          moderateCount,
          neverAttendedCount,
        },
        daysInactiveThreshold: thresholdDays,
      };
    },

    /**
     * Record a retention follow-up outreach for an inactive member.
     *
     * @param {string} memberId - Target member user ID
     * @param {string} staffId - UID of staff/owner recording the follow-up
     * @param {Object} data - { channel: 'whatsapp' | 'call' | 'in_person', notes: string, outcome?: string }
     * @returns {Promise<Object>} Created follow-up log record
     */
    async recordMemberFollowUp(memberId, staffId, data = {}) {
      if (!memberId) {
        throw new BadRequestError('Member ID is required');
      }

      // 1. Verify user exists
      const userDoc = await getUsersCollection().doc(memberId).get();
      if (!userDoc.exists) {
        throw new NotFoundError(`Member not found with ID: ${memberId}`);
      }

      const now = new Date().toISOString();
      const channel = data.channel || 'whatsapp';
      const notes = data.notes?.trim() || 'Outreach sent to inactive member';
      const outcome = data.outcome || 'contacted';

      const logData = {
        userId: memberId,
        memberId,
        type: 'inactive_followup',
        channel,
        notes,
        outcome,
        status: 'sent',
        sentBy: staffId || 'staff',
        sentAt: now,
        createdAt: now,
        updatedAt: now,
      };

      const docRef = await getReminderLogsCollection().add(logData);

      // Update member's lastFollowUp summary
      const followUpSummary = {
        logId: docRef.id,
        sentAt: now,
        channel,
        notes,
        sentBy: staffId || 'staff',
      };

      await getUsersCollection().doc(memberId).set(
        {
          lastFollowUp: followUpSummary,
          updatedAt: now,
        },
        { merge: true }
      );

      return {
        logId: docRef.id,
        ...logData,
      };
    },
  };
};

export const memberService = createMemberService();

