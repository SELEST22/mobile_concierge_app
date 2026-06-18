/**
 * SQLite access + schema bootstrap.
 *
 * We use better-sqlite3 (synchronous, fast, zero external service). The schema
 * is created on first run, so there is no separate migration step to remember.
 * Swapping to Postgres later means re-implementing this one module.
 */
import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { config } from './config.js';

mkdirSync(dirname(config.databasePath), { recursive: true });

export const db = new Database(config.databasePath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL,
    email      TEXT    NOT NULL UNIQUE,
    password   TEXT    NOT NULL,                 -- bcrypt hash, never plaintext
    role       TEXT    NOT NULL DEFAULT 'user'   -- 'admin' | 'user'
                       CHECK (role IN ('admin', 'user')),
    -- For admins: the venue / business / property they represent.
    organization TEXT,
    -- User consented to receive mass-notification pop-ups at sign-up (required).
    notifications_consent INTEGER NOT NULL DEFAULT 1,
    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  -- Events that users join by scanning a QR code.
  CREATE TABLE IF NOT EXISTS events (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL,
    code       TEXT    NOT NULL UNIQUE,          -- random join code encoded in the QR
    event_date TEXT,                             -- when the event happens (free text)
    location   TEXT,                             -- where it happens
    description TEXT,
    created_at TEXT    NOT NULL DEFAULT (datetime('now')),
    created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE
  );

  -- Which users have joined which events.
  CREATE TABLE IF NOT EXISTS event_members (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id  INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE (event_id, user_id)
  );

  -- Mass-communication / broadcast messages authored by admins.
  CREATE TABLE IF NOT EXISTS broadcast_messages (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    title      TEXT    NOT NULL,
    message    TEXT    NOT NULL,
    type       TEXT    NOT NULL DEFAULT 'general'
                       CHECK (type IN ('emergency', 'general')),
    -- NULL = sent to everyone; otherwise only members of this event see it.
    event_id   INTEGER REFERENCES events(id) ON DELETE CASCADE,
    created_at TEXT    NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT    NOT NULL,                 -- auto-hidden after this time
    created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE
  );

  -- Per-user read/archive state for each broadcast.
  CREATE TABLE IF NOT EXISTS user_message_status (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message_id  INTEGER NOT NULL REFERENCES broadcast_messages(id) ON DELETE CASCADE,
    is_archived INTEGER NOT NULL DEFAULT 0,      -- 0/1 boolean
    -- Per-user permanent delete. Archived messages never expire; the user
    -- removes them manually, and a deleted message is hidden from every view.
    is_deleted  INTEGER NOT NULL DEFAULT 0,
    read_at     TEXT,
    UNIQUE (user_id, message_id)
  );

  -- Concierge / security requests (basic in this pass, expanded next).
  CREATE TABLE IF NOT EXISTS concierge_requests (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category   TEXT    NOT NULL DEFAULT 'concierge'
                       CHECK (category IN ('concierge', 'security', 'maintenance', 'other')),
    details    TEXT    NOT NULL,
    status     TEXT    NOT NULL DEFAULT 'open'
                       CHECK (status IN ('open', 'in_progress', 'resolved', 'cancelled')),
    created_at TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_broadcast_expires ON broadcast_messages(expires_at);
  CREATE INDEX IF NOT EXISTS idx_status_user ON user_message_status(user_id);
  CREATE INDEX IF NOT EXISTS idx_event_members_user ON event_members(user_id);
`);

// --- lightweight migrations -------------------------------------------------
// Adds columns introduced after a database was first created, so existing
// installs upgrade in place without losing data.
function ensureColumn(table: string, column: string, ddl: string) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  }
}

ensureColumn('users', 'notifications_consent', 'notifications_consent INTEGER NOT NULL DEFAULT 1');
ensureColumn('users', 'organization', 'organization TEXT');
ensureColumn('user_message_status', 'is_deleted', 'is_deleted INTEGER NOT NULL DEFAULT 0');
// event_id targets a broadcast at one event's members (NULL = everyone).
ensureColumn('broadcast_messages', 'event_id', 'event_id INTEGER REFERENCES events(id) ON DELETE CASCADE');
ensureColumn('events', 'event_date', 'event_date TEXT');
ensureColumn('events', 'location', 'location TEXT');

export type Role = 'admin' | 'user';
