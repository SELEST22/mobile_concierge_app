/**
 * Centralised configuration, read once from the environment.
 *
 * We read a `.env` file manually (no dotenv dependency) to keep the install
 * lean — `tsx` already runs before any app code, so we just parse the file if
 * it exists.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(here, '..');

// Minimal .env loader: `KEY=value` lines, `#` comments, ignores blanks.
const envPath = resolve(packageRoot, '.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}

export const config = {
  port: Number(process.env.PORT ?? 4000),
  jwtSecret: process.env.JWT_SECRET ?? 'dev-only-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  databasePath: resolve(packageRoot, process.env.DATABASE_PATH ?? './data/concierge.db'),
  broadcastDefaultDays: Number(process.env.BROADCAST_DEFAULT_DAYS ?? 30),
};
