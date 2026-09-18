import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  type ActionCodeSettings,
  type Auth,
  sendEmailVerification,
  sendPasswordResetEmail,
  type User,
} from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyBv4pD1bouoGQ2wi_hTcBPtMVXIurJhCOo",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "finva-90b5c.firebaseapp.com",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "finva-90b5c",
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "finva-90b5c.appspot.com",
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "242382813907",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:242382813907:web:d72012f3b6372f35a93226",
};

// Function to check if the firebase config is valid
export const isFirebaseConfigured = () => {
    return firebaseConfig && firebaseConfig.apiKey && firebaseConfig.apiKey !== "YOUR_API_KEY";
}

// Initialize Firebase
let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;

if (typeof window !== "undefined" && isFirebaseConfigured()) {
    try {
        if (!getApps().length) {
            app = initializeApp(firebaseConfig);
        } else {
            app = getApp();
        }
        auth = getAuth(app);
        try {
            db = getFirestore(app);
        } catch (dbErr) {
            // Firestore initialization may succeed but network calls can fail later.
            console.warn('Firestore initialization warning', dbErr);
            db = undefined;
        }
    } catch (initErr) {
        console.error('Firebase initialization failed', initErr);
        app = undefined;
        auth = undefined;
        db = undefined;
    }
}

// Lightweight reachability check for Firestore REST endpoint.
let _firestoreReachable: boolean | undefined;
export async function checkFirestoreReachable(timeout = 3000): Promise<boolean> {
    if (_firestoreReachable !== undefined) return _firestoreReachable;
    try {
        const projectId = firebaseConfig.projectId;
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);
        const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents?pageSize=1`;
        const resp = await fetch(url, { method: 'GET', mode: 'cors', signal: controller.signal });
        clearTimeout(id);
        // If fetch succeeded (even with 4xx), network is reachable.
        _firestoreReachable = resp.status >= 200 && resp.status < 500 || resp.status >= 400;
        return _firestoreReachable;
    } catch (err) {
        _firestoreReachable = false;
        return false;
    }
}

function buildActionCodeSettings(path = "/login"): ActionCodeSettings | undefined {
    if (typeof window === "undefined") {
        return undefined;
    }

    try {
        const origin = new URL(window.location.origin).origin;
        const normalizedPath = path.startsWith("/") ? path : "/" + path;

        return {
            url: origin + normalizedPath,
            handleCodeInApp: false,
        };
    } catch {
        return undefined;
    }
}

function shouldRetryWithoutActionCode(error: unknown) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
    return code === "auth/invalid-continue-uri" || code === "auth/unauthorized-continue-uri";
}

export async function sendVerificationEmailToUser(user: User) {
    const actionCodeSettings = buildActionCodeSettings("/login");

    try {
        if (actionCodeSettings) {
            return await sendEmailVerification(user, actionCodeSettings);
        }
    } catch (error) {
        if (!shouldRetryWithoutActionCode(error)) {
            throw error;
        }
    }

    return sendEmailVerification(user);
}

export async function sendPasswordResetEmailToUser(auth: Auth, email: string) {
    const actionCodeSettings = buildActionCodeSettings("/login");

    try {
        if (actionCodeSettings) {
            return await sendPasswordResetEmail(auth, email, actionCodeSettings);
        }
    } catch (error) {
        if (!shouldRetryWithoutActionCode(error)) {
            throw error;
        }
    }

    return sendPasswordResetEmail(auth, email);
}

export { app, auth, db };
export default firebaseConfig;