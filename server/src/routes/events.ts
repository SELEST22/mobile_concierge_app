/**
 * Events that users join by scanning a QR code.
 *
 *   POST /events         (admin) create an event; returns its join code/QR payload
 *   GET  /events         (admin) list all events with member counts
 *   POST /events/join    (user)  join an event from a scanned code
 *   GET  /events/mine    (user)  the events the current user has joined
 *
 * The QR encodes `SELEST-EVENT:<code>` (see qrPayload). Joining an event is
 * what lets a user receive that event's targeted broadcasts.
 */
import { randomBytes } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { many, one, run, UNIQUE_VIOLATION } from '../db.js';
import { requireAdmin, requireAuth } from '../lib/auth.js';
import { asyncHandler, parseBody } from '../lib/http.js';

export const eventsRouter = Router();

export const QR_PREFIX = 'SELEST-EVENT:';

// Unambiguous code (no 0/O/1/I) so it's easy to read and scan reliably.
function generateCode(length = 8): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(length);
  let code = '';
  for (let i = 0; i < length; i++) code += alphabet[bytes[i] % alphabet.length];
  return code;
}

function withQr(row: any) {
  return { ...row, qr_payload: `${QR_PREFIX}${row.code}` };
}

eventsRouter.use(requireAuth);

// ---- user: join + my events ------------------------------------------------

const joinSchema = z.object({
  // Accept either the raw code or the full QR payload, and normalise.
  code: z.string().trim().min(1).max(64),
});

eventsRouter.post(
  '/join',
  asyncHandler(async (req, res) => {
    const data = parseBody(joinSchema, req, res);
    if (!data) return;

    const code = data.code.replace(QR_PREFIX, '').trim().toUpperCase();
    const event: any = await one('SELECT * FROM events WHERE code = $1', [code]);
    if (!event) return res.status(404).json({ error: 'That event code is not valid.' });

    await run(
      `INSERT INTO event_members (event_id, user_id) VALUES ($1, $2)
       ON CONFLICT (event_id, user_id) DO NOTHING`,
      [event.id, req.user!.id],
    );

    res.status(201).json({ ...withQr(event), joined: true });
  }),
);

eventsRouter.get(
  '/mine',
  asyncHandler(async (req, res) => {
    const rows = (
      await many(
        `SELECT e.*, m.joined_at
           FROM events e
           JOIN event_members m ON m.event_id = e.id
          WHERE m.user_id = $1
          ORDER BY m.joined_at DESC`,
        [req.user!.id],
      )
    ).map(withQr);
    res.json(rows);
  }),
);

// ---- admin: create + list --------------------------------------------------

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  eventDate: z.string().trim().max(120).optional(),
  location: z.string().trim().max(200).optional(),
  description: z.string().trim().max(1000).optional(),
});

eventsRouter.post(
  '/',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const data = parseBody(createSchema, req, res);
    if (!data) return;

    // Retry on the rare chance of a code collision (UNIQUE constraint).
    let row: any;
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateCode();
      try {
        row = await one(
          `INSERT INTO events (name, code, event_date, location, description, created_by)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING *`,
          [
            data.name,
            code,
            data.eventDate ?? null,
            data.location ?? null,
            data.description ?? null,
            req.user!.id,
          ],
        );
        break;
      } catch (err: any) {
        if (err?.code !== UNIQUE_VIOLATION) throw err;
      }
    }
    if (!row) return res.status(500).json({ error: 'Could not allocate an event code' });
    res.status(201).json(withQr(row));
  }),
);

eventsRouter.get(
  '/',
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const rows = (
      await many(
        `SELECT e.*, COUNT(m.id)::int AS member_count
           FROM events e
           LEFT JOIN event_members m ON m.event_id = e.id
          GROUP BY e.id
          ORDER BY e.created_at DESC`,
      )
    ).map(withQr);
    res.json(rows);
  }),
);
