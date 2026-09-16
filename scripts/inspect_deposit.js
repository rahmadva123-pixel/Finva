/**
 * Inspect deposit and related referral docs for debugging
 * Usage: node scripts/inspect_deposit.js <DEPOSIT_ID>
 * Requires GOOGLE_APPLICATION_CREDENTIALS env pointing to service account JSON
 */
const admin = require('firebase-admin');

if (!process.argv[2]) {
  console.error('Provide deposit id: node scripts/inspect_deposit.js <DEPOSIT_ID>');
  process.exit(1);
}
const depositId = process.argv[2];

admin.initializeApp();
const db = admin.firestore();

async function inspect() {
  const depRef = db.collection('deposits').doc(depositId);
  const depSnap = await depRef.get();
  if (!depSnap.exists) {
    console.log('Deposit not found:', depositId);
    return;
  }
  const dep = depSnap.data();
  console.log('Deposit:', depositId, dep);

  const userId = dep.userId;
  const userSnap = await db.collection('users').doc(userId).get();
  console.log('User:', userId, userSnap.exists ? userSnap.data() : 'not found');

  const referrerId = userSnap.exists ? userSnap.data().referredBy : null;
  if (referrerId) {
    const refSnap = await db.collection('users').doc(referrerId).get();
    console.log('Referrer:', referrerId, refSnap.exists ? refSnap.data() : 'not found');
  } else {
    console.log('No referrer on user document.');
  }

  // referralCommissions entries for this deposit's referred user
  const rcQ = db.collection('referralCommissions').where('referredUserId', '==', userId);
  const rcSnap = await rcQ.get();
  console.log('referralCommissions count:', rcSnap.size);
  rcSnap.forEach(d => console.log(d.id, d.data()));

  // refreshmentBonuses entries for this deposit's referred user
  const rbQ = db.collection('refreshmentBonuses').where('referredUserId', '==', userId);
  const rbSnap = await rbQ.get();
  console.log('refreshmentBonuses count:', rbSnap.size);
  rbSnap.forEach(d => console.log(d.id, d.data()));

  // settings/refreshment
  const sSnap = await db.collection('settings').doc('refreshment').get();
  console.log('settings/refreshment:', sSnap.exists ? sSnap.data() : 'not found');
}

inspect().then(()=>process.exit(0)).catch(e=>{ console.error(e); process.exit(2); });
