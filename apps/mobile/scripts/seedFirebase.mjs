/**
 * Seeds the shared Firebase project with the demo accounts used in the email
 * to the client (admin@concierge.dev / guest@concierge.dev).
 *
 * These accounts live in Firebase Auth + a matching users/{uid} Firestore doc,
 * so they work on BOTH the mobile app and the web app.
 *
 * Usage (from repo root or apps/mobile):
 *   1. Provide Firebase Admin credentials via env (same values the web app uses):
 *        FIREBASE_ADMIN_PROJECT_ID=...
 *        FIREBASE_ADMIN_CLIENT_EMAIL=...
 *        FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
 *      (or FIREBASE_ADMIN_CREDENTIALS='<service-account-json>')
 *   2. node apps/mobile/scripts/seedFirebase.mjs
 *
 * Requires the `firebase-admin` package (a devDependency of apps/mobile).
 */
import admin from 'firebase-admin';

function getServiceAccount() {
  if (process.env.FIREBASE_ADMIN_CREDENTIALS) {
    return JSON.parse(process.env.FIREBASE_ADMIN_CREDENTIALS);
  }
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Set FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL and FIREBASE_ADMIN_PRIVATE_KEY.');
  }
  return { projectId, clientEmail, privateKey };
}

const DEMO_USERS = [
  { email: 'admin@concierge.dev', password: 'admin123', name: 'Demo Admin', role: 'admin', organization: 'Selest Demo Venue' },
  { email: 'guest@concierge.dev', password: 'guest123', name: 'Demo Guest', role: 'user', organization: null },
];

async function main() {
  admin.initializeApp({ credential: admin.credential.cert(getServiceAccount()) });
  const auth = admin.auth();
  const db = admin.firestore();

  for (const u of DEMO_USERS) {
    let uid;
    try {
      const existing = await auth.getUserByEmail(u.email);
      uid = existing.uid;
      await auth.updateUser(uid, { password: u.password, displayName: u.name });
      console.log(`Updated auth user ${u.email}`);
    } catch {
      const created = await auth.createUser({ email: u.email, password: u.password, displayName: u.name });
      uid = created.uid;
      console.log(`Created auth user ${u.email}`);
    }

    await db.collection('users').doc(uid).set(
      {
        email: u.email,
        name: u.name,
        role: u.role,
        organization: u.organization,
        notifications_consent: true,
        security_need: null,
      },
      { merge: true },
    );
    console.log(`Wrote users/${uid} (${u.role})`);
  }

  console.log('Done.');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
