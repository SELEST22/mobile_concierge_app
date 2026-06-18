/**
 * Shared domain types — the single source of truth for the data shapes that
 * flow between the backend, the mobile app, and (later) the web app.
 *
 * Keep this file framework-free (no React, no Express) so every platform can
 * import it.
 */

export type Role = 'admin' | 'user';

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
  /** User agreed to receive mass-notification pop-ups at sign-up. */
  notifications_consent: boolean;
  created_at: string;
}

/** Broadcast (mass-communication) message authored by an admin. */
export type BroadcastType = 'emergency' | 'general';

export interface BroadcastMessage {
  id: number;
  title: string;
  message: string;
  type: BroadcastType;
  created_at: string;
  expires_at: string;
  created_by: number;
}

/**
 * A broadcast as seen by a specific user — the broadcast joined with that
 * user's personal read/archive state.
 */
export interface UserMessage extends BroadcastMessage {
  is_archived: boolean;
  read_at: string | null;
}

/** Concierge / security service request (stubbed in this pass, expanded next). */
export type ConciergeStatus = 'open' | 'in_progress' | 'resolved' | 'cancelled';
export type ConciergeCategory = 'concierge' | 'security' | 'maintenance' | 'other';

export interface ConciergeRequest {
  id: number;
  user_id: number;
  category: ConciergeCategory;
  details: string;
  status: ConciergeStatus;
  created_at: string;
  updated_at: string;
}

// ---- API request/response payloads -----------------------------------------

export interface AuthResponse {
  token: string;
  user: User;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  /** Must be true — users must agree to receive notifications to sign up. */
  notificationsConsent: true;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface CreateBroadcastPayload {
  title: string;
  message: string;
  type: BroadcastType;
  /** Days until the message auto-hides. Defaults to 30 on the server. */
  expiresInDays?: number;
}

export interface CreateConciergePayload {
  category: ConciergeCategory;
  details: string;
}

export interface ApiError {
  error: string;
  details?: unknown;
}
