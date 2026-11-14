/**
 * services/paymentService.js — Payment Processing & Razorpay Orders Service
 *
 * Enforces server-side price validation, checks for overlapping active memberships,
 * requires explicit renewal policy, and persists pending payment records.
 */

import { db as defaultDb } from '../config/firebase.js';
import { razorpayClient as defaultRazorpay } from '../config/razorpay.js';
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from '../utils/errors.js';

export const createPaymentService = (
  customDb = defaultDb,
  customRazorpay = defaultRazorpay
) => {
  const getUsersCollection = () => {
    if (!customDb) throw new Error('[PaymentService] Firestore DB is not initialized');
    return customDb.collection('users');
  };

  const getPlansCollection = () => {
    if (!customDb) throw new Error('[PaymentService] Firestore DB is not initialized');
    return customDb.collection('membershipPlans');
  };

  const getMembershipsCollection = () => {
    if (!customDb) throw new Error('[PaymentService] Firestore DB is not initialized');
    return customDb.collection('memberships');
  };

  const getPaymentsCollection = () => {
    if (!customDb) throw new Error('[PaymentService] Firestore DB is not initialized');
    return customDb.collection('payments');
  };

  return {
    /**
     * Create an authenticated Razorpay order for membership purchase or renewal.
     *
     * @param {string} userId - Authenticated user UID
     * @param {Object} data - { planId, isRenewal, notes }
     * @returns {Promise<Object>} Razorpay order payload + public key
     */
    async createRazorpayOrder(userId, data) {
      const { planId, isRenewal = false, notes = {} } = data;

      // 1. Verify user profile exists
      const userDoc = await getUsersCollection().doc(userId).get();
      if (!userDoc.exists) {
        throw new NotFoundError(`User '${userId}' not found`);
      }

      // 2. Fetch and validate plan from database (NEVER accept trusted amount from client)
      const planDoc = await getPlansCollection().doc(planId).get();
      if (!planDoc.exists) {
        throw new NotFoundError(`Membership plan '${planId}' not found`);
      }

      const plan = planDoc.data();
      if (plan.isActive === false) {
        throw new BadRequestError('Cannot purchase an inactive membership plan');
      }

      const amountInPaise = plan.priceInPaise;
      if (!amountInPaise || typeof amountInPaise !== 'number' || amountInPaise <= 0) {
        throw new BadRequestError('Invalid plan price configuration in database');
      }

      // 3. Check for overlapping active membership periods
      const membershipsSnapshot = await getMembershipsCollection()
        .where('userId', '==', userId)
        .get();

      const now = new Date();
      let activeMembership = null;

      membershipsSnapshot.forEach((doc) => {
        const m = doc.data();
        if (m.status === 'active' && m.endDate) {
          const endDate = new Date(m.endDate);
          if (endDate > now) {
            activeMembership = { id: doc.id, ...m };
          }
        }
      });

      // If active membership exists and user did not specify renewal policy, block overlapping purchase
      if (activeMembership && !isRenewal) {
        throw new ConflictError(
          `User already has an active membership ending on ${activeMembership.endDate}. Explicit renewal extension required.`,
          {
            activeMembershipId: activeMembership.id,
            endDate: activeMembership.endDate,
            requireRenewalFlag: true,
          }
        );
      }

      // 4. Create Razorpay order on server
      const receiptId = `rcpt_${Date.now().toString().slice(-8)}_${userId.slice(0, 6)}`;
      const orderParams = {
        amount: amountInPaise,
        currency: 'INR',
        receipt: receiptId,
        notes: {
          userId,
          planId: plan.planId || planId,
          planName: plan.name,
          isRenewal: String(isRenewal),
          existingMembershipId: activeMembership ? activeMembership.id : '',
          ...notes,
        },
      };

      const order = await customRazorpay.orders.create(orderParams);

      // 5. Persist pending transaction in `payments` collection
      const nowIso = now.toISOString();
      const paymentRecord = {
        userId,
        planId: plan.planId || planId,
        planName: plan.name,
        amountInPaise,
        currency: 'INR',
        method: 'razorpay',
        status: 'pending',
        razorpayOrderId: order.id,
        isRenewal: Boolean(isRenewal),
        existingMembershipId: activeMembership ? activeMembership.id : null,
        notes: notes || {},
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      const paymentDocRef = await getPaymentsCollection().add(paymentRecord);

      return {
        orderId: order.id,
        paymentId: paymentDocRef.id,
        amount: amountInPaise,
        currency: 'INR',
        keyId: customRazorpay.keyId || process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder',
        plan: {
          planId: plan.planId || planId,
          name: plan.name,
          durationDays: plan.durationDays,
        },
        isRenewal: Boolean(isRenewal),
      };
    },

    /**
     * Retrieve a payment by ID
     */
    async getPaymentById(paymentId) {
      if (!paymentId) throw new BadRequestError('Payment ID is required');

      const doc = await getPaymentsCollection().doc(paymentId).get();
      if (!doc.exists) {
        throw new NotFoundError(`Payment record '${paymentId}' not found`);
      }

      return { paymentId: doc.id, ...doc.data() };
    },
  };
};

export const paymentService = createPaymentService();
export default paymentService;

