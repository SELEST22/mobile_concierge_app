/**
 * Small HTTP helpers: wrap async handlers so thrown errors reach the error
 * middleware, and validate request bodies with a zod schema.
 */
import type { NextFunction, Request, Response } from 'express';
import type { ZodSchema } from 'zod';

type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

/** Forwards rejected promises to Express's error handler. */
export const asyncHandler =
  (fn: AsyncHandler) => (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(fn(req, res, next)).catch(next);

/** Parses & validates `req.body`, returning typed data or sending a 400. */
export function parseBody<T>(schema: ZodSchema<T>, req: Request, res: Response): T | null {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: 'Validation failed', details: result.error.flatten() });
    return null;
  }
  return result.data;
}
