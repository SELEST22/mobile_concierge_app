/**
 * PostgreSQL access + schema bootstrap.
 *
 * We use `pg` (node-postgres) with a connection pool. Queries are async, so
 * route handlers `await` the helpers below. The schema is created on startup
 * via `initDb()`, so there is no separate migration step for a fresh database.
 */
import pg from 'pg';
import { config } from './config.js';

export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  // Managed Postgres (Render/Railway/Neon/etc.) usually requires SSL.
  ssl: config.databaseSsl ? { rejectUnauthorized: false } : undefined,
});

/** Run a query and return the full result. */
export function query<T extends pg.QueryResultRow = any>(text: string, params?: unknown[]) {
  return pool.query<T>(text, params);
}

/** First row, or undefined. */
export async function one<T extends pg.QueryResultRow = any>(
  text: string,
  params?: unknown[],
): Promise<T | undefined> {
  const res = await pool.query<T>(text, params);
  return res.rows[0];
}

/** All rows. */
export async function many<T extends pg.QueryResultRow = any>(
  text: string,
  params?: unknown[],
): Promise<T[]> {
  const res = await pool.query<T>(text, params);
  return res.rows;
}

/** Run a statement and return the number of affected rows. */
export async function run(text: string, params?: unknown[]): Promise<number> {
  const res = await pool.query(text, params);
  return res.rowCount ?? 0;
}

export type Role = 'admin' | 'user';

/** Postgres unique-violation error code, used to detect code collisions. */
export const UNIQUE_VIOLATION = '23505';

/** Creates the schema if it doesn't exist. Safe to call on every startup. */
export async function initDb(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id         SERIAL PRIMARY KEY,
      name       TEXT NOT NULL,
      email      TEXT NOT NULL UNIQUE,
      password   TEXT NOT NULL,                 -- bcrypt hash, never plaintext
      role       TEXT NOT NULL DEFAULT 'user'
                 CHECK (role IN ('admin', 'user')),
      organization TEXT,                        -- for admins: venue/business/property
      notifications_consent BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS events (
      id          SERIAL PRIMARY KEY,
      name        TEXT NOT NULL,
      code        TEXT NOT NULL UNIQUE,         -- random join code encoded in the QR
      event_date  TEXT,                         -- when (free text)
      location    TEXT,                         -- where
      description TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      created_by  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS event_members (
      id        SERIAL PRIMARY KEY,
      event_id  INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (event_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS broadcast_messages (
      id         SERIAL PRIMARY KEY,
      title      TEXT NOT NULL,
      message    TEXT NOT NULL,
      type       TEXT NOT NULL DEFAULT 'general'
                 CHECK (type IN ('emergency', 'general')),
      -- Broadcasts are event-scoped: only members of this event receive it.
      event_id   INTEGER REFERENCES events(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      expires_at TIMESTAMPTZ NOT NULL,          -- auto-hidden after this time
      created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS user_message_status (
      id          SERIAL PRIMARY KEY,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      message_id  INTEGER NOT NULL REFERENCES broadcast_messages(id) ON DELETE CASCADE,
      is_archived BOOLEAN NOT NULL DEFAULT false,
      is_deleted  BOOLEAN NOT NULL DEFAULT false,
      read_at     TIMESTAMPTZ,
      UNIQUE (user_id, message_id)
    );

    CREATE TABLE IF NOT EXISTS concierge_requests (
      id         SERIAL PRIMARY KEY,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      category   TEXT NOT NULL DEFAULT 'concierge'
                 CHECK (category IN ('concierge', 'security', 'maintenance', 'other')),
      details    TEXT NOT NULL,
      status     TEXT NOT NULL DEFAULT 'open'
                 CHECK (status IN ('open', 'in_progress', 'resolved', 'cancelled')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_broadcast_expires ON broadcast_messages(expires_at);
    CREATE INDEX IF NOT EXISTS idx_status_user ON user_message_status(user_id);
    CREATE INDEX IF NOT EXISTS idx_event_members_user ON event_members(user_id);
  `);
}
