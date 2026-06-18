/**
 * User-facing message routes — the notifications/alerts inbox.
 *
 *   GET    /user/messages              active messages (default view)
 *   GET    /user/messages?view=archived  the user's archived section
 *   PATCH  /user/messages/:id/archive   move a message to the archive
 *   PATCH  /user/messages/:id/read      mark one message read
 *   PATCH  /user/messages/read-all      mark every active message read
 *   DELETE /user/messages/:id           permanently remove it for this user
 *
 * "Active" = not past its expires_at, not archived, not deleted. Emergency
 * messages always sort to the top so they're impossible to miss.
 *
 * Archived messages do NOT expire — they stay in the archive until the user
 * deletes them. Deletion is per-user (a soft delete on user_message_status)
 * and is irreversible from the user's point of view.
 *
 * Broadcasts are event-scoped: a user only sees messages for the events they
 * have joined. There is no global / all-users send.
 */
import { Router } from 'express';
import { many, one, run } from '../db.js';
import { requireAuth } from '../lib/auth.js';
import { asyncHandler } from '../lib/http.js';

export const messagesRouter = Router();

messagesRouter.use(requireAuth);

async function messageExists(id: number): Promise<boolean> {
  return !!(await one('SELECT 1 FROM broadcast_messages WHERE id = $1', [id]));
}

messagesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const archivedView = req.query.view === 'archived';

    // Active view: live (unexpired), not archived. Archived view: archived
    // regardless of expiry. Deleted messages are excluded from both.
    const where = archivedView
      ? `COALESCE(s.is_archived, false) = true`
      : `b.expires_at > now() AND COALESCE(s.is_archived, false) = false`;

    const rows = await many(
      `SELECT b.*,
              COALESCE(s.is_archived, false) AS is_archived,
              s.read_at                      AS read_at
         FROM broadcast_messages b
         LEFT JOIN user_message_status s
           ON s.message_id = b.id AND s.user_id = $1
        WHERE COALESCE(s.is_deleted, false) = false
          AND b.event_id IN (SELECT event_id FROM event_members WHERE user_id = $1)
          AND (${where})
        ORDER BY CASE b.type WHEN 'emergency' THEN 0 ELSE 1 END,
                 b.created_at DESC`,
      [userId],
    );

    res.json(rows);
  }),
);

messagesRouter.patch(
  '/:id/archive',
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const messageId = Number(req.params.id);
    if (!(await messageExists(messageId))) {
      return res.status(404).json({ error: 'Message not found' });
    }
    await run(
      `INSERT INTO user_message_status (user_id, message_id, is_archived)
       VALUES ($1, $2, true)
       ON CONFLICT (user_id, message_id) DO UPDATE SET is_archived = true`,
      [userId, messageId],
    );
    res.json({ ok: true });
  }),
);

messagesRouter.patch(
  '/:id/read',
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const messageId = Number(req.params.id);
    if (!(await messageExists(messageId))) {
      return res.status(404).json({ error: 'Message not found' });
    }
    await run(
      `INSERT INTO user_message_status (user_id, message_id, read_at)
       VALUES ($1, $2, now())
       ON CONFLICT (user_id, message_id)
       DO UPDATE SET read_at = COALESCE(user_message_status.read_at, now())`,
      [userId, messageId],
    );
    res.json({ ok: true });
  }),
);

messagesRouter.patch(
  '/read-all',
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    // Mark every active, joined-event message read in one statement.
    await run(
      `INSERT INTO user_message_status (user_id, message_id, read_at)
       SELECT $1, b.id, now()
         FROM broadcast_messages b
        WHERE b.expires_at > now()
          AND b.event_id IN (SELECT event_id FROM event_members WHERE user_id = $1)
       ON CONFLICT (user_id, message_id)
       DO UPDATE SET read_at = COALESCE(user_message_status.read_at, now())`,
      [userId],
    );
    res.json({ ok: true });
  }),
);

messagesRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const messageId = Number(req.params.id);
    if (!(await messageExists(messageId))) {
      return res.status(404).json({ error: 'Message not found' });
    }
    // Soft delete per user: the broadcast stays for everyone else, but this
    // user will never see it again. Irreversible from the user's side.
    await run(
      `INSERT INTO user_message_status (user_id, message_id, is_deleted)
       VALUES ($1, $2, true)
       ON CONFLICT (user_id, message_id) DO UPDATE SET is_deleted = true`,
      [userId, messageId],
    );
    res.json({ ok: true });
  }),
);
