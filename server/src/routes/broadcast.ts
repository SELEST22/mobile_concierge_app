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
import { db } from '../db.js';
import { requireAdmin, requireAuth } from '../lib/auth.js';
import { asyncHandler, parseBody } from '../lib/http.js';

export const broadcastRouter = Router();

const createSchema = z.object({
  title: z.string().trim().min(1).max(120),
  message: z.string().trim().min(1).max(4000),
  type: z.enum(['emergency', 'general']).default('general'),
  expiresInDays: z.number().int().positive().max(365).optional(),
});

// Every route here requires an authenticated admin.
broadcastRouter.use(requireAuth, requireAdmin);

broadcastRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = parseBody(createSchema, req, res);
    if (!data) return;

    const days = data.expiresInDays ?? config.broadcastDefaultDays;
    const info = db
      .prepare(
        `INSERT INTO broadcast_messages (title, message, type, expires_at, created_by)
         VALUES (?, ?, ?, datetime('now', ?), ?)`,
      )
      .run(data.title, data.message, data.type, `+${days} days`, req.user!.id);

    const row = db
      .prepare('SELECT * FROM broadcast_messages WHERE id = ?')
      .get(info.lastInsertRowid);
    res.status(201).json(row);
  }),
);

broadcastRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const rows = db
      .prepare('SELECT * FROM broadcast_messages ORDER BY created_at DESC')
      .all();
    res.json(rows);
  }),
);

broadcastRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const info = db
      .prepare('DELETE FROM broadcast_messages WHERE id = ?')
      .run(Number(req.params.id));
    if (info.changes === 0) return res.status(404).json({ error: 'Broadcast not found' });
    res.json({ ok: true });
  }),
);
