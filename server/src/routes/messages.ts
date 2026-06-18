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
 */
import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../lib/auth.js';
import { asyncHandler } from '../lib/http.js';

export const messagesRouter = Router();

messagesRouter.use(requireAuth);

// Ensures a user_message_status row exists, then runs the given mutation on it.
function upsertStatus(userId: number, messageId: number) {
  db.prepare(
    `INSERT INTO user_message_status (user_id, message_id)
     VALUES (?, ?)
     ON CONFLICT(user_id, message_id) DO NOTHING`,
  ).run(userId, messageId);
}

messagesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const archivedView = req.query.view === 'archived';

    // Active view: live (unexpired), not archived. Archived view: archived
    // regardless of expiry. Deleted messages are excluded from both.
    const where = archivedView
      ? `COALESCE(s.is_archived, 0) = 1`
      : `b.expires_at > datetime('now') AND COALESCE(s.is_archived, 0) = 0`;

    const rows = db
      .prepare(
        `SELECT b.*,
                COALESCE(s.is_archived, 0) AS is_archived,
                s.read_at                  AS read_at
           FROM broadcast_messages b
           LEFT JOIN user_message_status s
             ON s.message_id = b.id AND s.user_id = ?
          WHERE COALESCE(s.is_deleted, 0) = 0
            AND (${where})
          ORDER BY CASE b.type WHEN 'emergency' THEN 0 ELSE 1 END,
                   b.created_at DESC`,
      )
      .all(userId)
      .map((r: any) => ({ ...r, is_archived: !!r.is_archived }));

    res.json(rows);
  }),
);

messagesRouter.patch(
  '/:id/archive',
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const messageId = Number(req.params.id);

    const exists = db.prepare('SELECT 1 FROM broadcast_messages WHERE id = ?').get(messageId);
    if (!exists) return res.status(404).json({ error: 'Message not found' });

    upsertStatus(userId, messageId);
    db.prepare(
      'UPDATE user_message_status SET is_archived = 1 WHERE user_id = ? AND message_id = ?',
    ).run(userId, messageId);
    res.json({ ok: true });
  }),
);

messagesRouter.patch(
  '/:id/read',
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const messageId = Number(req.params.id);

    const exists = db.prepare('SELECT 1 FROM broadcast_messages WHERE id = ?').get(messageId);
    if (!exists) return res.status(404).json({ error: 'Message not found' });

    upsertStatus(userId, messageId);
    db.prepare(
      `UPDATE user_message_status SET read_at = datetime('now')
         WHERE user_id = ? AND message_id = ? AND read_at IS NULL`,
    ).run(userId, messageId);
    res.json({ ok: true });
  }),
);

messagesRouter.patch(
  '/read-all',
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const active: any[] = db
      .prepare(`SELECT id FROM broadcast_messages WHERE expires_at > datetime('now')`)
      .all();

    const tx = db.transaction(() => {
      for (const { id } of active) {
        upsertStatus(userId, id);
        db.prepare(
          `UPDATE user_message_status SET read_at = datetime('now')
             WHERE user_id = ? AND message_id = ? AND read_at IS NULL`,
        ).run(userId, id);
      }
    });
    tx();
    res.json({ ok: true });
  }),
);

messagesRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const messageId = Number(req.params.id);

    const exists = db.prepare('SELECT 1 FROM broadcast_messages WHERE id = ?').get(messageId);
    if (!exists) return res.status(404).json({ error: 'Message not found' });

    // Soft delete per user: the broadcast stays for everyone else, but this
    // user will never see it again. Irreversible from the user's side.
    upsertStatus(userId, messageId);
    db.prepare(
      'UPDATE user_message_status SET is_deleted = 1 WHERE user_id = ? AND message_id = ?',
    ).run(userId, messageId);
    res.json({ ok: true });
  }),
);
