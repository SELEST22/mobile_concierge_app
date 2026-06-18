/** Auth routes: register, login, and "who am I". */
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import {
  hashPassword,
  requireAuth,
  signToken,
  verifyPassword,
  type AuthUser,
} from '../lib/auth.js';
import { asyncHandler, parseBody } from '../lib/http.js';

export const authRouter = Router();

const registerSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(6).max(200),
  // CEO requirement: users must agree to receive mass-notification pop-ups
  // when creating an account. We refuse the registration otherwise.
  notificationsConsent: z.literal(true, {
    errorMap: () => ({ message: 'You must agree to receive notifications to sign up.' }),
  }),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

function publicUser(row: any) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    notifications_consent: !!row.notifications_consent,
    created_at: row.created_at,
  };
}

authRouter.post(
  '/register',
  asyncHandler(async (req, res) => {
    const data = parseBody(registerSchema, req, res);
    if (!data) return;

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(data.email);
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const hash = await hashPassword(data.password);
    const info = db
      .prepare(
        'INSERT INTO users (name, email, password, role, notifications_consent) VALUES (?, ?, ?, ?, 1)',
      )
      .run(data.name, data.email, hash, 'user');

    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
    const user = publicUser(row);
    const token = signToken({ id: user.id, email: user.email, role: user.role } as AuthUser);
    res.status(201).json({ token, user });
  }),
);

authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const data = parseBody(loginSchema, req, res);
    if (!data) return;

    const row: any = db.prepare('SELECT * FROM users WHERE email = ?').get(data.email);
    // Same response whether the email or the password is wrong (no user enumeration).
    if (!row || !(await verifyPassword(data.password, row.password))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = publicUser(row);
    const token = signToken({ id: user.id, email: user.email, role: user.role } as AuthUser);
    res.json({ token, user });
  }),
);

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user!.id);
    res.json(publicUser(row));
  }),
);
