const admin = require('firebase-admin');
const path = require('path');

const serviceAccount = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!serviceAccount) {
  console.error('Please set GOOGLE_APPLICATION_CREDENTIALS to your service account json path.');
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.applicationDefault() });
const db = admin.firestore();

async function main() {
  const docRef = db.collection('settings').doc('bonus');
  const snap = await docRef.get();
  const data = snap.exists ? snap.data() : {};
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const backupRef = db.collection('settings').doc(`bonus_backup_${ts}`);
  await backupRef.set({ backedUpAt: admin.firestore.FieldValue.serverTimestamp(), data });
  console.log('Backed up settings/bonus to settings/bonus_backup_' + ts);
}

main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(2); });
