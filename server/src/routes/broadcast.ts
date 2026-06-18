/**
 * Admin broadcast routes — the mass-communication system.
 *
 *   POST   /broadcast       create + send a message to all users
 *   GET    /broadcast       list every broadcast (admin overview)
 *   DELETE /broadcast/:id   remove a broadcast (bonus feature)
 *
 * Sending to "all users" is implicit: a broadcast row is global, and each user
 * picks it up via GET /user/messages. We don't fan out a row per user, which
 * keeps sends O(1) and avoids duplicates no matter how many users exist.
 */
import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import { many, one, run } from '../db.js';
import { requireAdmin, requireAuth } from '../lib/auth.js';
import { asyncHandler, parseBody } from '../lib/http.js';

export const broadcastRouter = Router();

const createSchema = z.object({
  title: z.string().trim().min(1).max(120),
  message: z.string().trim().min(1).max(4000),
  type: z.enum(['emergency', 'general']).default('general'),
  expiresInDays: z.number().int().positive().max(365).optional(),
  // Required: broadcasts are event-scoped. A message reaches only the members
  // of this event — there is no global / all-users send.
  eventId: z.number({ required_error: 'Select an event to send to.' }).int().positive(),
});

// Every route here requires an authenticated admin.
broadcastRouter.use(requireAuth, requireAdmin);

broadcastRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = parseBody(createSchema, req, res);
    if (!data) return;

    const days = data.expiresInDays ?? config.broadcastDefaultDays;

    // The target event must exist before we send to its members.
    const event = await one('SELECT 1 FROM events WHERE id = $1', [data.eventId]);
    if (!event) return res.status(404).json({ error: 'Target event not found' });

    const row = await one(
      `INSERT INTO broadcast_messages (title, message, type, event_id, expires_at, created_by)
       VALUES ($1, $2, $3, $4, now() + make_interval(days => $5), $6)
       RETURNING *`,
      [data.title, data.message, data.type, data.eventId, days, req.user!.id],
    );
    res.status(201).json(row);
  }),
);

broadcastRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const rows = await many('SELECT * FROM broadcast_messages ORDER BY created_at DESC');
    res.json(rows);
  }),
);

broadcastRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const changes = await run('DELETE FROM broadcast_messages WHERE id = $1', [
      Number(req.params.id),
    ]);
    if (changes === 0) return res.status(404).json({ error: 'Broadcast not found' });
    res.json({ ok: true });
  }),
);
