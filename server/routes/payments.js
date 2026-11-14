/**
 * routes/payments.js — Payment & Razorpay Routes
 */

import { Router } from 'express';
import { verifyToken as defaultVerifyToken } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createRazorpayOrderSchema } from '../schemas/payment.js';
import { paymentController as defaultController } from '../controllers/paymentController.js';

export const createPaymentsRouter = ({
  controller = defaultController,
  verifyToken = defaultVerifyToken,
} = {}) => {
  const router = Router();

  // Create Razorpay authenticated order
  router.post(
    '/razorpay/order',
    verifyToken,
    validate({ body: createRazorpayOrderSchema }),
    controller.createRazorpayOrder
  );

  // Retrieve payment details
  router.get(
    '/:id',
    verifyToken,
    controller.getPayment
  );

  return router;
};

export const paymentsRouter = createPaymentsRouter();
export default paymentsRouter;
