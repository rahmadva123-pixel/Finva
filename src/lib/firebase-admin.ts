const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Try to use service account file if available
const serviceAccountPath = path.join(process.cwd(), 'firebase-service-account.json');
let serviceAccount = null;

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
	
	// Debug logging to see what's missing
	console.log('Firebase Admin Config Check:', {
		hasProjectId,
		hasClientEmail,
		hasPrivateKey,
		projectId: process.env.FIREBASE_ADMIN_PROJECT_ID ? 'SET' : 'NOT SET',
		clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL ? 'SET' : 'NOT SET',
		privateKeyLength: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.length || 0
	});
	
	return hasProjectId && hasClientEmail && hasPrivateKey;
}

let adminApp = null;
if (serviceAccount || isFirebaseAdminConfigured()) {
	try {
		console.log('Attempting Firebase Admin initialization...');
		
		if (!admin.apps || !admin.apps.length) {
			let credentialObj;
			
			if (serviceAccount) {
				credentialObj = admin.credential.cert(serviceAccount);
				console.log('Using service account file for credentials');
			} else {
				const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n');
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
	} catch (err) {
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
