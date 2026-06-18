/**
 * Authentication helpers: password hashing, JWT signing, and Express
 * middleware that protects routes / enforces the admin role.
 */
import bcrypt from 'bcryptjs';
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { db, type Role } from '../db.js';

export interface AuthUser {
  id: number;
  email: string;
  role: Role;
}

// Make `req.user` available to handlers after `requireAuth`.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function signToken(user: AuthUser): string {
  return jwt.sign(user, config.jwtSecret, { expiresIn: config.jwtExpiresIn } as jwt.SignOptions);
}

/** Rejects the request unless a valid bearer token is present. */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header' });
  }
  try {
    const payload = jwt.verify(header.slice(7), config.jwtSecret) as AuthUser;
    // Confirm the user still exists (token could outlive the account).
    const exists = db.prepare('SELECT 1 FROM users WHERE id = ?').get(payload.id);
    if (!exists) return res.status(401).json({ error: 'User no longer exists' });
    req.user = { id: payload.id, email: payload.email, role: payload.role };
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/** Use after `requireAuth` to gate admin-only routes. */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}
