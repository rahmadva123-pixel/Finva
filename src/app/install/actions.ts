
'use server';

import { promises as fs } from 'fs';
import path from 'path';
import { z } from 'zod';

const FirebaseConfigSchema = z.object({
  apiKey: z.string().min(1, { message: 'API Key is required.' }),
  authDomain: z.string().min(1, { message: 'Auth Domain is required.' }),
  projectId: z.string().min(1, { message: 'Project ID is required.' }),
  storageBucket: z.string().min(1, { message: 'Storage Bucket is required.' }),
  messagingSenderId: z.string().min(1, { message: 'Messaging Sender ID is required.' }),
  appId: z.string().min(1, { message: 'App ID is required.' }),
});

export async function saveFirebaseConfig(formData: FormData) {
  const data = Object.fromEntries(formData.entries());
  const validatedFields = FirebaseConfigSchema.safeParse(data);

  if (!validatedFields.success) {
    return {
      success: false,
      message: 'Invalid configuration. All fields are required.',
    };
  }
  
  const { apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId } = validatedFields.data;

  const firebaseConfigContent = `
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
  apiKey: "${apiKey}",
  authDomain: "${authDomain}",
  projectId: "${projectId}",
  storageBucket: "${storageBucket}",
  messagingSenderId: "${messagingSenderId}",
  appId: "${appId}"
};

// Function to check if the firebase config is valid
export const isFirebaseConfigured = () => {
    return firebaseConfig && firebaseConfig.apiKey && firebaseConfig.apiKey !== "YOUR_API_KEY";
}

// Initialize Firebase
let app: FirebaseApp;
let auth: Auth;
let db: Firestore;

if (typeof window !== "undefined" && isFirebaseConfigured()) {
    if (!getApps().length) {
        app = initializeApp(firebaseConfig);
    } else {
        app = getApp();
    }
    auth = getAuth(app);
    db = getFirestore(app);
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
`;

  try {
    const filePath = path.join(process.cwd(), 'src', 'lib', 'firebase.ts');
    await fs.writeFile(filePath, firebaseConfigContent.trim(), 'utf8');
    return { success: true };
  } catch (error) {
    console.error("Failed to write firebase config", error);
    return {
      success: false,
      message: 'Failed to save Firebase configuration.',
    };
  }
}
