/**
 * controllers/paymentController.js — Controller for Payments & Razorpay Orders
 */

import { paymentService as defaultService } from '../services/paymentService.js';
import { ForbiddenError } from '../utils/errors.js';

export const createPaymentController = (service = defaultService) => {
  return {
    async createRazorpayOrder(req, res, next) {
      try {
        const userId = req.user?.uid;
        const result = await service.createRazorpayOrder(userId, req.body);

        res.status(201).json({
          status: 'success',
          message: 'Razorpay order created successfully',
          data: result,
        });
      } catch (err) {
        next(err);
      }
    },

    async getPayment(req, res, next) {
      try {
        const user = req.user;
        const role = req.profile?.role || user?.claims?.role || 'member';
        const isStaff = ['owner', 'reception', 'trainer'].includes(role);
        const { id: paymentId } = req.params;

        const result = await service.getPaymentById(paymentId);

        if (!isStaff && result.userId !== user.uid) {
          throw new ForbiddenError('You can only view your own payment records');
        }

        res.status(200).json({
          status: 'success',
          data: result,
        });
      } catch (err) {
        next(err);
      }
    },
  };
};

export const paymentController = createPaymentController();
export default paymentController;
