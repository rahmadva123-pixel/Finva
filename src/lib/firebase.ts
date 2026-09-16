import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

export const isFirebaseConfigured = () => !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY && !!process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN && !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

let app = null;
let auth = null;
let db = null;

if (isFirebaseConfigured()) {
  try {
    const config = {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
      measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
    };

    if (!getApps().length) {
      app = initializeApp(config);
    } else {
      app = getApp();
    }

    auth = getAuth(app);
    db = getFirestore(app);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Firebase client init error:', err?.message || err);
  }
}

export { app, auth, db };

export async function sendVerificationEmailToUser() {
  if (!auth) return false;
  // Implementation can be added when re-enabling auth flows.
  return false;
}

export async function sendPasswordResetEmailToUser() {
  if (!auth) return false;
  return false;
}