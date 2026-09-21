const { initializeApp, cert, applicationDefault } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const path = require('path');

async function main() {
  const args = process.argv.slice(2);
  const serviceAccount = args[0];
  const runDateArg = args[1]; // optional YYYY-MM-DD

  if (!serviceAccount && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.error('Usage: node scripts/accrue-daily-earnings.js <SERVICE_ACCOUNT_JSON> [YYYY-MM-DD]');
    process.exit(1);
  }

  if (serviceAccount) initializeApp({ credential: cert(require(path.resolve(serviceAccount))) });
  else initializeApp({ credential: applicationDefault() });

  const db = getFirestore();

  const runDate = runDateArg ? new Date(runDateArg) : new Date();
  runDate.setHours(0,0,0,0);
  const runId = runDate.toISOString().slice(0,10); // YYYY-MM-DD

  console.log('Running daily accrual for', runId);

  // Check for existing run
  const runDocRef = db.collection('dailyEarningsRuns').doc(runId);
  const runSnap = await runDocRef.get();
  if (runSnap.exists) {
    console.log('Accrual already ran for', runId);
    process.exit(0);
  }

  // Load config
  const settingsSnap = await db.collection('settings').doc('dailyEarnings').get();
  if (!settingsSnap.exists) {
    console.error('dailyEarnings settings not found. Create settings/dailyEarnings with { rate: 0.0005, payoutMethod: "auto" | "pending", minBalance: 0 }');
    process.exit(1);
  }

  const settings = settingsSnap.data();
  const payoutMethod = settings.payoutMethod || 'pending';
  const minBalance = Number(settings.minBalance || 0);
  const normalizeRate = (value) => {
    const rate = Number(value || 0);
    // Accept both decimal rates (0.02) and admin-entered percentages (2).
    return Math.abs(rate) > 1 ? rate / 100 : rate;
  };
  const defaultTiers = [
    { minReferrals: 0, rate: 0.015 },
    { minReferrals: 1, rate: 0.02 },
    { minReferrals: 2, rate: 0.025 },
  ];
  // Optional override: [{ minReferrals: 0, rate: 0.015 }, ...]
  const configuredTiers = Array.isArray(settings.tiers)
    ? settings.tiers.map(t => ({ minReferrals: Number(t.minReferrals || 0), rate: normalizeRate(t.rate) }))
    : null;
  const tiers = configuredTiers?.length ? configuredTiers : defaultTiers;
  const batchSize = 500;

  console.log({ tiers, payoutMethod, minBalance });

  const usersCol = db.collection('users');
  const q = usersCol.where('role', '!=', 'system').limit(batchSize); // simple example: exclude internal users

  let processed = 0;
  let last = null;

  try {
    // mark run as in-progress
    await runDocRef.set({ startedAt: FieldValue.serverTimestamp(), status: 'in_progress', tiers, payoutMethod, minBalance });

    // Precompute referral relationships and eligible referred users (those with completed deposits)
    const usersSnapshot = await db.collection('users').get();
    const userMap = new Map();
    usersSnapshot.docs.forEach(d => userMap.set(d.id, d.data()));

    // Build children map: referrerId -> [childUserId]
    const childrenMap = new Map();
    for (const [uid, udata] of userMap.entries()) {
      const ref = udata.referredBy;
      if (ref) {
        if (!childrenMap.has(ref)) childrenMap.set(ref, []);
        childrenMap.get(ref).push(uid);
      }
    }

    // Build set of users who have at least one completed/approved deposit
    const completedDepsSnap = await db.collection('deposits').where('status', 'in', ['completed', 'approved']).get();
    const eligibleSet = new Set();
    completedDepsSnap.docs.forEach(d => {
      const data = d.data();
      if (data && data.userId) eligibleSet.add(String(data.userId));
    });

    while (true) {
      let query = usersCol.orderBy('uid').limit(batchSize);
      if (last) query = query.startAfter(last);

      const snap = await query.get();
      if (snap.empty) break;

      const batch = db.batch();

      for (const doc of snap.docs) {
        last = doc;
        const user = doc.data();
        const uid = doc.id;
        const balance = Number(user.balance || 0);
        if (balance < minBalance) continue;

        // determine number of direct referrals with completed deposits
        const children = childrenMap.get(uid) || [];
        let directCompletedCount = 0;
        for (const cid of children) {
          if (eligibleSet.has(cid)) directCompletedCount += 1;
        }

        // determine rate: use configured tiers if present, otherwise use our rules
        let rate = 0;
        // Pick the highest referral threshold reached by this user.
        const sortedTiers = [...tiers].sort((a, b) => b.minReferrals - a.minReferrals);
        for (const tier of sortedTiers) {
          if (directCompletedCount >= tier.minReferrals) {
            rate = tier.rate;
            break;
          }
        }

        const daily = Math.round((balance * rate + Number.EPSILON) * 100) / 100; // cents precision
        if (daily <= 0) continue;

        // Create earning transaction
        const etRef = db.collection('earningTransactions').doc();
        const et = {
          userId: uid,
          amount: daily,
          rate,
          directCompletedReferrals: directCompletedCount,
          date: new Date(runId + 'T00:00:00Z'),
          createdAt: FieldValue.serverTimestamp(),
          type: 'dailyEarning',
          status: payoutMethod === 'auto' ? 'credited' : 'pending',
          description: `Daily earnings for ${runId} at rate ${rate}`
        };
        batch.set(etRef, et);

        // Apply to user depending on payoutMethod
        const userRef = usersCol.doc(uid);
        if (payoutMethod === 'auto') {
          batch.update(userRef, { balance: Number((balance + daily).toFixed(2)), totalEarning: Number(((user.totalEarning || 0) + daily).toFixed(2)) });
        } else {
          // add to pendingEarnings
          const pending = Number(user.pendingEarnings || 0) + daily;
          batch.update(userRef, { pendingEarnings: Number(pending.toFixed(2)) });
        }

        processed += 1;
      }

      await batch.commit();
      if (snap.size < batchSize) break;
    }

    await runDocRef.update({ completedAt: FieldValue.serverTimestamp(), status: 'done', processed });
    console.log('Accrual finished. Processed users:', processed);
  } catch (e) {
    console.error('Accrual failed:', e);
    await runDocRef.update({ status: 'failed', error: String(e) }).catch(() => {});
    process.exit(2);
  }
}

main();
