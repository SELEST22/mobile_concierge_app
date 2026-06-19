/**
 * Firebase initialisation for the mobile app.
 *
 * The mobile app and the web app share ONE Firebase project, so they read and
 * write the same Firestore data and authenticate against the same user pool.
 * That shared project is what keeps the two platforms in sync in real time.
 *
 * Config comes from `EXPO_PUBLIC_FIREBASE_*` env vars (see `.env.example`),
 * which mirror the web app's `NEXT_PUBLIC_FIREBASE_*` values.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  type Auth,
  getAuth,
  // @ts-expect-error — getReactNativePersistence is exported by firebase/auth
  // at runtime in React Native builds but missing from the web type surface.
  getReactNativePersistence,
  initializeAuth,
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Initialise once — Fast Refresh can re-run this module.
export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Auth needs AsyncStorage-backed persistence so sessions survive app restarts.
// initializeAuth throws if called twice, so fall back to getAuth on re-runs.
let _auth: Auth;
try {
  _auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch {
  _auth = getAuth(app);
}
export const auth = _auth;

export const db = getFirestore(app);
