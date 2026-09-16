/**
 * Backfill script to snapshot current promo percent into users.{legacyPromoPercent}
 * Usage:
 *   set GOOGLE_APPLICATION_CREDENTIALS to a service account JSON
 *   node scripts/backfill_promo.js [--dry-run] [--force]
 */
const admin = require('firebase-admin');


const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run') && !args.includes('--run');
const force = args.includes('--force');
const pageSize = Number(process.env.PAGE_SIZE || 200);
const batchSize = Number(process.env.BATCH_SIZE || 500);
const delayMs = Number(process.env.DELAY_MS || 300);

// Quick safety switch: if DISABLE_SCHEDULED_JOBS=true, exit immediately.
if (process.env.DISABLE_SCHEDULED_JOBS === 'true') {
  console.log('Scheduled jobs are disabled via DISABLE_SCHEDULED_JOBS=true. Exiting backfill_promo without scanning users.');
  process.exit(0);
}

admin.initializeApp();
const db = admin.firestore();

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }

async function computeUserPromo(userId) {
  // Determine qualified direct referrals (>= 495 completed deposits)
  const referralsSnap = await db.collection('users').where('referredBy', '==', userId).get();
  let qualified = 0;
  for (const r of referralsSnap.docs) {
    const depSnap = await db.collection('deposits').where('userId', '==', r.id).get();
    const total = depSnap.docs.reduce((s, d) => {
      const data = d.data();
      const status = String(data.status || '').toLowerCase();
      if (status !== 'completed' && status !== 'approved') return s;
      return s + Number(data.amount || 0);
    }, 0);
    if (total >= 495) qualified += 1;
  }

  // thresholds mapping (current system)
  const thresholds = [
    { count: 5, percent: 6.5 },
    { count: 4, percent: 5.5 },
    { count: 3, percent: 4.5 },
    { count: 2, percent: 3.5 },
    { count: 1, percent: 2.5 },
  ];
  const baseline = 1;
  for (const t of thresholds) if (qualified >= t.count) return t.percent;
  return baseline;
}

async function run() {
  console.log('Starting backfill_promo. dryRun=%s force=%s pageSize=%d', dryRun, force, pageSize);

  let lastDoc = null;
  let totalToUpdate = 0;
  const updates = [];

  while (true) {
    let q = db.collection('users').orderBy('__name__').limit(pageSize);
    if (lastDoc) q = q.startAfter(lastDoc);
    const snap = await q.get();
    if (snap.empty) break;
    console.log(`Scanning users page (size=${snap.size})`);

    for (const u of snap.docs) {
      const uid = u.id;
      const cur = u.data();
      const currentLegacy = typeof cur.legacyPromoPercent === 'number' ? cur.legacyPromoPercent : null;
      const computed = await computeUserPromo(uid);
      if (currentLegacy == null || force) {
        if (currentLegacy === computed && !force) continue;
        updates.push({ uid, before: currentLegacy, after: computed });
        totalToUpdate++;
      }
    }

    lastDoc = snap.docs[snap.docs.length - 1];
    if (snap.size < pageSize) break;
  }

  console.log('Users to update:', totalToUpdate);
  if (dryRun) {
    console.log('Dry run - sample updates:');
    console.log(JSON.stringify(updates.slice(0, 20), null, 2));
    return;
  }

  // apply updates in smaller batches with optional delay
  for (let i = 0; i < updates.length; i += batchSize) {
    const batch = db.batch();
    const chunk = updates.slice(i, i + batchSize);
    for (const item of chunk) {
      const ref = db.collection('users').doc(item.uid);
      batch.update(ref, { legacyPromoPercent: Number(item.after) });
    }
    await batch.commit();
    console.log('Committed batch', Math.floor(i / batchSize) + 1, 'size', chunk.length);
    await sleep(delayMs);
  }

  console.log('Backfill complete. Updated %d users.', updates.length);
}

run().catch(e => { console.error('Backfill failed:', e); process.exit(1); });
