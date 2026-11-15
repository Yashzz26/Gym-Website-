/**
 * services/paymentService.js — Payment Processing & Razorpay Orders Service
 *
 * Enforces server-side price validation, checks for overlapping active memberships,
 * requires explicit renewal policy, and persists pending payment records.
 */

import crypto from 'node:crypto';
import { db as defaultDb } from '../config/firebase.js';
import { razorpayClient as defaultRazorpay } from '../config/razorpay.js';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
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

  const getWebhookEventsCollection = () => {
    if (!customDb) throw new Error('[PaymentService] Firestore DB is not initialized');
    return customDb.collection('webhookEvents');
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
     * Verify Razorpay payment signature and activate membership idempotently.
     *
     * @param {string} userId - Authenticated user UID
     * @param {Object} data - { razorpay_payment_id, razorpay_order_id, razorpay_signature }
     * @returns {Promise<Object>} Verified payment and activated membership details
     */
    async verifyRazorpayPayment(userId, data) {
      const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = data;

      // 1. Verify cryptographic signature using constant-time comparison
      const secret =
        customRazorpay.keySecret ||
        process.env.RAZORPAY_KEY_SECRET ||
        'rzp_test_mock_secret';

      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');

      const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
      const actualBuffer = Buffer.from(razorpay_signature, 'utf8');

      const isSignatureValid =
        expectedBuffer.length === actualBuffer.length &&
        crypto.timingSafeEqual(expectedBuffer, actualBuffer);

      if (!isSignatureValid) {
        throw new BadRequestError('Invalid Razorpay payment signature');
      }

      // 2. Fetch corresponding payment record by razorpayOrderId
      const querySnap = await getPaymentsCollection()
        .where('razorpayOrderId', '==', razorpay_order_id)
        .get();

      let paymentDoc = null;
      querySnap.forEach((doc) => {
        paymentDoc = { id: doc.id, ...doc.data() };
      });

      if (!paymentDoc) {
        throw new NotFoundError(
          `Payment record not found for Razorpay order '${razorpay_order_id}'`
        );
      }

      // Security check: ensure payment belongs to authenticated user
      if (paymentDoc.userId !== userId) {
        throw new ForbiddenError('You can only verify your own payment records');
      }

      // 3. Idempotency Check: if already captured, return existing record safely
      if (paymentDoc.status === 'captured') {
        let existingMembership = null;
        if (paymentDoc.membershipId) {
          const mDoc = await getMembershipsCollection()
            .doc(paymentDoc.membershipId)
            .get();
          if (mDoc.exists) {
            existingMembership = { membershipId: mDoc.id, ...mDoc.data() };
          }
        }

        return {
          status: 'success',
          idempotent: true,
          message: 'Payment has already been verified and processed',
          payment: paymentDoc,
          membership: existingMembership,
        };
      }

      // 4. Activate membership and mark payment captured
      const nowIso = new Date().toISOString();
      const planDoc = await getPlansCollection().doc(paymentDoc.planId).get();
      if (!planDoc.exists) {
        throw new NotFoundError(`Plan '${paymentDoc.planId}' not found`);
      }
      const plan = planDoc.data();
      const durationDays = plan.durationDays || 30;

      // Calculate start and end dates
      let startDate = nowIso;
      if (paymentDoc.isRenewal && paymentDoc.existingMembershipId) {
        const prevDoc = await getMembershipsCollection()
          .doc(paymentDoc.existingMembershipId)
          .get();
        if (prevDoc.exists) {
          const prevData = prevDoc.data();
          const prevEndDate = new Date(prevData.endDate);
          if (prevData.status === 'active' && prevEndDate > new Date()) {
            startDate = prevEndDate.toISOString();
          }
          await getMembershipsCollection().doc(paymentDoc.existingMembershipId).update({
            renewedAt: nowIso,
            updatedAt: nowIso,
          });
        }
      }

      const endDate = new Date(
        new Date(startDate).getTime() + durationDays * 24 * 60 * 60 * 1000
      ).toISOString();

      const newMembershipData = {
        userId,
        planId: paymentDoc.planId,
        planName: paymentDoc.planName,
        durationDays,
        priceInPaise: paymentDoc.amountInPaise,
        startDate,
        endDate,
        status: 'active',
        paymentStatus: 'paid',
        paymentId: paymentDoc.id,
        paymentMethod: 'razorpay',
        renewedFrom: paymentDoc.isRenewal ? paymentDoc.existingMembershipId : null,
        createdBy: userId,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      const newMembershipDoc = await getMembershipsCollection().add(newMembershipData);
      const newMembershipId = newMembershipDoc.id;

      // Update previous membership link if renewal
      if (paymentDoc.isRenewal && paymentDoc.existingMembershipId) {
        await getMembershipsCollection().doc(paymentDoc.existingMembershipId).update({
          nextMembershipId: newMembershipId,
        });
      }

      // Update payment record to captured
      const updatedPaymentData = {
        status: 'captured',
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature,
        membershipId: newMembershipId,
        verifiedAt: nowIso,
        updatedAt: nowIso,
      };

      await getPaymentsCollection().doc(paymentDoc.id).update(updatedPaymentData);

      // Update user document
      await getUsersCollection().doc(userId).set(
        {
          membershipStatus: 'active',
          activeMembershipId: newMembershipId,
          updatedAt: nowIso,
        },
        { merge: true }
      );

      return {
        status: 'success',
        idempotent: false,
        message: 'Payment verified and membership activated successfully',
        payment: { ...paymentDoc, ...updatedPaymentData },
        membership: { membershipId: newMembershipId, ...newMembershipData },
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

    /**
     * Process verified Razorpay webhook event with raw-body signature verification,
     * event deduplication, and safe payment & membership activation.
     *
     * @param {Buffer|string} rawBody - Raw unparsed request body
     * @param {string} signature - Header 'x-razorpay-signature'
     * @param {Object} eventPayload - Parsed webhook payload JSON
     * @returns {Promise<Object>}
     */
    async handleRazorpayWebhook(rawBody, signature, eventPayload) {
      // 1. Verify webhook signature against raw request body
      const webhookSecret =
        customRazorpay.webhookSecret ||
        process.env.RAZORPAY_WEBHOOK_SECRET ||
        'rzp_webhook_secret_test';

      if (!signature) {
        throw new BadRequestError('Missing x-razorpay-signature header');
      }

      if (!rawBody) {
        throw new BadRequestError('Raw request body missing for webhook signature verification');
      }

      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(rawBody)
        .digest('hex');

      const expectedBuf = Buffer.from(expectedSignature, 'utf8');
      const actualBuf = Buffer.from(signature, 'utf8');

      const isValid =
        expectedBuf.length === actualBuf.length &&
        crypto.timingSafeEqual(expectedBuf, actualBuf);

      if (!isValid) {
        throw new BadRequestError('Invalid Razorpay webhook signature');
      }

      // 2. Event deduplication: check if event.id was already processed
      const eventId = eventPayload?.id;
      if (!eventId) {
        throw new BadRequestError('Invalid webhook payload: missing event.id');
      }

      const existingEventDoc = await getWebhookEventsCollection().doc(eventId).get();
      if (existingEventDoc.exists) {
        return {
          status: 'success',
          idempotent: true,
          message: `Webhook event '${eventId}' already processed`,
        };
      }

      const eventName = eventPayload.event;
      const paymentEntity = eventPayload.payload?.payment?.entity;
      const nowIso = new Date().toISOString();

      // 3. Process captured payment events safely
      if (eventName === 'payment.captured' && paymentEntity) {
        const orderId = paymentEntity.order_id;
        const razorpayPaymentId = paymentEntity.id;

        const querySnap = await getPaymentsCollection()
          .where('razorpayOrderId', '==', orderId)
          .get();

        let paymentDoc = null;
        querySnap.forEach((doc) => {
          paymentDoc = { id: doc.id, ...doc.data() };
        });

        if (paymentDoc && paymentDoc.status !== 'captured') {
          const userId = paymentDoc.userId;
          const planDoc = await getPlansCollection().doc(paymentDoc.planId).get();

          if (planDoc.exists) {
            const plan = planDoc.data();
            const durationDays = plan.durationDays || 30;

            let startDate = nowIso;
            if (paymentDoc.isRenewal && paymentDoc.existingMembershipId) {
              const prevDoc = await getMembershipsCollection()
                .doc(paymentDoc.existingMembershipId)
                .get();
              if (prevDoc.exists) {
                const prevData = prevDoc.data();
                const prevEndDate = new Date(prevData.endDate);
                if (prevData.status === 'active' && prevEndDate > new Date()) {
                  startDate = prevEndDate.toISOString();
                }
                await getMembershipsCollection().doc(paymentDoc.existingMembershipId).update({
                  renewedAt: nowIso,
                  updatedAt: nowIso,
                });
              }
            }

            const endDate = new Date(
              new Date(startDate).getTime() + durationDays * 24 * 60 * 60 * 1000
            ).toISOString();

            const newMembershipDoc = await getMembershipsCollection().add({
              userId,
              planId: paymentDoc.planId,
              planName: paymentDoc.planName,
              durationDays,
              priceInPaise: paymentDoc.amountInPaise,
              startDate,
              endDate,
              status: 'active',
              paymentStatus: 'paid',
              paymentId: paymentDoc.id,
              paymentMethod: 'razorpay',
              renewedFrom: paymentDoc.isRenewal ? paymentDoc.existingMembershipId : null,
              createdBy: userId,
              createdAt: nowIso,
              updatedAt: nowIso,
            });

            await getPaymentsCollection().doc(paymentDoc.id).update({
              status: 'captured',
              razorpayPaymentId,
              membershipId: newMembershipDoc.id,
              verifiedAt: nowIso,
              updatedAt: nowIso,
            });

            await getUsersCollection().doc(userId).set(
              {
                membershipStatus: 'active',
                activeMembershipId: newMembershipDoc.id,
                updatedAt: nowIso,
              },
              { merge: true }
            );
          }
        }
      }

      // 4. Record event for deduplication
      await getWebhookEventsCollection().doc(eventId).set({
        eventId,
        event: eventName,
        orderId: paymentEntity?.order_id || null,
        paymentId: paymentEntity?.id || null,
        processedAt: nowIso,
        status: 'processed',
      });

      return {
        status: 'success',
        idempotent: false,
        message: `Webhook event '${eventName}' processed successfully`,
      };
    },
  };
};

export const paymentService = createPaymentService();
export default paymentService;

