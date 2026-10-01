import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

let adminApp: any = null;

// Try to use service account file if available
const serviceAccountPath = existsSync(join(process.cwd(), 'firebase-service-account.json'))
  ? join(process.cwd(), 'firebase-service-account.json')
  : join(process.cwd(), 'source-code-fixed', 'firebase-service-account.json');

let serviceAccount: any = null;

try {
	if (existsSync(serviceAccountPath)) {
		serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
	}
} catch (e) {
	// Service account file not found, will use environment variables
}

function getServiceAccountFromEnv() {
	const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
	const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
	const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');

	if (!projectId || !clientEmail || !privateKey) {
		return null;
	}

	return {
		type: 'service_account',
		project_id: projectId,
		private_key_id: '',
		private_key: privateKey,
		client_email: clientEmail,
		client_id: '',
		auth_uri: 'https://accounts.google.com/o/oauth2/auth',
		token_uri: 'https://oauth2.googleapis.com/token',
		auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
		client_x509_cert_url: ''
	};
}

export function isFirebaseAdminConfigured() {
	const hasProjectId = !!process.env.FIREBASE_ADMIN_PROJECT_ID;
	const hasClientEmail = !!process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
	const hasPrivateKey = !!process.env.FIREBASE_ADMIN_PRIVATE_KEY;

	// If service account file exists, consider it configured
	if (serviceAccount) {
		return true;
	}

	return hasProjectId && hasClientEmail && hasPrivateKey;
}

function initializeFirebaseAdmin() {
	if (adminApp) return adminApp;

	if (!serviceAccount && !isFirebaseAdminConfigured()) {
		throw new Error('Firebase Admin not configured');
	}

	try {
		const serviceAccountToUse = serviceAccount || getServiceAccountFromEnv();

		if (!serviceAccountToUse) {
			throw new Error('No service account available');
		}

		if (getApps().length === 0) {
			adminApp = initializeApp({
				credential: cert(serviceAccountToUse),
			});
		} else {
			adminApp = getApps()[0];
		}
	} catch (err: any) {
		console.error('Firebase Admin init error:', err?.message || err);
		throw new Error('Firebase Admin initialization failed');
	}

	return adminApp;
}

export function getFirebaseAdminApp() {
	if (!adminApp) return initializeFirebaseAdmin();
	return adminApp;
}

export function getFirebaseAdminAuth() {
	const app = getFirebaseAdminApp();
	return getAuth(app);
}

export function getFirebaseAdminDb() {
	const app = getFirebaseAdminApp();
	return getFirestore(app);
}

// Backward compatibility: export admin-like object
const admin = {
	app: getFirebaseAdminApp,
	auth: () => {
		const app = getFirebaseAdminApp();
		return getAuth(app);
	},
	firestore: () => {
		const app = getFirebaseAdminApp();
		return getFirestore(app);
	},
	credential: {
		cert: (credentials: any) => cert(credentials)
	},
	initializeApp: (options: any) => {
		adminApp = initializeApp(options);
		return adminApp;
	},
	apps: []
};

export default admin;
