/**
 * routes/auth.js — Authentication Endpoints
 *
 * Provides endpoints for token verification and authentication checks.
 */

import { Router } from 'express';
import { verifyToken } from '../middleware/auth.js';

const router = Router();

/**
 * POST /api/auth/verify-token
 * Verifies the incoming Firebase ID token and returns authenticated user details.
 */
router.post('/verify-token', verifyToken, (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Authentication token verified successfully',
    user: {
      uid: req.user.uid,
      email: req.user.email,
      emailVerified: req.user.emailVerified,
    },
  });
});

export default router;

