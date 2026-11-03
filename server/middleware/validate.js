/**
 * middleware/validate.js — Request validation middleware using Zod
 *
 * Validates req.body, req.query, and/or req.params against Zod schemas.
 * Replaces request targets with parsed and sanitized values on success,
 * or forwards a ZodError to the centralized error handler on failure.
 */

/**
 * Creates an Express middleware that validates request data against provided Zod schemas.
 *
 * @param {Object} schemas
 * @param {import('zod').ZodTypeAny} [schemas.body] - Schema for req.body
 * @param {import('zod').ZodTypeAny} [schemas.query] - Schema for req.query
 * @param {import('zod').ZodTypeAny} [schemas.params] - Schema for req.params
 * @returns {import('express').RequestHandler}
 *
 * @example
 * router.post('/login', validate({ body: loginSchema }), loginHandler);
 */
export const validate = (schemas = {}) => {
  return async (req, _res, next) => {
    try {
      if (schemas.params) {
        req.params = await schemas.params.parseAsync(req.params);
      }
      if (schemas.query) {
        req.query = await schemas.query.parseAsync(req.query);
      }
      if (schemas.body) {
        req.body = await schemas.body.parseAsync(req.body);
      }
      next();
    } catch (error) {
      next(error);
    }
  };
};

export default validate;
