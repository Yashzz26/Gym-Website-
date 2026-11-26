/**
 * services/manualPaymentService.js — Cash & Manual UPI Payment Recording Service
 *
 * Implements Task 29 (Day 15): Reception desk manual payment recording.
 *
 * Key design decisions:
 * - Server validates plan price; never trusts client-supplied amount.
 * - Each manual payment activates or renews membership immediately (no pending state).
 * - Every payment writes an `auditLogs` record for accounting integrity.
 * - `auditLogs` schema: { actorId, action, targetId, amountPaise, method, timestamp, requestId }
 * - Method 'upi' (manual UPI) is distinct from Razorpay gateway payments.
 */

import { db as defaultDb } from '../config/firebase.js';
import { resolveRelatedUserIds } from '../utils/userResolver.js';
import {
  BadRequestError,
  NotFoundError,
  ConflictError,
} from '../utils/errors.js';

export const createManualPaymentService = (customDb = defaultDb) => {
  const getCollection = (name) => {
    if (!customDb) throw new Error(`[ManualPaymentService] Firestore DB not initialized`);
    return customDb.collection(name);
  };

  /**
   * Write a structured audit log entry for each manual payment.
   * Schema strictly follows the Task 29 ADR definition.
   *
   * @param {Object} params
   * @param {string} params.actorId       - Staff UID performing the action
   * @param {string} params.action        - Action identifier (e.g. 'manual_payment_recorded')
   * @param {string} params.targetId      - Target document ID (payment or membership ID)
   * @param {number} params.amountPaise   - Amount recorded in integer paise
   * @param {string} params.method        - 'cash' | 'upi'
   * @param {string} params.requestId     - Request tracing ID from req.id
   * @param {Object} [params.metadata]    - Optional supplementary metadata
   * @returns {Promise<string>} ID of the created audit log
   */
  async function writeAuditLog({ actorId, action, targetId, amountPaise, method, requestId, metadata = {} }) {
    const nowIso = new Date().toISOString();
    const auditRef = await getCollection('auditLogs').add({
      actorId,
      action,
      targetId,
      amountPaise,
      method,
      timestamp: nowIso,
      requestId: requestId || null,
      metadata,
      createdAt: nowIso,
    });
    return auditRef.id;
  }

  return {
    /**
     * Record a cash or manual UPI payment for a gym membership.
     *
     * Flow:
     * 1. Validate member exists and is eligible.
     * 2. Fetch plan — verify plan is active and amount matches server price.
     * 3. Create payment record (method: cash | upi).
     * 4. Create or renew membership, activating immediately.
     * 5. Update user profile membership status.
     * 6. Write auditLogs entry.
     *
     * @param {string} actorId          - Reception/owner staff UID
     * @param {Object} data             - Validated request body
     * @param {string} requestId        - Request tracing ID
     * @returns {Promise<Object>}       - { payment, membership, auditLogId }
     */
    async recordManualPayment(actorId, data, requestId) {
      const {
        memberId,
        planId,
        method,
        amountPaise,
        upiReference,
        remarks,
        isRenewal = false,
      } = data;

      // 1. Verify member exists
      const memberDoc = await getCollection('users').doc(memberId).get();
      if (!memberDoc.exists) {
        throw new NotFoundError(`Member '${memberId}' not found`);
      }
      const member = memberDoc.data();
      if (member.role !== 'member') {
        throw new BadRequestError(`User '${memberId}' is not a member`);
      }

      // 2. Fetch and validate plan
      const planDoc = await getCollection('membershipPlans').doc(planId).get();
      if (!planDoc.exists) {
        throw new NotFoundError(`Membership plan '${planId}' not found`);
      }
      const plan = planDoc.data();
      if (plan.isActive === false) {
        throw new BadRequestError('Cannot record payment for an inactive membership plan');
      }

      // 3. Server-side price validation — NEVER trust client amount
      const serverPrice = plan.priceInPaise;
      if (!serverPrice || typeof serverPrice !== 'number' || serverPrice <= 0) {
        throw new BadRequestError('Invalid plan price configuration in database');
      }
      if (amountPaise !== serverPrice) {
        throw new BadRequestError(
          `Amount mismatch: received ${amountPaise} paise but plan price is ${serverPrice} paise`
        );
      }

      // 4. Check for existing active membership across related user IDs (conflict guard)
      const { relatedUserIds } = await resolveRelatedUserIds(
        customDb,
        memberId,
        member.email
      );

      const now = new Date();
      let activeMembership = null;

      for (const targetUid of relatedUserIds) {
        const membershipsSnap = await getCollection('memberships')
          .where('userId', '==', targetUid)
          .where('status', '==', 'active')
          .get();

        membershipsSnap.forEach((doc) => {
          const m = doc.data();
          if (m.endDate && new Date(m.endDate) > now) {
            activeMembership = { id: doc.id, ...m };
          }
        });
        if (activeMembership) break;
      }

      if (activeMembership && !isRenewal) {
        throw new ConflictError(
          `Member already has an active membership ending on ${activeMembership.endDate}. Set isRenewal=true to extend.`,
          { activeMembershipId: activeMembership.id, endDate: activeMembership.endDate, requireRenewalFlag: true }
        );
      }

      const nowIso = now.toISOString();

      // 5. Create payment record
      const paymentData = {
        userId: memberId,
        planId: plan.planId || planId,
        planName: plan.name,
        amountPaise,
        currency: 'INR',
        method,                      // 'cash' | 'upi'
        gateway: 'manual',           // Distinct from 'razorpay'
        status: 'captured',          // Manual payments are immediately captured
        isRenewal: Boolean(isRenewal),
        existingMembershipId: activeMembership ? activeMembership.id : null,
        upiReference: upiReference || null,
        remarks: remarks || null,
        recordedBy: actorId,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      const paymentRef = await getCollection('payments').add(paymentData);
      const paymentId = paymentRef.id;

      // 6. Compute membership dates
      let startDate = nowIso;
      if (isRenewal && activeMembership?.endDate) {
        const prevEnd = new Date(activeMembership.endDate);
        if (prevEnd > now) {
          // Extension: start from existing end date
          startDate = prevEnd.toISOString();
        }
      }
      const startMs = new Date(startDate).getTime();
      const durationDays = plan.durationDays || 30;
      const endDate = new Date(startMs + durationDays * 24 * 60 * 60 * 1000).toISOString();

      // 7. Create new membership document
      const membershipData = {
        userId: memberId,
        email: member.email || null,
        planId: plan.planId || planId,
        planName: plan.name,
        durationDays,
        priceInPaise: serverPrice,
        startDate,
        endDate,
        status: 'active',
        paymentStatus: 'paid',
        paymentId,
        paymentMethod: method,
        gateway: 'manual',
        renewedFrom: isRenewal && activeMembership ? activeMembership.id : null,
        createdBy: actorId,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      const membershipRef = await getCollection('memberships').add(membershipData);
      const membershipId = membershipRef.id;

      // 8. Mark previous active membership as renewed (if applicable)
      if (isRenewal && activeMembership) {
        await getCollection('memberships').doc(activeMembership.id).update({
          renewedAt: nowIso,
          updatedAt: nowIso,
        });
      }

      // 9. Update user profile membership status across all related user documents
      for (const uid of relatedUserIds) {
        await getCollection('users').doc(uid).set(
          {
            membershipStatus: 'active',
            activeMembershipId: membershipId,
            updatedAt: nowIso,
          },
          { merge: true }
        );
      }

      // Update payment record with the new membershipId
      await getCollection('payments').doc(paymentId).update({ membershipId });

      // 10. Write audit log
      const auditLogId = await writeAuditLog({
        actorId,
        action: isRenewal ? 'manual_payment_renewal' : 'manual_payment_recorded',
        targetId: paymentId,
        amountPaise,
        method,
        requestId,
        metadata: {
          memberId,
          memberName: member.displayName || null,
          planId: plan.planId || planId,
          planName: plan.name,
          membershipId,
          upiReference: upiReference || null,
          isRenewal: Boolean(isRenewal),
        },
      });

      return {
        payment: { paymentId, ...paymentData, membershipId },
        membership: { membershipId, ...membershipData },
        auditLogId,
      };
    },

    /**
     * List manual payment records for a member or all members.
     *
     * @param {Object} query  - { memberId?, method?, limit, startAfter? }
     * @param {string} actorId - Staff UID performing the query
     * @returns {Promise<Object[]>}
     */
    async listManualPayments(query, actorId) {
      const { memberId, method = 'all', limit = 20 } = query;

      let q = getCollection('payments').where('gateway', '==', 'manual');

      if (memberId) {
        q = q.where('userId', '==', memberId);
      }

      if (method && method !== 'all') {
        q = q.where('method', '==', method);
      }

      const snap = await q.get();
      const payments = [];
      snap.forEach((doc) => {
        payments.push({ id: doc.id, paymentId: doc.id, ...doc.data() });
      });

      // Sort newest first
      payments.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

      return payments.slice(0, Number(limit));
    },

    /**
     * Get a single manual payment by ID, with access control.
     *
     * @param {string} paymentId
     * @param {Object} actor - { uid, role }
     * @returns {Promise<Object>}
     */
    async getManualPayment(paymentId, actor) {
      const doc = await getCollection('payments').doc(paymentId).get();
      if (!doc.exists) {
        throw new NotFoundError(`Payment '${paymentId}' not found`);
      }
      const payment = { id: doc.id, paymentId: doc.id, ...doc.data() };

      // Members can only view their own payments
      const isStaff = ['owner', 'reception', 'trainer'].includes(actor.role);
      if (!isStaff && payment.userId !== actor.uid) {
        throw new NotFoundError(`Payment '${paymentId}' not found`);
      }

      return payment;
    },
  };
};

export const manualPaymentService = createManualPaymentService();
export default manualPaymentService;
