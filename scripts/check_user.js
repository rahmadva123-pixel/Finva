const admin = require('firebase-admin');
const path = process.argv[2];
const email = process.argv[3];
if (!path || !email) {
  console.error('Usage: node scripts/check_user.js <service-account.json> <email>');
  process.exit(1);
}
try {
  const serviceAccount = require(path);
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
} catch (e) {
  console.error('Failed to load service account:', e.message || e);
  process.exit(1);
}
(async () => {
  try {
    const auth = admin.auth();
    const db = admin.firestore();
    const user = await auth.getUserByEmail(email);
    console.log('uid:', user.uid);
    const docRef = db.collection('users').doc(user.uid);
    const doc = await docRef.get();
    console.log('exists:', doc.exists);
    console.log('data:', JSON.stringify(doc.exists ? doc.data() : null, null, 2));
    process.exit(0);
  } catch (e) {
    console.error('Error:', e.message || e);
    process.exit(1);
  }
})();
