/**
 * Firestore-backed data client.
 *
 * This replaces the old Express/Postgres HTTP API. Every method reads or writes
 * the SAME Firestore collections the web app uses, so the two platforms stay in
 * sync. Method names mirror the previous `ApiClient` so screens barely change.
 *
 * Firestore shapes (shared with the web app):
 *   users/{uid}                         { email, name, role, organization,
 *                                         notifications_consent, security_need,
 *                                         connectedEventId, connectedAdminId }
 *   users/{uid}/message_status/{msgId}  { readAt, isArchived, archivedAt, isDeleted }
 *   events/{id}                         { eventName, date, location, description,
 *                                         adminId, createdAt }
 *   broadcast_messages/{id}             { title, message, type, eventId, eventName,
 *                                         createdBy, createdByEmail, createdAt,
 *                                         expiresAt, isActive }
 *   concierge_requests/{id}             { userId, category, details, status,
 *                                         createdAt, updatedAt }
 */
import {
  addDoc,
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import type {
  BroadcastMessage,
  ConciergeRequest,
  CreateBroadcastPayload,
  CreateConciergePayload,
  CreateEventPayload,
  Event,
  Role,
  User,
  UserMessage,
} from './types';

const DEFAULT_EXPIRY_DAYS = 30;

// ---- helpers ----------------------------------------------------------------

function requireUid(): string {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('You are signed out. Please sign in again.');
  return uid;
}

/** Firestore Timestamp | Date | null → ISO string (or null). */
function toIso(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object' && value !== null && 'seconds' in (value as any)) {
    return new Date((value as any).seconds * 1000).toISOString();
  }
  return null;
}

async function readUserProfile(uid: string): Promise<User> {
  const snap = await getDoc(doc(db, 'users', uid));
  const data = snap.data() ?? {};
  return {
    id: uid,
    name: data.name ?? auth.currentUser?.displayName ?? data.email ?? 'Member',
    email: data.email ?? auth.currentUser?.email ?? '',
    role: (data.role as Role) ?? 'user',
    organization: data.organization ?? null,
    notifications_consent: data.notifications_consent ?? false,
    connectedEventId: data.connectedEventId ?? null,
    connectedAdminId: data.connectedAdminId ?? null,
  };
}

function mapEvent(id: string, data: any): Event {
  const adminId = data.adminId ?? data.createdBy ?? '';
  return {
    id,
    name: data.eventName ?? data.name ?? 'Event',
    code: id,
    event_date: data.date ?? null,
    location: data.location ?? null,
    description: data.description ?? null,
    created_at: toIso(data.createdAt) ?? '',
    created_by: adminId,
    qr_payload: JSON.stringify({ eventId: id, adminId, eventName: data.eventName ?? data.name ?? '' }),
  };
}

function mapBroadcast(id: string, data: any): BroadcastMessage {
  return {
    id,
    title: data.title ?? '',
    message: data.message ?? '',
    type: data.type === 'emergency' ? 'emergency' : 'general',
    event_id: data.eventId ?? null,
    created_at: toIso(data.createdAt) ?? new Date().toISOString(),
    expires_at: toIso(data.expiresAt) ?? '',
    created_by: data.createdBy ?? '',
  };
}

function sortMessages<T extends BroadcastMessage>(messages: T[]): T[] {
  return [...messages].sort((a, b) => {
    if (a.type !== b.type) return a.type === 'emergency' ? -1 : 1;
    return (b.created_at ?? '').localeCompare(a.created_at ?? '');
  });
}

/** Parse a scanned QR / typed code into { eventId, adminId } — matches the web app. */
function parseEventCode(raw: string): { eventId: string; adminId: string | null } {
  const text = (raw ?? '').trim();
  if (text.includes('eventId=') || text.includes('?')) {
    const qs = text.includes('?') ? text.slice(text.indexOf('?') + 1) : text;
    const params = new URLSearchParams(qs);
    const eventId = params.get('eventId');
    if (eventId) return { eventId, adminId: params.get('adminId') };
  }
  if (text.startsWith('{')) {
    try {
      const parsed = JSON.parse(text);
      if (parsed.eventId) return { eventId: String(parsed.eventId), adminId: parsed.adminId ?? null };
    } catch {
      /* fall through to raw id */
    }
  }
  return { eventId: text, adminId: null };
}

// ---- auth profile (used by AuthContext) -------------------------------------

export { readUserProfile };

export async function createUserProfile(
  uid: string,
  profile: { email: string; name: string; role: Role; organization?: string; notificationsConsent: boolean },
): Promise<void> {
  await setDoc(
    doc(db, 'users', uid),
    {
      email: profile.email,
      name: profile.name,
      role: profile.role,
      organization: profile.organization ?? null,
      notifications_consent: profile.notificationsConsent,
      // Keep the field the web app expects so existing web flows don't break.
      security_need: null,
      createdAt: serverTimestamp(),
    },
    { merge: true },
  );
}

// ---- the client -------------------------------------------------------------

