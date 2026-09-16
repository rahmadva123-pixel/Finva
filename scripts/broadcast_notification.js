const admin = require('firebase-admin');
const yargs = require('yargs');

async function main() {
  const argv = yargs
    .option('dry-run', { type: 'boolean', description: 'Do not perform writes (default true unless --run provided)' })
    .option('run', { type: 'boolean', description: 'Actually perform writes (overrides dry-run)' })
    .option('page-size', { type: 'number', description: 'Number of users to fetch per page', default: 200 })
    .option('batch-size', { type: 'number', description: 'Number of writes per Firestore batch commit', default: 200 })
    .option('delay-ms', { type: 'number', description: 'Delay in ms between batch commits', default: 500 })
    .argv;

    // Quick safety switch: if DISABLE_SCHEDULED_JOBS=true, exit immediately.
    if (process.env.DISABLE_SCHEDULED_JOBS === 'true') {
      console.log('Scheduled jobs are disabled via DISABLE_SCHEDULED_JOBS=true. Exiting without scanning users.');
      process.exit(0);
    }

  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.error('Set GOOGLE_APPLICATION_CREDENTIALS to your service account JSON path.');
    process.exit(1);
  }

  admin.initializeApp();
  const db = admin.firestore();

  // Detailed Option 2 content
  const title = 'Important: Referral Program, Bonuses & Daily Promo Update';
  const body = `- Both the person who refers and the new user will receive a 13% bonus credited after the referred deposit is confirmed.\n- Existing users: withdrawals are locked until you refer one new qualifying user — this is a one-time requirement. New signups are not affected.\n- Qualifying referral: a referred user whose completed/approved deposits total ≥ $495.\n- Daily promo percent: your current legacy daily promo % is preserved until you refer a qualifying user. After that, your daily promo will follow the referral tiers: 1→2.5%, 2→3.5%, 3→4.5%, 4→5.5%, 5+→6.5%.\n- Earnings & records: referral bonuses and daily earnings are credited to your balance, logged in your transaction history, and appear in your notification center when posted.\n\nVisit your referral page to get your share link: /dashboard/referral`;

  const PAGE_SIZE = Number(argv['page-size'] || process.env.PAGE_SIZE || 200);
  const BATCH_SIZE = Number(argv['batch-size'] || process.env.BATCH_SIZE || 200);
  const DELAY_MS = Number(argv['delay-ms'] || process.env.DELAY_MS || 500);
  const doRun = Boolean(argv.run) && !argv['dry-run'];

  console.log(`Starting broadcast scan (pageSize=${PAGE_SIZE}, batchSize=${BATCH_SIZE}, delayMs=${DELAY_MS}, run=${doRun})`);

  let lastDoc = null;
  let totalCreated = 0;
  let page = 0;

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  while (true) {
    page++;
    let q = db.collection('users').orderBy('__name__').limit(PAGE_SIZE);
    if (lastDoc) q = q.startAfter(lastDoc);
    const snap = await q.get();
    if (snap.empty) break;
    console.log(`Processing page ${page}, users=${snap.size}`);

    let batch = db.batch();
    let ops = 0;

    for (const u of snap.docs) {
      // Check for existing broadcast notification (limit 1)
      const existing = await db.collection('notifications')
        .where('userId', '==', u.id)
        .where('meta.broadcast', '==', true)
        .limit(1)
        .get();
      if (existing.size > 0) continue;

      const notifRef = db.collection('notifications').doc();
      batch.set(notifRef, {
        userId: u.id,
        title,
        description: body,
        type: 'globalAnnouncement',
        link: '/dashboard/referral',
        isRead: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        meta: { broadcast: true }
      });
      ops++;
      totalCreated++;

      if (ops >= BATCH_SIZE) {
        if (doRun) {
          await batch.commit();
          console.log(`Committed ${ops} notifications (page ${page})`);
        } else {
          console.log(`Dry-run: would commit ${ops} notifications (page ${page})`);
        }
        batch = db.batch();
        ops = 0;
        await sleep(DELAY_MS);
      }
    }

    if (ops > 0) {
      if (doRun) {
        await batch.commit();
        console.log(`Committed final ${ops} notifications for page ${page}`);
      } else {
        console.log(`Dry-run: would commit final ${ops} notifications for page ${page}`);
      }
      await sleep(DELAY_MS);
    }

    lastDoc = snap.docs[snap.docs.length - 1];
    if (snap.size < PAGE_SIZE) break; // last page
  }

  console.log(`Broadcast scan complete — notifications to create (approx): ${totalCreated}`);
  if (!doRun) console.log('Dry-run mode; no writes were performed. Re-run with `--run` to apply changes.');
}

main().catch(err => { console.error(err); process.exit(1); });
