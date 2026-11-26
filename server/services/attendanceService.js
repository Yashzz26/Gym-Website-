/**
 * services/attendanceService.js — Secure Attendance Check-in & Streak Service (Day 17 Task 34)
 *
 * Implements atomic attendance validation & recording conforming to:
 * - HMAC token signature, TTL expiration & nonce replay prevention (qrService)
 * - User existence & active account status verification
 * - Active membership validity verification
 * - Duplicate check-in prevention (one check-in per member per calendar day)
 * - Server-controlled timestamp (Asia/Kolkata) & session determination
 * - Consecutive workout streak tracking
 * - Firestore transaction execution for atomic integrity
 */

import { db as defaultDb } from '../config/firebase.js';
import { qrService as defaultQrService } from './qrService.js';
import { resolveRelatedUserIds } from '../utils/userResolver.js';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../utils/errors.js';

export const TIMEZONE = 'Asia/Kolkata';

/**
 * Format a Date to 'YYYY-MM-DD' in specified timezone
 */
export function getFormattedDate(date = new Date(), timeZone = TIMEZONE) {
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(date);
}

/**
 * Determine operating session from date and timezone
 */
export function determineSession(date = new Date(), timeZone = TIMEZONE) {
  const timeString = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);

  const [hours, minutes] = timeString.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes;

  // Morning session: 05:00 - 13:00 (300 to 779 mins)
  if (totalMinutes >= 300 && totalMinutes < 780) {
    return 'Morning Session';
  }
  // Evening session: 16:00 - 23:00 (960 to 1379 mins)
  if (totalMinutes >= 960 && totalMinutes < 1380) {
    return 'Evening Session';
  }
  return 'General Session';
}

