/**
 * Seed script: creates a demo admin + user and a couple of broadcasts so the
 * app has something to show on first run.
 *
 *   npm run seed
 *
 * Safe to re-run — it upserts the demo accounts instead of duplicating them.
 */
import { db } from './db.js';
import { hashPassword } from './lib/auth.js';

const DEMO = {
  admin: { name: 'Concierge Admin', email: 'admin@concierge.dev', password: 'admin123' },
  user: { name: 'Demo Guest', email: 'guest@concierge.dev', password: 'guest123' },
};

async function upsertUser(u: { name: string; email: string; password: string }, role: string) {
  const existing: any = db.prepare('SELECT id FROM users WHERE email = ?').get(u.email);
  const hash = await hashPassword(u.password);
  if (existing) {
    db.prepare('UPDATE users SET name = ?, password = ?, role = ? WHERE id = ?').run(
      u.name,
      hash,
      role,
      existing.id,
    );
    return existing.id as number;
  }
  const info = db
    .prepare('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)')
    .run(u.name, u.email, hash, role);
  return info.lastInsertRowid as number;
}

async function main() {
  const adminId = await upsertUser(DEMO.admin, 'admin');
  await upsertUser(DEMO.user, 'user');

  // Only seed broadcasts if there are none, to keep re-runs idempotent.
  const count: any = db.prepare('SELECT COUNT(*) AS n FROM broadcast_messages').get();
  if (count.n === 0) {
    const insert = db.prepare(
      `INSERT INTO broadcast_messages (title, message, type, expires_at, created_by)
       VALUES (?, ?, ?, datetime('now', ?), ?)`,
    );
    insert.run(
      'Welcome to Mobile Concierge',
      'Your concierge and security team is one tap away. Tap any request to get started.',
      'general',
      '+30 days',
      adminId,
    );
    insert.run(
      'Fire drill at 3:00 PM',
      'A scheduled fire drill will take place today. Please follow staff instructions and use the nearest marked exit.',
      'emergency',
      '+7 days',
      adminId,
    );
  }

  // Demo event with a fixed, easy-to-type code so QR join is testable without
  // a printed code. (Real events get a random code from the admin screen.)
  const DEMO_EVENT_CODE = 'WELCOME1';
  const hasEvent = db.prepare('SELECT 1 FROM events WHERE code = ?').get(DEMO_EVENT_CODE);
  if (!hasEvent) {
    db.prepare(
      'INSERT INTO events (name, code, description, created_by) VALUES (?, ?, ?, ?)',
    ).run('Launch Night', DEMO_EVENT_CODE, 'Demo event for QR join testing.', adminId);
  }

  console.log('Seed complete.');
  console.log(`  Admin: ${DEMO.admin.email} / ${DEMO.admin.password}`);
  console.log(`  Guest: ${DEMO.user.email} / ${DEMO.user.password}`);
  console.log(`  Demo event join code: ${DEMO_EVENT_CODE} (QR: SELEST-EVENT:${DEMO_EVENT_CODE})`);
}

main().then(() => process.exit(0));
