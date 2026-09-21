const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const path = require('path');

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error('Usage: node scripts/fetch-user-bonuses.js <USER_UID> [SERVICE_ACCOUNT_JSON]');
    process.exit(1);
  }

  const userId = args[0];
  const saPath = args[1];

  if (saPath) {
    initializeApp({ credential: cert(require(path.resolve(saPath))) });
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    initializeApp();
  } else {
    console.error('Service account JSON path not provided and GOOGLE_APPLICATION_CREDENTIALS not set.');
    process.exit(1);
  }

  const db = getFirestore();

  try {
    console.log('Fetching bonusTransactions for user', userId);
    const bonusesSnap = await db.collection('bonusTransactions').where('userId', '==', userId).orderBy('date', 'desc').limit(50).get();
    console.log(`Found ${bonusesSnap.size} bonusTransactions:`);
    bonusesSnap.forEach(doc => {
      console.log({ id: doc.id, ...doc.data() });
    });

    console.log('\nFetching referralCommissions for user (as referrer or referred)');
    const rcRef = db.collection('referralCommissions');
    const asRef = await rcRef.where('referrerId', '==', userId).orderBy('date', 'desc').limit(50).get();
    const asReferred = await rcRef.where('referredUserId', '==', userId).orderBy('date', 'desc').limit(50).get();

    console.log(`As referrer: ${asRef.size}`);
    asRef.forEach(doc => console.log({ id: doc.id, ...doc.data() }));
    console.log(`As referred: ${asReferred.size}`);
    asReferred.forEach(doc => console.log({ id: doc.id, ...doc.data() }));

    console.log('\nFetching deposit transactions for user');
    const deposits = await db.collection('deposits').where('userId', '==', userId).orderBy('createdAt', 'desc').limit(20).get();
    console.log(`Deposits: ${deposits.size}`);
    deposits.forEach(d => console.log({ id: d.id, ...d.data() }));

    console.log('\nDone');
  } catch (err) {
    console.error('Error fetching data', err);
    process.exit(2);
  }
}

main();