export const createAttendanceService = (
  customDb = defaultDb,
  customQrService = defaultQrService
) => {
  const getCollection = (name) => {
    if (!customDb) throw new Error('[AttendanceService] Firestore DB is not initialized');
    return customDb.collection(name);
  };

  return {
    /**
     * Record an atomic attendance check-in for a member.
     *
     * @param {string} userId - Authenticated member's UID
     * @param {string} tokenString - Scanned gym rotating QR token
     * @param {string} [gymId='fitmax-main'] - Gym identifier
     * @returns {Promise<Object>} Definitive check-in confirmation
     */
    async recordCheckIn(userId, tokenString, gymId = 'fitmax-main', userEmail = null) {
      if (!userId) {
        throw new BadRequestError('User ID is required for check-in');
      }
      if (!tokenString) {
        throw new BadRequestError('QR token is required for check-in');
      }

      const { primaryUserId } = await resolveRelatedUserIds(customDb, userId, userEmail);
      const effectiveUserId = primaryUserId || userId;

      // 1. Validate & consume QR token first via qrService (verifies HMAC signature, TTL, and replay)
      const tokenVerification = await customQrService.verifyAndConsumeToken(
        tokenString,
        effectiveUserId,
        gymId
      );
      const { payload } = tokenVerification;

      // 2. Server-controlled timestamp & calendar date (NEVER client-supplied)
      const now = new Date();
      const serverTimestamp = now.toISOString();
      const todayDateStr = getFormattedDate(now);
      const session = determineSession(now);

      const usersCol = getCollection('users');
      const membershipsCol = getCollection('memberships');
      const attendanceCol = getCollection('attendance');

      // Unique document ID enforcing 1 check-in per member per calendar day
      const attendanceDocId = `att_${effectiveUserId}_${todayDateStr}`;
      const attDocRef = attendanceCol.doc(attendanceDocId);
      const userDocRef = usersCol.doc(effectiveUserId);

      let recordResult = null;

      const runCheckInTransaction = async (transaction) => {
        // Read 1: Check duplicate attendance for today
        const existingAttDoc = await transaction.get(attDocRef);
        if (existingAttDoc.exists) {
          throw new ConflictError('Attendance already recorded today for this member');
        }

        // Read 2: Fetch user profile
        const userDoc = await transaction.get(userDocRef);
        if (!userDoc.exists) {
          throw new NotFoundError('User profile not found');
        }

        const userData = userDoc.data();

        // Validate account approval status
        if (userData.approvalStatus && userData.approvalStatus !== 'active') {
          throw new ForbiddenError(
            `Account access restricted. Approval status: ${userData.approvalStatus}`
          );
        }

        // Read 3: Check active membership
        let activeMembership = null;
        let activeMembershipId = userData.activeMembershipId || null;

        if (activeMembershipId) {
          const memDoc = await transaction.get(membershipsCol.doc(activeMembershipId));
          if (memDoc.exists) {
            const data = memDoc.data();
            const isNotExpired = !data.endDate || new Date(data.endDate).getTime() >= now.getTime();
            if (data.status === 'active' && isNotExpired) {
              activeMembership = { id: memDoc.id, ...data };
            }
          }
        }

        // If not found via activeMembershipId, check fallback lookup
        if (!activeMembership) {
          const membershipsSnap = await membershipsCol
            .where('userId', '==', effectiveUserId)
            .where('status', '==', 'active')
            .get();

          if (!membershipsSnap.empty) {
            for (const doc of membershipsSnap.docs) {
              const data = doc.data();
              const isNotExpired = !data.endDate || new Date(data.endDate).getTime() >= now.getTime();
              if (isNotExpired) {
                activeMembership = { id: doc.id, ...data };
                activeMembershipId = doc.id;
                break;
              }
            }
          }
        }

        // Enforce active membership requirement (allow staff or active members)
        const isStaff = userData.role === 'owner' || userData.role === 'reception' || userData.role === 'trainer';
        if (!activeMembership && !isStaff) {
          throw new ForbiddenError(
            'Active gym membership required to check in. Please renew or purchase a plan.'
          );
        }

        // 4. Calculate streak
        const prevStreak = Number(userData.streakDays) || 0;
        const lastCheckInDate = userData.lastCheckInDate;

        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const yesterdayDateStr = getFormattedDate(yesterday);

        let streakDays = 1;
        if (lastCheckInDate === yesterdayDateStr) {
          streakDays = prevStreak + 1;
        } else if (lastCheckInDate === todayDateStr) {
          streakDays = prevStreak || 1;
        }

        // 5. Build attendance document
        const attendanceData = {
          attendanceId: attendanceDocId,
          checkInId: attendanceDocId,
          userId: effectiveUserId,
          memberId: effectiveUserId,
          memberName: userData.displayName || userData.name || userData.email?.split('@')[0] || 'Member',
          memberEmail: userData.email || null,
          gymId: payload.gymId || gymId,
          session,
          timestamp: serverTimestamp,
          date: todayDateStr,
          streakDays,
          membershipId: activeMembershipId || null,
          planName: activeMembership?.planName || null,
          nonce: payload.nonce,
          method: 'qr',
          createdAt: serverTimestamp,
        };

        // Write 1: Record attendance
        transaction.set(attDocRef, attendanceData);

        // Write 2: Update user streak & check-in metadata
        transaction.update(userDocRef, {
          lastCheckIn: serverTimestamp,
          lastCheckInDate: todayDateStr,
          streakDays,
          updatedAt: serverTimestamp,
        });

        recordResult = attendanceData;
      };

      if (typeof customDb.runTransaction === 'function') {
        await customDb.runTransaction(runCheckInTransaction);
      } else {
        // Fallback for mock environments lacking transaction support
        const mockTransaction = {
          get: (docRef) => docRef.get(),
          set: (docRef, data) => docRef.set(data),
          update: (docRef, patch) => docRef.update(patch),
        };
        await runCheckInTransaction(mockTransaction);
      }

      return recordResult;
    },

    /**
     * Get member's personal attendance history
     *
     * @param {string} userId
     * @param {number} [limit=30]
     * @returns {Promise<Array<Object>>}
     */
    async getMemberHistory(userId, limit = 30, userEmail = null) {
      const { primaryUserId } = await resolveRelatedUserIds(customDb, userId, userEmail);
      const effectiveUserId = primaryUserId || userId;

      const snap = await getCollection('attendance')
        .where('userId', '==', effectiveUserId)
        .orderBy('timestamp', 'desc')
        .limit(limit)
        .get();

      const results = [];
      snap.forEach((doc) => {
        results.push({ id: doc.id, ...doc.data() });
      });

      return results;
    },

    /**
     * Get gym attendance for a specific date (defaults to today)
     *
     * @param {string} [dateStr] - YYYY-MM-DD
     * @param {string} [gymId='fitmax-main']
     * @returns {Promise<Object>}
     */
    async getTodayAttendance(dateStr = getFormattedDate(), gymId = 'fitmax-main') {
      const snap = await getCollection('attendance')
        .where('date', '==', dateStr)
        .get();

      const records = [];
      let morningCount = 0;
      let eveningCount = 0;
      let generalCount = 0;

      snap.forEach((doc) => {
        const item = { id: doc.id, ...doc.data() };
        if (!gymId || item.gymId === gymId) {
          records.push(item);
          if (item.session === 'Morning Session') morningCount++;
          else if (item.session === 'Evening Session') eveningCount++;
          else generalCount++;
        }
      });

      return {
        date: dateStr,
        gymId,
        totalCount: records.length,
        morningCount,
        eveningCount,
        generalCount,
        records,
      };
    },
  };
};

export const attendanceService = createAttendanceService();
export default attendanceService;
