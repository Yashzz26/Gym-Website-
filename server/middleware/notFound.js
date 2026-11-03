/**
 * middleware/notFound.js — 404 Not Found handler
 *
 * Catch-all middleware for routes that do not match any defined endpoint.
 */

import { NotFoundError } from '../utils/errors.js';

export const notFound = (req, _res, next) => {
  next(new NotFoundError(`Route not found: ${req.method} ${req.originalUrl || req.url}`));
};

export default notFound;

