/**
 * controllers/manualPaymentController.js — Controller for Cash & Manual UPI Payments
 *
 * Handles HTTP request/response for Task 29 (Day 15) manual payment recording.
 * Relies on manualPaymentService for all business logic and Firestore operations.
 */

import { manualPaymentService as defaultService } from '../services/manualPaymentService.js';

export const createManualPaymentController = (service = defaultService) => {
  return {
    /**
     * POST /api/reception/payments
     * Record a new cash or manual UPI payment.
     * Restricted to: reception, owner.
     */
    async recordPayment(req, res, next) {
      try {
        const actorId = req.user?.uid;
        const requestId = req.id || req.headers['x-request-id'] || null;
        const result = await service.recordManualPayment(actorId, req.body, requestId);

        res.status(201).json({
          status: 'success',
          message: 'Manual payment recorded and membership activated successfully',
          data: result,
        });
      } catch (err) {
        next(err);
      }
    },

    /**
     * GET /api/reception/payments
     * List manual payments with optional member/method filters.
     * Restricted to: reception, owner.
     */
    async listPayments(req, res, next) {
      try {
        const actor = { uid: req.user?.uid, role: req.profile?.role || 'reception' };
        const payments = await service.listManualPayments(req.query, actor.uid);

        res.status(200).json({
          status: 'success',
          results: payments.length,
          data: payments,
        });
      } catch (err) {
        next(err);
      }
    },

    /**
     * GET /api/reception/payments/:paymentId
     * Get a single manual payment record.
     * Restricted to: reception, owner.
     */
    async getPayment(req, res, next) {
      try {
        const actor = {
          uid: req.user?.uid,
          role: req.profile?.role || 'reception',
        };
        const { paymentId } = req.params;
        const payment = await service.getManualPayment(paymentId, actor);

        res.status(200).json({
          status: 'success',
          data: payment,
        });
      } catch (err) {
        next(err);
      }
    },
  };
};

export const manualPaymentController = createManualPaymentController();
export default manualPaymentController;
