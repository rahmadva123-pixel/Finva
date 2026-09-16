import admin from 'firebase-admin';

export function isFirebaseAdminConfigured() {
	return !!process.env.FIREBASE_ADMIN_PROJECT_ID && !!process.env.FIREBASE_ADMIN_CLIENT_EMAIL && !!process.env.FIREBASE_ADMIN_PRIVATE_KEY;
}

let adminApp = null;
if (isFirebaseAdminConfigured()) {
	try {
		const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n');
		if (!admin.apps.length) {
			admin.initializeApp({
				credential: admin.credential.cert({
					projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
					clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
					privateKey,
				}),
			});
		}
		adminApp = admin.app();
	} catch (err) {
		// keep as stub if initialization fails
		// eslint-disable-next-line no-console
		console.error('Firebase Admin init error:', err?.message || err);
	}
}

export function getFirebaseAdminApp() { return adminApp; }
export function getFirebaseAdminAuth() { return adminApp ? admin.auth() : null; }
export function getFirebaseAdminDb() { return adminApp ? admin.firestore() : null; }
export default admin;
