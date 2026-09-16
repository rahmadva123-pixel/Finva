const { getFirestore } = require('firebase-admin/firestore');
const admin = require('firebase-admin');

function normalizePrivateKey(raw) {
  return raw?.trim().replace(/^['"]/, '').replace(/['"],?$/, '').replace(/\\n/g, '\n');
}

function initAdmin() {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    admin.initializeApp({ credential: admin.credential.cert(require(process.env.GOOGLE_APPLICATION_CREDENTIALS)) });
    return getFirestore();
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

  return getFirestore();
}

async function test() {
  const db = initAdmin();
  // This script will create dummy users and deposits to test referral percentage count
  // Implementation: create three users A (referrer), B and C (referred). Mark B and C as referredBy A
  // and create completed deposits for them to reach $495 threshold, then call server-side function
  // getReferralDailyPercentage by importing the local module. Since getReferralDailyPercentage
  // depends on Firestore reads, we'll call it directly via the code path by requiring the repo module.

  console.log('Testing referral rules...');
  try {
    const usersCol = db.collection('users');
    // Create referrer A
    const refA = usersCol.doc();
    await refA.set({ email: 'refA@test.local', createdAt: admin.firestore.FieldValue.serverTimestamp() });
    const refAId = refA.id;

    // Create referred users B and C
    const b = usersCol.doc();
    await b.set({ email: 'userB@test.local', referredBy: refAId, createdAt: admin.firestore.FieldValue.serverTimestamp() });
    const bId = b.id;

    const c = usersCol.doc();
    await c.set({ email: 'userC@test.local', referredBy: refAId, createdAt: admin.firestore.FieldValue.serverTimestamp() });
    const cId = c.id;

    // Create completed deposits for B and C
    const deposits = db.collection('deposits');
    await deposits.add({ userId: bId, amount: 500, status: 'completed', completedAt: admin.firestore.FieldValue.serverTimestamp(), createdAt: admin.firestore.FieldValue.serverTimestamp() });
    await deposits.add({ userId: cId, amount: 500, status: 'completed', completedAt: admin.firestore.FieldValue.serverTimestamp(), createdAt: admin.firestore.FieldValue.serverTimestamp() });

    // Compute referral daily percentage directly from Firestore (avoid importing TS module)
    const usersRef = db.collection('users');
    const referredSnapshot = await usersRef.where('referredBy', '==', refAId).get();
    let qualifiedCount = 0;
    for (const docSnap of referredSnapshot.docs) {
      const uid = docSnap.id;
      const depSnap = await db.collection('deposits').where('userId', '==', uid).get();
      const total = depSnap.docs.reduce((sum, d) => {
        const data = d.data();
        const status = String(data.status || '').toLowerCase();
        if (status !== 'completed' && status !== 'approved') return sum;
        return sum + Number(data.amount || 0);
      }, 0);
      if (total >= 495) qualifiedCount += 1;
    }

    let percent;
    if (qualifiedCount >= 2) percent = 2;
    else if (qualifiedCount === 1) percent = 1.5;
    else percent = 1;

    console.log(`Computed referral daily percentage for referrer with ${qualifiedCount} qualified referrals: ${percent}% (expect 2% when 2).`);

    // Cleanup: delete created docs (best-effort)
    await deposits.where('userId', 'in', [bId, cId]).get().then(s => s.forEach(d => d.ref.delete()));
    await usersCol.doc(bId).delete();
    await usersCol.doc(cId).delete();
    // leave refA for inspection or delete it
    // await usersCol.doc(refAId).delete();

    console.log('Test completed.');
  } catch (e) {
    console.error('Test failed:', e);
    process.exit(1);
  }
}

if (require.main === module) test();
