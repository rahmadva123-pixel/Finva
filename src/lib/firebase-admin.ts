const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const os = require('os');

let adminApp: any = null;
let initializationAttempted = false;

// Try to use service account file if available
// Check both current directory and parent directory for the service account file
const serviceAccountPath = fs.existsSync(path.join(process.cwd(), 'firebase-service-account.json'))
  ? path.join(process.cwd(), 'firebase-service-account.json')
  : path.join(process.cwd(), 'source-code-fixed', 'firebase-service-account.json');
let serviceAccount: any = null;

try {
	if (fs.existsSync(serviceAccountPath)) {
		serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
		console.log('Using service account file for Firebase Admin');
	}
} catch (e) {
	console.log('Service account file not found, will use environment variables');
}

// Create service account file from environment variables at runtime
function createServiceAccountFromEnv() {
	const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
	const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
	const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');

	if (!projectId || !clientEmail || !privateKey) {
		return null;
	}

	const serviceAccount = {
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

	// Write to temp file
	const tempDir = os.tmpdir();
	const tempFilePath = path.join(tempDir, 'firebase-service-account-temp.json');
	fs.writeFileSync(tempFilePath, JSON.stringify(serviceAccount, null, 2));
	console.log('Created temporary service account file from environment variables:', tempFilePath);

	return tempFilePath;
}

export function isFirebaseAdminConfigured() {
	const hasProjectId = !!process.env.FIREBASE_ADMIN_PROJECT_ID;
	const hasClientEmail = !!process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
	const hasPrivateKey = !!process.env.FIREBASE_ADMIN_PRIVATE_KEY;

	// If service account file exists, consider it configured
	if (serviceAccount) {
		return true;
	}

	// Debug logging to see what's missing
	console.log('Firebase Admin Config Check:', {
		hasProjectId,
		hasClientEmail,
		hasPrivateKey,
		projectId: process.env.FIREBASE_ADMIN_PROJECT_ID ? 'SET' : 'NOT SET',
		clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL ? 'SET' : 'NOT SET',
		privateKeyLength: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.length || 0,
		isConfigured: hasProjectId && hasClientEmail && hasPrivateKey
	});

	return hasProjectId && hasClientEmail && hasPrivateKey;
}

function initializeFirebaseAdmin() {
	if (initializationAttempted) return adminApp;
	initializationAttempted = true;

	if (!serviceAccount && !isFirebaseAdminConfigured()) {
		console.log('Firebase Admin not configured, skipping initialization');
		return null;
	}

	try {
		console.log('Attempting Firebase Admin initialization...');

		if (!admin.apps || admin.apps.length === 0) {
			let credentialObj: any;
			let serviceAccountToUse = serviceAccount;

			// If no service account file exists but env vars are present, create temp file
			if (!serviceAccount && isFirebaseAdminConfigured()) {
				const tempFilePath = createServiceAccountFromEnv();
				if (tempFilePath) {
					serviceAccountToUse = JSON.parse(fs.readFileSync(tempFilePath, 'utf8'));
					console.log('Using temporary service account file from environment variables');
				}
			}

			if (serviceAccountToUse) {
				credentialObj = admin.credential.cert(serviceAccountToUse);
				console.log('Using service account for credentials');
			} else {
				throw new Error('No service account available');
			}

			admin.initializeApp({
				credential: credentialObj,
			});
		}
		adminApp = admin.app();
		console.log('Firebase Admin initialized successfully');
	} catch (err: any) {
		// keep as stub if initialization fails
		// eslint-disable-next-line no-console
		console.error('Firebase Admin init error:', err?.message || err);
		console.error('Full error:', err);
	}

	return adminApp;
}

export function getFirebaseAdminApp() {
	console.log('getFirebaseAdminApp called, adminApp:', !!adminApp);
	if (!adminApp) return initializeFirebaseAdmin();
	return adminApp;
}

export function getFirebaseAdminAuth() {
	console.log('getFirebaseAdminAuth called');
	const app = getFirebaseAdminApp();
	const auth = app ? admin.auth() : null;
	console.log('getFirebaseAdminAuth returning:', !!auth);
	return auth;
}

export function getFirebaseAdminDb() {
	console.log('getFirebaseAdminDb called');
	const app = getFirebaseAdminApp();
	const db = app ? admin.firestore() : null;
	console.log('getFirebaseAdminDb returning:', !!db);
	return db;
}

export default admin;
