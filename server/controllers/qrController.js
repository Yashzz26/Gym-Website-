/**
 * controllers/qrController.js — Controller for QR Token Service
 *
 * Implements endpoints for Day 16 Task 31:
 * - GET /api/qr/current  — Returns current active rotating token
 * - POST /api/qr/rotate  — Forces rotation and returns fresh token
 * - POST /api/qr/validate — Validates token signature, expiration and replay status
 * - POST /api/qr/consume  — Atomically consumes token (rejects replay attempts)
 */

import { qrService as defaultService } from '../services/qrService.js';

export const createQrController = (service = defaultService) => {
  return {
    /**
     * GET /api/qr/current
     * Fetch active QR token for reception/owner display.
     */
    async getCurrentToken(req, res, next) {
      try {
        const gymId = req.query.gymId || 'fitmax-main';
        const tokenData = await service.getCurrentToken({ gymId });

        res.status(200).json({
          status: 'success',
          data: tokenData,
        });
      } catch (err) {
        next(err);
      }
    },

    /**
     * POST /api/qr/rotate
     * Manually force-rotate a new token.
     */
    async rotateToken(req, res, next) {
      try {
        const { gymId = 'fitmax-main', ttlSeconds = 60 } = req.body || {};
        const tokenData = await service.generateToken({ gymId, ttlSeconds });

        res.status(201).json({
          status: 'success',
          message: 'Rotating QR token generated successfully',
          data: tokenData,
        });
      } catch (err) {
        next(err);
      }
    },

    /**
     * POST /api/qr/validate
     * Validate token without consuming.
     */
    async validateToken(req, res, next) {
      try {
        const { token, gymId } = req.body;
        const result = await service.validateToken(token, gymId);

        res.status(200).json({
          status: 'success',
          message: 'QR token is valid and active',
          data: result,
        });
      } catch (err) {
        next(err);
      }
    },

    /**
     * POST /api/qr/consume
     * Atomically consume token to test replay rejection or record usage.
     */
    async consumeToken(req, res, next) {
      try {
        const { token, gymId } = req.body;
        const memberId = req.user?.uid || req.body.memberId || null;
        const result = await service.verifyAndConsumeToken(token, memberId, gymId);

        res.status(200).json({
          status: 'success',
          message: 'QR token consumed successfully',
          data: result,
        });
      } catch (err) {
        next(err);
      }
    },
  };
};

export const qrController = createQrController();
export default qrController;
