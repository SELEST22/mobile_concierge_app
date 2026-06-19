/**
 * End-to-end smoke test against the LIVE Firebase project.
 *
 * Exercises every mobile data flow the way the app does, using two concurrent
 * sessions (an admin + a guest). Verifies cross-user sync and whether the
 * production Firestore rules permit the mobile writes. Cleans up after itself.
 *
 *   node apps/mobile/scripts/smokeTest.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  deleteUser,
  getAuth,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';

// ---- load the public Firebase config from apps/mobile/.env -----------------
const here = dirname(fileURLToPath(import.meta.url));
const env = {};
for (const line of readFileSync(resolve(here, '../.env'), 'utf8').split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
}
const firebaseConfig = {
  apiKey: env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

// Two app instances so admin + guest can be signed in at once.
const adminApp = initializeApp(firebaseConfig, 'smoke-admin');
const guestApp = initializeApp(firebaseConfig, 'smoke-guest');
const adminAuth = getAuth(adminApp);
const guestAuth = getAuth(guestApp);
const adminDb = getFirestore(adminApp);
const guestDb = getFirestore(guestApp);

const rand = Math.random().toString(36).slice(2, 8);
const ADMIN = { email: `smoke_admin_${rand}@concierge.dev`, password: 'test123456', name: 'Smoke Admin' };
const GUEST = { email: `smoke_guest_${rand}@concierge.dev`, password: 'test123456', name: 'Smoke Guest' };

let pass = 0;
let fail = 0;
const ok = (m) => { pass++; console.log(`  ✓ ${m}`); };
const bad = (m, e) => { fail++; console.log(`  ✗ ${m}\n      -> ${e?.code || e?.message || e}`); };

async function step(name, fn) {
  try { await fn(); ok(name); } catch (e) { bad(name, e); }
}

async function main() {
  console.log(`\nFirebase project: ${firebaseConfig.projectId}\n`);
  let adminUid, guestUid, eventId;
  const createdBroadcasts = [];
  let conciergeId;

  console.log('AUTH + PROFILES');
  await step('admin: create account (Firebase Auth)', async () => {
    const cred = await createUserWithEmailAndPassword(adminAuth, ADMIN.email, ADMIN.password);
    adminUid = cred.user.uid;
  });
  await step('guest: create account (Firebase Auth)', async () => {
    const cred = await createUserWithEmailAndPassword(guestAuth, GUEST.email, GUEST.password);
    guestUid = cred.user.uid;
  });
  await step('admin: write users/{uid} profile (role=admin)', async () => {
    await setDoc(doc(adminDb, 'users', adminUid), {
      email: ADMIN.email, name: ADMIN.name, role: 'admin',
      organization: 'Smoke Venue', notifications_consent: true, security_need: null,
      createdAt: serverTimestamp(),
    }, { merge: true });
  });
  await step('guest: write users/{uid} profile (role=user)', async () => {
    await setDoc(doc(guestDb, 'users', guestUid), {
      email: GUEST.email, name: GUEST.name, role: 'user',
      organization: null, notifications_consent: true, security_need: null,
      createdAt: serverTimestamp(),
    }, { merge: true });
  });

  console.log('\nEVENTS');
  await step('admin: create event', async () => {
    const ref = await addDoc(collection(adminDb, 'events'), {
      eventName: 'Smoke Event', date: 'Sat 12 Jul, 8PM', location: 'Rooftop',
      description: 'test', adminId: adminUid, createdAt: serverTimestamp(),
    });
    eventId = ref.id;
  });
  await step('admin: list own events (adminId == me)', async () => {
    const snap = await getDocs(query(collection(adminDb, 'events'), where('adminId', '==', adminUid)));
    if (!snap.docs.some((d) => d.id === eventId)) throw new Error('created event not in list');
  });
  await step('guest: join event (set connectedEventId)', async () => {
    const ev = await getDoc(doc(guestDb, 'events', eventId));
    if (!ev.exists()) throw new Error('guest cannot read event');
    await updateDoc(doc(guestDb, 'users', guestUid), {
      connectedEventId: eventId, connectedAdminId: adminUid, lastConnected: serverTimestamp(),
    });
  });
  await step('admin: member count (users where connectedEventId == event)', async () => {
    const m = await getDocs(query(collection(adminDb, 'users'), where('connectedEventId', '==', eventId)));
    if (m.size < 1) throw new Error('guest not counted as member');
  });

  console.log('\nBROADCASTS');
  for (const type of ['general', 'emergency']) {
    await step(`admin: send ${type} broadcast`, async () => {
      const exp = new Date(); exp.setDate(exp.getDate() + 30);
      const ref = await addDoc(collection(adminDb, 'broadcast_messages'), {
        title: `${type} title`, message: `${type} body`, type,
        eventId, eventName: 'Smoke Event', createdBy: adminUid, createdByEmail: ADMIN.email,
        createdAt: serverTimestamp(), expiresAt: Timestamp.fromDate(exp), isActive: true,
      });
      createdBroadcasts.push(ref.id);
    });
  }
  await step('admin: list own sent broadcasts', async () => {
    const snap = await getDocs(query(collection(adminDb, 'broadcast_messages'), where('createdBy', '==', adminUid)));
    if (snap.size < 2) throw new Error(`expected 2, got ${snap.size}`);
  });

  console.log('\nGUEST INBOX (the real-time feed)');
  await step('guest: read inbox (isActive + eventId match) — sees 2', async () => {
    const snap = await getDocs(query(
      collection(guestDb, 'broadcast_messages'),
      where('isActive', '==', true), where('eventId', '==', eventId),
    ));
    if (snap.size < 2) throw new Error(`guest sees ${snap.size}, expected 2 (cross-user sync broken)`);
  });
  await step('guest: mark a broadcast read (message_status)', async () => {
    await setDoc(doc(guestDb, 'users', guestUid, 'message_status', createdBroadcasts[0]),
      { readAt: serverTimestamp() }, { merge: true });
  });
  await step('guest: archive a broadcast', async () => {
    await setDoc(doc(guestDb, 'users', guestUid, 'message_status', createdBroadcasts[1]),
      { isArchived: true, archivedAt: serverTimestamp(), readAt: serverTimestamp() }, { merge: true });
  });
  await step('guest: read archived (message_status where isArchived)', async () => {
    const snap = await getDocs(query(
      collection(guestDb, 'users', guestUid, 'message_status'), where('isArchived', '==', true)));
    if (snap.size < 1) throw new Error('archived not found');
  });
  await step('guest: delete a broadcast for self (isDeleted flag)', async () => {
    await setDoc(doc(guestDb, 'users', guestUid, 'message_status', createdBroadcasts[0]),
      { isDeleted: true, deletedAt: serverTimestamp() }, { merge: true });
  });

  console.log('\nCONCIERGE');
  await step('guest: create concierge request', async () => {
    const ref = await addDoc(collection(guestDb, 'concierge_requests'), {
      userId: guestUid, category: 'concierge', details: 'towel please',
      status: 'open', createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
    conciergeId = ref.id;
  });
  await step('guest: list own concierge requests', async () => {
    const snap = await getDocs(query(collection(guestDb, 'concierge_requests'), where('userId', '==', guestUid)));
    if (snap.size < 1) throw new Error('request not found');
  });

  console.log('\nADMIN MODERATION');
  await step('admin: retire a broadcast (isActive=false)', async () => {
    await updateDoc(doc(adminDb, 'broadcast_messages', createdBroadcasts[1]), { isActive: false });
  });

  // ---- cleanup -------------------------------------------------------------
  console.log('\nCLEANUP');
  await step('delete broadcasts', async () => {
    for (const id of createdBroadcasts) await deleteDoc(doc(adminDb, 'broadcast_messages', id));
  });
  await step('delete event', async () => { await deleteDoc(doc(adminDb, 'events', eventId)); });
  await step('delete concierge request', async () => { await deleteDoc(doc(guestDb, 'concierge_requests', conciergeId)); });
  await step('delete guest message_status + user doc', async () => {
    const ss = await getDocs(collection(guestDb, 'users', guestUid, 'message_status'));
    for (const s of ss.docs) await deleteDoc(s.ref);
    await deleteDoc(doc(guestDb, 'users', guestUid));
  });
  await step('delete admin user doc', async () => { await deleteDoc(doc(adminDb, 'users', adminUid)); });
  await step('delete auth users', async () => {
    if (adminAuth.currentUser) await deleteUser(adminAuth.currentUser);
    if (guestAuth.currentUser) await deleteUser(guestAuth.currentUser);
  });

  console.log(`\n========================\nPASS: ${pass}   FAIL: ${fail}\n========================`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
