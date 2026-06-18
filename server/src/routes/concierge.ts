/**
 * Concierge / security request routes (basic in this pass).
 *
 *   POST /concierge   raise a request
 *   GET  /concierge   list my requests
 *
 * Next pass: admin queue, status transitions, QR-linked location, realtime chat.
 */
import { Router } from 'express';
import { z } from 'zod';
import { many, one } from '../db.js';
import { requireAuth } from '../lib/auth.js';
import { asyncHandler, parseBody } from '../lib/http.js';

export const conciergeRouter = Router();

const createSchema = z.object({
  category: z.enum(['concierge', 'security', 'maintenance', 'other']).default('concierge'),
  details: z.string().trim().min(1).max(2000),
});

conciergeRouter.use(requireAuth);

conciergeRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = parseBody(createSchema, req, res);
    if (!data) return;

    const row = await one(
      `INSERT INTO concierge_requests (user_id, category, details)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [req.user!.id, data.category, data.details],
    );
    res.status(201).json(row);
  }),
);

conciergeRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const rows = await many(
      'SELECT * FROM concierge_requests WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user!.id],
    );
    res.json(rows);
  }),
);
