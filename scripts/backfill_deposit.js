/**
 * Safe backfill for a single deposit.
 * Usage: set GOOGLE_APPLICATION_CREDENTIALS to a service account JSON, then:
 *   node scripts/backfill_deposit.js <DEPOSIT_ID>
 *
 * The script is idempotent: it writes a `backfills/{DEPOSIT_ID}` marker to avoid double-crediting.
 */
const admin = require('firebase-admin');

const rawArgs = process.argv.slice(2);
if (!rawArgs || rawArgs.length === 0) {
  console.error('Usage: node scripts/backfill_deposit.js <DEPOSIT_ID> [--dry-run] [--force]');
  process.exit(1);
}
const depositId = rawArgs.find(a => !a.startsWith('--'));
const dryRun = rawArgs.includes('--dry-run');
const force = rawArgs.includes('--force');
if (!depositId) {
  console.error('Missing deposit id.');
  process.exit(1);
}

admin.initializeApp();
const db = admin.firestore();

function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }

async function backfill() {
  const depositRef = db.collection('deposits').doc(depositId);
  const depSnap = await depositRef.get();
  if (!depSnap.exists) throw new Error('Deposit not found: ' + depositId);
  const dep = depSnap.data();
  if (!dep || typeof dep.amount !== 'number') throw new Error('Invalid deposit doc');

  // Prevent double-run (unless forced)
  const backfillRef = db.collection('backfills').doc(depositId);
  const existingBackfill = await backfillRef.get();
  if (existingBackfill.exists && !force) {
    console.log('Backfill already processed for', depositId, existingBackfill.data());
    console.log('Use --force to override and re-apply. Or delete the marker in Firestore.');
    return;
  }

  const userRef = db.collection('users').doc(dep.userId);
  const userSnap = await userRef.get();
  if (!userSnap.exists) throw new Error('Depositing user not found: ' + dep.userId);
  const user = userSnap.data();

  const referrerId = user.referredBy || null;
  const referrerRef = referrerId ? db.collection('users').doc(referrerId) : null;
  const referrerSnap = referrerRef ? await referrerRef.get() : null;

  const settingsSnap = await db.collection('settings').doc('refreshment').get();
  const refreshSettings = settingsSnap.exists ? settingsSnap.data() : { enabled: true, amount: 50, autoCredit: false };
  const refreshAmount = Number(refreshSettings.amount || 50);
  const refreshAuto = !!refreshSettings.autoCredit;

  const depositAmount = Number(dep.amount || 0);
  const bonusAmount = referrerId ? round2((depositAmount * 13) / 100) : 0;

  if (dryRun) {
    // Gather data and print a summary of intended actions without writing
    const summary = { depositId, depositAmount, bonusAmount, refreshSettings, referrerId, missingDeposit: 0, actions: [] };

    const userBalance = Number(userSnap.data().balance || 0);
    const userTotalEarning = Number(userSnap.data().totalEarning || 0);
    const rcQuery = db.collection('referralCommissions').where('referredUserId', '==', dep.userId).where('amount', '==', bonusAmount);
    const rcSnap = await rcQuery.get();
    const referredCommissionExists = rcSnap.size > 0;

    let referrerCommissionExists = false;
    if (referrerId) {
      const rcRefQuery = db.collection('referralCommissions').where('referrerId', '==', referrerId).where('referredUserId', '==', dep.userId).where('amount', '==', bonusAmount);
      const rcRefSnap = await rcRefQuery.get();
      referrerCommissionExists = rcRefSnap.size > 0;
    }

    // compute missing deposit
    const expectedIfAllCredited = round2((referredCommissionExists ? bonusAmount : 0) + depositAmount);
    if (userBalance < expectedIfAllCredited) {
      summary.missingDeposit = round2(expectedIfAllCredited - userBalance);
      summary.actions.push(`Would credit deposit missing amount ${summary.missingDeposit} to user ${dep.userId}`);
    }

    if (referrerId && !referrerCommissionExists && bonusAmount > 0) {
      summary.actions.push(`Would create referralCommission and credit ${bonusAmount} to referrer ${referrerId}`);
    }
    if (!referredCommissionExists && bonusAmount > 0) {
      summary.actions.push(`Would create referralCommission and credit ${bonusAmount} to referred user ${dep.userId}`);
    }
    if (referrerId && !refreshExists && refreshSettings.enabled) {
      if (refreshAuto) summary.actions.push(`Would auto-credit refreshment bonus ${refreshAmount} to referrer ${referrerId}`);
      else summary.actions.push(`Would create claimable refreshment bonus ${refreshAmount} for referrer ${referrerId}`);
    }

    console.log('\nDRY RUN SUMMARY:');
    console.log(JSON.stringify(summary, null, 2));
    console.log('\nDetailed flags: dryRun=', dryRun, 'force=', force);
    return;
  }

  await db.runTransaction(async (tx) => {
    // Re-read inside transaction
    const depT = await tx.get(depositRef);
    if (!depT.exists) throw new Error('Deposit disappeared during transaction');

    const userT = await tx.get(userRef);
    if (!userT.exists) throw new Error('User disappeared during transaction');
    const currentBalance = Number(userT.data().balance || 0);
    const currentTotalEarning = Number(userT.data().totalEarning || 0);

    // Check existing referral commission records
    const rcQuery = db.collection('referralCommissions').where('referredUserId', '==', dep.userId).where('amount', '==', bonusAmount);
    const rcSnap = await tx.get(rcQuery);
    const referredCommissionExists = rcSnap.size > 0;

    let referrerCommissionExists = false;
    if (referrerId) {
      const rcRefQuery = db.collection('referralCommissions').where('referrerId', '==', referrerId).where('referredUserId', '==', dep.userId).where('amount', '==', bonusAmount);
      const rcRefSnap = await tx.get(rcRefQuery);
      referrerCommissionExists = rcRefSnap.size > 0;
    }

    // Check existing refreshment bonus
    let refreshExists = false;
    if (referrerId) {
      const rbQuery = db.collection('refreshmentBonuses').where('userId', '==', referrerId).where('referredUserId', '==', dep.userId);
      const rbSnap = await tx.get(rbQuery);
      refreshExists = rbSnap.size > 0;
    }

    // Compute how much deposit component is missing for the referred user
    // If referred commission exists we assume bonus already credited; otherwise we'll credit bonus below.
    const bonusAlreadyCreditedToUser = referredCommissionExists;
    const expectedBalanceAfter = currentBalance; // we'll compute below

    // Determine missing deposit portion: if user balance is less than bonus(if any) + deposit, we need to add difference
    const expectedIfAllCredited = round2((bonusAlreadyCreditedToUser ? bonusAmount : 0) + depositAmount);
    let missingDeposit = 0;
    if (currentBalance < expectedIfAllCredited) {
      missingDeposit = round2(expectedIfAllCredited - currentBalance);
    }

    // Prepare writes
    const writes = [];

    // Credit referrer's bonus if missing
    if (referrerId && !referrerCommissionExists && bonusAmount > 0) {
      const commissionRef = db.collection('referralCommissions').doc();
      tx.set(commissionRef, {
        referrerId,
        referredUserId: dep.userId,
        amount: bonusAmount,
        type: 'referral_bonus',
        percentage: 13,
        date: admin.firestore.FieldValue.serverTimestamp(),
        description: `Backfilled ${13}% referral bonus for referred deposit ${depositId}`
      });

      // Credit referrer balance
      const refSnap = await tx.get(referrerRef);
      if (!refSnap.exists) throw new Error('Referrer not found during transaction');
      const refBalance = Number(refSnap.data().balance || 0);
      const refTotalEarning = Number(refSnap.data().totalEarning || 0);
      tx.update(referrerRef, { balance: round2(refBalance + bonusAmount), totalEarning: round2(refTotalEarning + bonusAmount) });

      // bonus transaction
      const btRef = db.collection('bonusTransactions').doc();
      tx.set(btRef, {
        userId: referrerId,
        amount: bonusAmount,
        title: 'Referral Bonus (backfill)',
        description: `Backfilled referral bonus for referred deposit ${depositId}`,
        date: admin.firestore.FieldValue.serverTimestamp(),
        type: 'referralBonus'
      });
    }

    // Credit referred user's bonus and deposit if missing
    if (!referredCommissionExists && bonusAmount > 0) {
      const commissionRef2 = db.collection('referralCommissions').doc();
      tx.set(commissionRef2, {
        referrerId: referrerId || null,
        referredUserId: dep.userId,
        amount: bonusAmount,
        type: 'referral_bonus_referred',
        percentage: 13,
        date: admin.firestore.FieldValue.serverTimestamp(),
        description: `Backfilled ${13}% bonus to referred user for deposit ${depositId}`
      });

      // Add bonus to user's totalEarning
      tx.update(userRef, {
        balance: round2(currentBalance + missingDeposit + bonusAmount),
        totalEarning: round2(currentTotalEarning + bonusAmount)
      });

      // record bonus transaction
      const bt2 = db.collection('bonusTransactions').doc();
      tx.set(bt2, {
        userId: dep.userId,
        amount: bonusAmount,
        title: 'Referral Bonus (backfill)',
        description: `Backfilled referral bonus for deposit ${depositId}`,
        date: admin.firestore.FieldValue.serverTimestamp(),
        type: 'referralBonus'
      });

      // since we included missingDeposit above, set missingDeposit=0 to avoid double credit below
      missingDeposit = 0;
    }

    // If there was no referred commission but bonusAmount==0 (no referrer), still credit deposit amount
    if (bonusAmount === 0 && missingDeposit > 0) {
      tx.update(userRef, { balance: round2(currentBalance + missingDeposit) });
      const bt3 = db.collection('bonusTransactions').doc();
      tx.set(bt3, {
        userId: dep.userId,
        amount: missingDeposit,
        title: 'Deposit Backfill',
        description: `Backfilled deposit amount for deposit ${depositId}`,
        date: admin.firestore.FieldValue.serverTimestamp(),
        type: 'depositBackfill'
      });
      missingDeposit = 0;
    }

    // If any deposit component still missing (e.g., bonus existed but deposit missing), credit it
    if (missingDeposit > 0) {
      tx.update(userRef, { balance: round2((await tx.get(userRef)).data().balance + missingDeposit) });
      const bt4 = db.collection('bonusTransactions').doc();
      tx.set(bt4, {
        userId: dep.userId,
        amount: missingDeposit,
        title: 'Deposit Backfill',
        description: `Backfilled deposit amount for deposit ${depositId}`,
        date: admin.firestore.FieldValue.serverTimestamp(),
        type: 'depositBackfill'
      });
    }

    // Refreshment handling for referrer
    if (referrerId && !refreshExists && refreshSettings.enabled) {
      const rbRef = db.collection('refreshmentBonuses').doc();
      if (refreshAuto) {
        tx.set(rbRef, {
          userId: referrerId,
          referredUserId: dep.userId,
          amount: refreshAmount,
          currency: '$',
          status: 'claimed',
          claimed: true,
          claimedAt: admin.firestore.FieldValue.serverTimestamp(),
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          description: `Auto-credited refreshment bonus (backfill) for deposit ${depositId}`
        });

        // credit referrer balance for refresh amount
        const refSnap2 = await tx.get(referrerRef);
        tx.update(referrerRef, { balance: round2(Number(refSnap2.data().balance || 0) + refreshAmount) });

        const btR = db.collection('bonusTransactions').doc();
        tx.set(btR, {
          userId: referrerId,
          amount: refreshAmount,
          title: 'Refreshment Bonus (backfill)',
          description: `Auto-credited refreshment bonus for referred deposit ${depositId}`,
          date: admin.firestore.FieldValue.serverTimestamp(),
          type: 'refreshmentBonus'
        });
      } else {
        tx.set(rbRef, {
          userId: referrerId,
          referredUserId: dep.userId,
          amount: refreshAmount,
          currency: '$',
          status: 'claimable',
          claimed: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          description: `Backfilled refreshment bonus for deposit ${depositId}`
        });
      }
    }

    // Create marker to prevent re-run
    tx.set(backfillRef, {
      depositId,
      processedAt: admin.firestore.FieldValue.serverTimestamp(),
      note: force ? 'Backfill applied by admin script (force)' : 'Backfill applied by admin script'
    });
  });

  console.log('Backfill completed for deposit', depositId);
}

backfill().catch(e=>{ console.error('Backfill failed:', e); process.exit(2); });