export const api = {
  // ---- events --------------------------------------------------------------
  async createEvent(payload: CreateEventPayload): Promise<Event> {
    const uid = requireUid();
    const ref = await addDoc(collection(db, 'events'), {
      eventName: payload.name,
      date: payload.eventDate ?? null,
      location: payload.location ?? null,
      description: payload.description ?? null,
      adminId: uid,
      createdAt: serverTimestamp(),
    });
    const snap = await getDoc(ref);
    return mapEvent(ref.id, snap.data());
  },

  /** Admin: events this admin created, with member counts. */
  async listEvents(): Promise<Event[]> {
    const uid = requireUid();
    const snap = await getDocs(query(collection(db, 'events'), where('adminId', '==', uid)));
    const events = snap.docs.map((d) => mapEvent(d.id, d.data()));
    // Member count = users currently connected to each event.
    await Promise.all(
      events.map(async (e) => {
        const members = await getDocs(
          query(collection(db, 'users'), where('connectedEventId', '==', e.id)),
        );
        e.member_count = members.size;
      }),
    );
    return events;
  },

  /** User: the single event they're connected to (web parity), as a list. */
  async listMyEvents(): Promise<Event[]> {
    const uid = requireUid();
    const me = await readUserProfile(uid);
    if (!me.connectedEventId) return [];
    const snap = await getDoc(doc(db, 'events', me.connectedEventId));
    if (!snap.exists()) return [];
    return [mapEvent(snap.id, snap.data())];
  },

  /** User: join an event from a scanned QR or typed code. */
  async joinEvent(code: string): Promise<Event & { joined: true }> {
    const uid = requireUid();
    const { eventId, adminId } = parseEventCode(code);
    if (!eventId) throw new Error('Invalid event code.');
    const snap = await getDoc(doc(db, 'events', eventId));
    if (!snap.exists()) throw new Error('Event not found.');
    const data = snap.data();
    await updateDoc(doc(db, 'users', uid), {
      connectedEventId: eventId,
      connectedAdminId: adminId ?? data.adminId ?? null,
      lastConnected: serverTimestamp(),
    });
    return { ...mapEvent(snap.id, data), joined: true };
  },

  // ---- broadcasts (admin) --------------------------------------------------
  async createBroadcast(payload: CreateBroadcastPayload): Promise<BroadcastMessage> {
    const uid = requireUid();
    const eventSnap = await getDoc(doc(db, 'events', payload.eventId));
    const eventName = eventSnap.exists() ? eventSnap.data().eventName ?? '' : '';
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (payload.expiresInDays ?? DEFAULT_EXPIRY_DAYS));
    const ref = await addDoc(collection(db, 'broadcast_messages'), {
      title: payload.title,
      message: payload.message,
      type: payload.type,
      eventId: payload.eventId,
      eventName,
      createdBy: uid,
      createdByEmail: auth.currentUser?.email ?? '',
      createdAt: serverTimestamp(),
      expiresAt: Timestamp.fromDate(expiresAt),
      isActive: true,
    });
    const snap = await getDoc(ref);
    return mapBroadcast(ref.id, snap.data());
  },

  /** Admin: broadcasts this admin has sent. */
  async listBroadcasts(): Promise<BroadcastMessage[]> {
    const uid = requireUid();
    const snap = await getDocs(
      query(collection(db, 'broadcast_messages'), where('createdBy', '==', uid)),
    );
    return sortMessages(
      snap.docs
        .map((d) => ({ data: d.data(), msg: mapBroadcast(d.id, d.data()) }))
        .filter((x) => x.data.isActive !== false)
        .map((x) => x.msg),
    );
  },

  /** Admin: retire a broadcast (soft delete via isActive=false, web-compatible). */
  async deleteBroadcast(id: string): Promise<{ ok: true }> {
    await updateDoc(doc(db, 'broadcast_messages', id), { isActive: false });
    return { ok: true };
  },

  // ---- messages (user inbox) -----------------------------------------------
  async listMyMessages(): Promise<UserMessage[]> {
    const uid = requireUid();
    const me = await readUserProfile(uid);
    if (!me.connectedEventId) return [];

    const [broadcasts, statuses] = await Promise.all([
      getDocs(
        query(
          collection(db, 'broadcast_messages'),
          where('isActive', '==', true),
          where('eventId', '==', me.connectedEventId),
        ),
      ),
      getDocs(collection(db, 'users', uid, 'message_status')),
    ]);

    const statusById = new Map(statuses.docs.map((s) => [s.id, s.data()]));
    const now = Date.now();

    const messages = broadcasts.docs
      .map((d) => {
        const status = statusById.get(d.id) ?? {};
        const base = mapBroadcast(d.id, d.data());
        return { base, status };
      })
      .filter(({ base, status }) => {
        if (status.isDeleted || status.isArchived) return false;
        if (base.expires_at && new Date(base.expires_at).getTime() < now) return false;
        return true;
      })
      .map<UserMessage>(({ base, status }) => ({
        ...base,
        is_archived: false,
        read_at: toIso(status.readAt),
      }));

    return sortMessages(messages);
  },

  async listArchivedMessages(): Promise<UserMessage[]> {
    const uid = requireUid();
    const statuses = await getDocs(
      query(collection(db, 'users', uid, 'message_status'), where('isArchived', '==', true)),
    );
    const archived = await Promise.all(
      statuses.docs
        .filter((s) => !s.data().isDeleted)
        .map(async (s) => {
          const snap = await getDoc(doc(db, 'broadcast_messages', s.id));
          if (!snap.exists()) return null;
          return {
            ...mapBroadcast(snap.id, snap.data()),
            is_archived: true,
            read_at: toIso(s.data().readAt),
          } as UserMessage;
        }),
    );
    return sortMessages(archived.filter((m): m is UserMessage => m !== null));
  },

  async archiveMessage(id: string): Promise<{ ok: true }> {
    const uid = requireUid();
    await setDoc(
      doc(db, 'users', uid, 'message_status', id),
      { isArchived: true, archivedAt: serverTimestamp(), readAt: serverTimestamp() },
      { merge: true },
    );
    return { ok: true };
  },

  async deleteMessage(id: string): Promise<{ ok: true }> {
    const uid = requireUid();
    await setDoc(
      doc(db, 'users', uid, 'message_status', id),
      { isDeleted: true, deletedAt: serverTimestamp() },
      { merge: true },
    );
    return { ok: true };
  },

  async markRead(id: string): Promise<{ ok: true }> {
    const uid = requireUid();
    await setDoc(
      doc(db, 'users', uid, 'message_status', id),
      { readAt: serverTimestamp() },
      { merge: true },
    );
    return { ok: true };
  },

  async markAllRead(): Promise<{ ok: true }> {
    const uid = requireUid();
    const active = await api.listMyMessages();
    const batch = writeBatch(db);
    active
      .filter((m) => !m.read_at)
      .forEach((m) => {
        batch.set(
          doc(db, 'users', uid, 'message_status', m.id),
          { readAt: serverTimestamp() },
          { merge: true },
        );
      });
    await batch.commit();
    return { ok: true };
  },

  /**
   * Real-time inbox subscription. Fires `onChange` whenever the connected
   * event's broadcasts change — this is what makes emergencies pop live,
   * matching the web app.
   */
  subscribeMyMessages(
    connectedEventId: string,
    onChange: (messages: UserMessage[]) => void,
    onError?: (err: Error) => void,
  ): () => void {
    const uid = auth.currentUser?.uid;
    if (!uid || !connectedEventId) {
      onChange([]);
      return () => {};
    }
    const q = query(
      collection(db, 'broadcast_messages'),
      where('isActive', '==', true),
      where('eventId', '==', connectedEventId),
    );
    return onSnapshot(
      q,
      async (snapshot) => {
        const statuses = await getDocs(collection(db, 'users', uid, 'message_status'));
        const statusById = new Map(statuses.docs.map((s) => [s.id, s.data()]));
        const now = Date.now();
        const messages = snapshot.docs
          .map((d) => ({ base: mapBroadcast(d.id, d.data()), status: statusById.get(d.id) ?? {} }))
          .filter(({ base, status }) => {
            if (status.isDeleted || status.isArchived) return false;
            if (base.expires_at && new Date(base.expires_at).getTime() < now) return false;
            return true;
          })
          .map<UserMessage>(({ base, status }) => ({
            ...base,
            is_archived: false,
            read_at: toIso(status.readAt),
          }));
        onChange(sortMessages(messages));
      },
      (err) => onError?.(err as Error),
    );
  },

  // ---- concierge -----------------------------------------------------------
  async createConciergeRequest(payload: CreateConciergePayload): Promise<ConciergeRequest> {
    const uid = requireUid();
    const ref = await addDoc(collection(db, 'concierge_requests'), {
      userId: uid,
      category: payload.category,
      details: payload.details,
      status: 'open',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    const snap = await getDoc(ref);
    const data = snap.data() ?? {};
    return {
      id: ref.id,
      user_id: uid,
      category: data.category,
      details: data.details,
      status: data.status ?? 'open',
      created_at: toIso(data.createdAt) ?? new Date().toISOString(),
      updated_at: toIso(data.updatedAt) ?? new Date().toISOString(),
    };
  },

  async listMyConciergeRequests(): Promise<ConciergeRequest[]> {
    const uid = requireUid();
    const snap = await getDocs(
      query(collection(db, 'concierge_requests'), where('userId', '==', uid)),
    );
    return snap.docs
      .map((d) => {
        const data = d.data();
        return {
          id: d.id,
          user_id: uid,
          category: data.category,
          details: data.details,
          status: data.status ?? 'open',
          created_at: toIso(data.createdAt) ?? '',
          updated_at: toIso(data.updatedAt) ?? '',
        } as ConciergeRequest;
      })
      .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));
  },
};

export type Api = typeof api;
