/**
 * Seed script: creates a demo admin + user, a demo event, and a couple of
 * broadcasts so the app has something to show on first run.
 *
 *   npm run seed
 *
 * Safe to re-run — it upserts the demo accounts instead of duplicating them.
 */
import { initDb, one, pool, run } from './db.js';
import { hashPassword } from './lib/auth.js';

const DEMO = {
  admin: { name: 'Concierge Admin', email: 'admin@concierge.dev', password: 'admin123' },
  user: { name: 'Demo Guest', email: 'guest@concierge.dev', password: 'guest123' },
};

async function upsertUser(
  u: { name: string; email: string; password: string },
  role: string,
  organization: string | null = null,
) {
  const hash = await hashPassword(u.password);
  // INSERT ... ON CONFLICT keeps re-runs idempotent and returns the id either way.
  const row = await one<{ id: number }>(
    `INSERT INTO users (name, email, password, role, organization)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (email)
     DO UPDATE SET name = EXCLUDED.name, password = EXCLUDED.password,
                   role = EXCLUDED.role, organization = EXCLUDED.organization
     RETURNING id`,
    [u.name, u.email, hash, role, organization],
  );
  return row!.id;
}

async function main() {
  await initDb();

  const adminId = await upsertUser(DEMO.admin, 'admin', 'SELEST Security (Demo)');
  const guestId = await upsertUser(DEMO.user, 'user');

  // Demo event with a fixed, easy-to-type code so QR join is testable without
  // a printed code. (Real events get a random code from the admin screen.)
  const DEMO_EVENT_CODE = 'WELCOME1';
  let eventRow = await one<{ id: number }>('SELECT id FROM events WHERE code = $1', [
    DEMO_EVENT_CODE,
  ]);
  if (!eventRow) {
    eventRow = await one<{ id: number }>(
      `INSERT INTO events (name, code, event_date, location, description, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        'Launch Night',
        DEMO_EVENT_CODE,
        'Fri 20 Jun, 7:00 PM',
        'The Grand Rooftop, Level 12',
        'Demo event for QR join testing.',
        adminId,
      ],
    );
  }
  const eventId = eventRow!.id;

  // Auto-join the demo guest so they immediately have an event whose
  // notifications they can see (broadcasts are event-scoped).
  await run(
    `INSERT INTO event_members (event_id, user_id) VALUES ($1, $2)
     ON CONFLICT (event_id, user_id) DO NOTHING`,
    [eventId, guestId],
  );

  // Only seed broadcasts if there are none, to keep re-runs idempotent. Every
  // broadcast targets the demo event — there is no global send.
  const count = await one<{ n: string }>('SELECT COUNT(*) AS n FROM broadcast_messages');
  if (Number(count!.n) === 0) {
    await run(
      `INSERT INTO broadcast_messages (title, message, type, event_id, expires_at, created_by)
       VALUES ($1, $2, 'general', $3, now() + make_interval(days => 30), $4)`,
      [
        'Welcome to Launch Night',
        'Your concierge and security team is one tap away. Tap any request to get started.',
        eventId,
        adminId,
      ],
    );
    await run(
      `INSERT INTO broadcast_messages (title, message, type, event_id, expires_at, created_by)
       VALUES ($1, $2, 'emergency', $3, now() + make_interval(days => 7), $4)`,
      [
        'Fire drill at 3:00 PM',
        'A scheduled fire drill will take place today. Please follow staff instructions and use the nearest marked exit.',
        eventId,
        adminId,
      ],
    );
  }

  console.log('Seed complete.');
  console.log(`  Admin: ${DEMO.admin.email} / ${DEMO.admin.password}`);
  console.log(`  Guest: ${DEMO.user.email} / ${DEMO.user.password}`);
  console.log(`  Demo event join code: ${DEMO_EVENT_CODE} (QR: SELEST-EVENT:${DEMO_EVENT_CODE})`);
}

main()
  .then(() => pool.end())
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
