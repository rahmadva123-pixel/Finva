const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Try to use service account file if available
// Check both current directory and parent directory for the service account file
const serviceAccountPath = fs.existsSync(path.join(process.cwd(), 'firebase-service-account.json'))
  ? path.join(process.cwd(), 'firebase-service-account.json')
  : path.join(process.cwd(), 'source-code-fixed', 'firebase-service-account.json');
let serviceAccount: any = null;

try {
	if (fs.existsSync(serviceAccountPath)) {
		serviceAccount = require(serviceAccountPath);
		console.log('Using service account file for Firebase Admin');
	}
} catch (e) {
	console.log('Service account file not found, will use environment variables');
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

let adminApp: any = null;
if (serviceAccount || isFirebaseAdminConfigured()) {
	try {
		console.log('Attempting Firebase Admin initialization...');

		if (!admin.apps || !admin.apps.length) {
			let credentialObj: any;

			if (serviceAccount) {
				credentialObj = admin.credential.cert(serviceAccount);
				console.log('Using service account file for credentials');
			} else {
				const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n') || '';
				const envServiceAccount = {
					projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
					clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
					privateKey,
				};
				credentialObj = admin.credential.cert(envServiceAccount);
				console.log('Using environment variables for credentials');
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
}

export function getFirebaseAdminApp() { return adminApp; }
export function getFirebaseAdminAuth() { return adminApp ? admin.auth() : null; }
export function getFirebaseAdminDb() { return adminApp ? admin.firestore() : null; }
export default admin;
