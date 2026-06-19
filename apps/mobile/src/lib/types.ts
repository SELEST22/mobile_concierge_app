/**
 * Mobile data types — shaped to match the web app's Firestore documents so both
 * platforms read and write the same records.
 *
 * IDs are Firestore document ids (strings), unlike the old Postgres backend
 * which used numeric ids.
 */

export type Role = 'admin' | 'user';

export interface User {
  id: string; // Firebase Auth uid (== users/{uid} doc id)
  name: string;
  email: string;
  role: Role;
  /** For admins: the venue / business / property they represent. */
  organization: string | null;
  /** User agreed to receive mass-notification pop-ups at sign-up. */
  notifications_consent: boolean;
  /** The single event the user is currently connected to (web parity). */
  connectedEventId: string | null;
  connectedAdminId: string | null;
}

export type BroadcastType = 'emergency' | 'general';

export interface BroadcastMessage {
  id: string;
  title: string;
  message: string;
  type: BroadcastType;
  /** The event whose members receive this broadcast. */
  event_id: string | null;
  created_at: string; // ISO string (from Firestore Timestamp)
  expires_at: string; // ISO string
  created_by: string; // admin uid
}

export interface Event {
  id: string;
  name: string;
  /** Manual-entry code — the Firestore event id (used when typing instead of scanning). */
  code: string;
  event_date: string | null;
  location: string | null;
  description: string | null;
  created_at: string;
  created_by: string; // admin uid (adminId in Firestore)
  /** String encoded into the QR — `{eventId, adminId, eventName}` JSON (web-compatible). */
  qr_payload: string;
  member_count?: number;
  joined_at?: string;
}

export interface UserMessage extends BroadcastMessage {
  is_archived: boolean;
  read_at: string | null;
}

export type ConciergeStatus = 'open' | 'in_progress' | 'resolved' | 'cancelled';
export type ConciergeCategory = 'concierge' | 'security' | 'maintenance' | 'other';

export interface ConciergeRequest {
  id: string;
  user_id: string;
  category: ConciergeCategory;
  details: string;
  status: ConciergeStatus;
  created_at: string;
  updated_at: string;
}

// ---- request payloads -------------------------------------------------------

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  notificationsConsent: true;
  role?: Role;
  organization?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface CreateBroadcastPayload {
  title: string;
  message: string;
  type: BroadcastType;
  expiresInDays?: number;
  /** Required: broadcasts are event-scoped (only that event's members see it). */
  eventId: string;
}

export interface CreateEventPayload {
  name: string;
  eventDate?: string;
  location?: string;
  description?: string;
}

export interface CreateConciergePayload {
  category: ConciergeCategory;
  details: string;
}
