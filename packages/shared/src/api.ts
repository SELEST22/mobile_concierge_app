/**
 * Tiny, dependency-free API client shared by every front end.
 *
 * It wraps `fetch`, attaches the bearer token, and returns typed results so the
 * mobile app (and later the web app) talk to the backend the same way.
 */
import type {
  AuthResponse,
  BroadcastMessage,
  ConciergeRequest,
  CreateBroadcastPayload,
  CreateConciergePayload,
  CreateEventPayload,
  Event,
  LoginPayload,
  RegisterPayload,
  User,
  UserMessage,
} from './types';

export class ApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string) {
    // Trim a trailing slash so `${baseUrl}/auth/login` never doubles up.
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  setToken(token: string | null) {
    this.token = token;
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(init.headers as Record<string, string>),
    };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;

    const res = await fetch(`${this.baseUrl}${path}`, { ...init, headers });
    const text = await res.text();
    const body = text ? JSON.parse(text) : undefined;

    if (!res.ok) {
      const message = body?.error ?? `Request failed (${res.status})`;
      throw new Error(message);
    }
    return body as T;
  }

  // ---- auth ----------------------------------------------------------------
  register(payload: RegisterPayload) {
    return this.request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  login(payload: LoginPayload) {
    return this.request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  me() {
    return this.request<User>('/auth/me');
  }

  // ---- broadcasts (admin) --------------------------------------------------
  createBroadcast(payload: CreateBroadcastPayload) {
    return this.request<BroadcastMessage>('/broadcast', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  listBroadcasts() {
    return this.request<BroadcastMessage[]>('/broadcast');
  }

  deleteBroadcast(id: number) {
    return this.request<{ ok: true }>(`/broadcast/${id}`, { method: 'DELETE' });
  }

  // ---- messages (user) -----------------------------------------------------
  /** Active inbox: live, unarchived, undeleted messages. */
  listMyMessages() {
    return this.request<UserMessage[]>('/user/messages');
  }

  /** Archived section: archived (non-deleted) messages, which never expire. */
  listArchivedMessages() {
    return this.request<UserMessage[]>('/user/messages?view=archived');
  }

  archiveMessage(id: number) {
    return this.request<{ ok: true }>(`/user/messages/${id}/archive`, {
      method: 'PATCH',
    });
  }

  /** Permanently remove a message for the current user (irreversible). */
  deleteMessage(id: number) {
    return this.request<{ ok: true }>(`/user/messages/${id}`, {
      method: 'DELETE',
    });
  }

  markRead(id: number) {
    return this.request<{ ok: true }>(`/user/messages/${id}/read`, {
      method: 'PATCH',
    });
  }

  markAllRead() {
    return this.request<{ ok: true }>(`/user/messages/read-all`, {
      method: 'PATCH',
    });
  }

  // ---- events (QR join) ----------------------------------------------------
  /** Admin: create an event (returns its code + QR payload). */
  createEvent(payload: CreateEventPayload) {
    return this.request<Event>('/events', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  /** Admin: list all events with member counts. */
  listEvents() {
    return this.request<Event[]>('/events');
  }

  /** User: join an event from a scanned code or QR payload. */
  joinEvent(code: string) {
    return this.request<Event & { joined: true }>('/events/join', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  }

  /** User: the events the current user has joined. */
  listMyEvents() {
    return this.request<Event[]>('/events/mine');
  }

  // ---- concierge (stub for next pass) --------------------------------------
  createConciergeRequest(payload: CreateConciergePayload) {
    return this.request<ConciergeRequest>('/concierge', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  listMyConciergeRequests() {
    return this.request<ConciergeRequest[]>('/concierge');
  }
}
