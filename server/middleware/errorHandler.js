/**
 * middleware/errorHandler.js — Centralized structured error handler
 *
 * Catches all errors passed to next(err) and formats them into a consistent,
 * structured JSON payload. Distinguishes between operational errors (AppError,
 * Zod validation) and unhandled programmatic bugs.
 */

import { ZodError } from 'zod';
import { AppError } from '../utils/errors.js';

/**
 * Express error handling middleware (requires 4 parameters)
 */
// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, _next) => {
  const isProduction = process.env.NODE_ENV === 'production';
  const requestId = req.id || req.headers['x-request-id'] || null;

  // 1. Zod Validation Errors
  if (err instanceof ZodError || err.name === 'ZodError') {
    const formattedErrors = err.issues?.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
      code: issue.code,
    })) || [{ message: err.message }];

    return res.status(422).json({
      status: 'error',
      statusCode: 422,
      message: 'Request validation failed',
      errors: formattedErrors,
      requestId,
    });
  }

  // 2. Body-parser JSON Syntax Error (malformed JSON sent by client)
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      status: 'error',
      statusCode: 400,
      message: 'Malformed JSON payload in request body',
      requestId,
    });
  }

  // 3. Operational AppErrors
  if (err instanceof AppError || err.isOperational) {
    const responsePayload = {
      status: err.status || 'error',
      statusCode: err.statusCode || 500,
      message: err.message,
      requestId,
    };

    if (err.details) {
      responsePayload.details = err.details;
    }

    if (!isProduction && err.stack) {
      responsePayload.stack = err.stack;
    }

    return res.status(err.statusCode || 500).json(responsePayload);
  }

  // 4. Unexpected / Unhandled Errors (500)
  console.error('[UNHANDLED ERROR]', {
    requestId,
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
  });

  return res.status(500).json({
    status: 'error',
    statusCode: 500,
    message: isProduction ? 'An unexpected internal error occurred.' : err.message,
    requestId,
    ...(!isProduction && { stack: err.stack }),
  });
};

export default errorHandler;

