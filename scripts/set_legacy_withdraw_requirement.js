const admin = require('firebase-admin');
const yargs = require('yargs');

async function main() {
  const argv = yargs
    .option('dry-run', { type: 'boolean', default: true })
    .option('uids', { type: 'string', describe: 'Comma-separated list of user ids to target. If omitted, targets all existing users.' })
    .argv;

    // Quick safety switch: if DISABLE_SCHEDULED_JOBS=true, exit immediately.
    if (process.env.DISABLE_SCHEDULED_JOBS === 'true') {
      console.log('Scheduled jobs are disabled via DISABLE_SCHEDULED_JOBS=true. Exiting without modifying users.');
      process.exit(0);
    }

  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.error('Set GOOGLE_APPLICATION_CREDENTIALS to your service account JSON path.');
    process.exit(1);
  }

  admin.initializeApp();
  const db = admin.firestore();

  let uids = null;
  if (argv.uids) {
    uids = argv.uids.split(',').map(s => s.trim()).filter(Boolean);
  }

  const users = [];
  if (uids && uids.length) {
    for (const uid of uids) {
      const snap = await db.collection('users').doc(uid).get();
      if (snap.exists) users.push({ id: uid, data: snap.data() });
      else console.warn('User not found:', uid);
    }
  } else {
    const all = await db.collection('users').get();
    for (const d of all.docs) users.push({ id: d.id, data: d.data() });
  }

  console.log(`Found ${users.length} users to process. dry-run=${!!argv['dry-run']}`);

  const now = admin.firestore.FieldValue.serverTimestamp();
  for (const u of users) {
    const docRef = db.collection('users').doc(u.id);
    const updates = {
      legacyRequiresReferralToWithdraw: true,
      legacyReferralRequirementSetAt: now,
    };

    if (argv['dry-run']) {
      console.log(`DRY RUN: would set legacy requirement on user ${u.id}`);
    } else {
      await docRef.update(updates);
      console.log(`Updated user ${u.id}`);
    }
  }

  console.log('Done.');
}

main().catch(err => { console.error(err); process.exit(1); });
