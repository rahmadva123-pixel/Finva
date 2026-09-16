#!/usr/bin/env node
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

function normalizePrivateKey(raw) {
  if (!raw) return raw;
  return raw.trim().replace(/^['"]/, '').replace(/['"],?$/, '').replace(/\\n/g, '\n');
}

function initAdmin() {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    const abs = path.isAbsolute(credPath) ? credPath : path.join(process.cwd(), credPath);
    if (!fs.existsSync(abs)) throw new Error(`Service account file not found: ${abs}`);
    admin.initializeApp({ credential: admin.credential.cert(require(abs)) });
    return admin.firestore();
  }

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const rawPrivateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;
  const privateKey = normalizePrivateKey(rawPrivateKey);

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Missing Firebase admin credentials. Set GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_ADMIN_* env vars.');
  }

  admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
  });

  return admin.firestore();
}

async function run() {
  try {
    const db = initAdmin();
    const ref = db.collection('settings').doc('referral');
    const snap = await ref.get();
    if (!snap.exists) {
      console.log('No referral settings found at settings/referral');
      return;
    }

    const data = snap.data();
    const timestamp = Date.now();
    const backupId = `referral_backup_${timestamp}`;
    const backupRef = db.collection('settings').doc(backupId);

    await backupRef.set({ ...data, backupAt: admin.firestore.FieldValue.serverTimestamp() });
    console.log(`Backed up settings/referral to settings/${backupId}`);
  } catch (err) {
    console.error('Backup failed:', err.message || err);
    process.exit(1);
  }
}

if (require.main === module) run();
