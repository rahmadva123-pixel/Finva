// Simulation script for referral qualification and revocation
// Run with: node scripts/simulate-referral-flow.js

function nowTs() { return { seconds: Math.floor(Date.now()/1000) }; }

// Sample users
const referrer = { id: 'userA', email: 'alice@example.com', balance: 200.00, totalEarning: 200.00 };
const referred = { id: 'userB', email: 'bob@example.com', balance: 500.00 };

console.log('\n--- Scenario: Referred user makes $500 completed deposits (qualifies) ---\n');

// Deposits
const deposits = [
  { id: 'dep1', userId: referred.id, amount: 300, status: 'completed', completedAt: nowTs() },
  { id: 'dep2', userId: referred.id, amount: 200, status: 'completed', completedAt: nowTs() },
];

const completedTotal = deposits.reduce((s,d)=> s + d.amount, 0);
console.log('Completed deposit total for', referred.id, ':', completedTotal);

if (completedTotal >= 495) {
  const qualificationDoc = {
    _id: `referralQualifications/${referred.id}`,
    referredUserId: referred.id,
    referrerId: referrer.id,
    qualifiedAt: nowTs(),
    qualifiedAmount: completedTotal,
  };
  console.log('\nCreated qualification doc:');
  console.log(JSON.stringify(qualificationDoc, null, 2));

  // Create referral commission logs (13% each)
  const bonusPct = 13;
  const bonusAmount = Math.round((completedTotal * bonusPct / 100) * 100) / 100;

  const commissionForReferrer = {
    _id: 'referralCommissions/rc1',
    referrerId: referrer.id,
    referredUserId: referred.id,
    amount: bonusAmount,
    type: 'referral_bonus',
    percentage: bonusPct,
    date: nowTs(),
    description: `Instant ${bonusPct}% referral bonus on completed deposit`
  };

  const commissionForReferred = {
    _id: 'referralCommissions/rc2',
    referrerId: referrer.id,
    referredUserId: referred.id,
    amount: bonusAmount,
    type: 'referral_bonus_referred',
    percentage: bonusPct,
    date: nowTs(),
    description: `Instant ${bonusPct}% bonus credited to referred user on their completed deposit`
  };

  console.log('\nCreated referral commission docs:');
  console.log(JSON.stringify(commissionForReferrer, null, 2));
  console.log(JSON.stringify(commissionForReferred, null, 2));

  // Apply credit to both users
  referrer.balance += bonusAmount;
  referred.balance += bonusAmount;
  console.log('\nBalances after credit:');
  console.log(referrer);
  console.log(referred);
}

console.log('\n--- Scenario: Referred user withdraws principal within 60 days, triggering revocation ---\n');

// Withdrawal that reduces referred's completed deposits below 495
const withdrawal = { id: 'wd1', userId: referred.id, amount: 495, status: 'completed', processedAt: nowTs() };

// Recompute completed deposit total after withdrawal (simulate removing most recent deposits)
const completedTotalAfter = Math.max(0, completedTotal - withdrawal.amount);
console.log('Completed total after withdrawal:', completedTotalAfter);

if (completedTotalAfter < 495) {
  // Find commissions for this referred user
  const existingCommissions = [
    { id: 'referralCommissions/rc1', referrerId: referrer.id, amount: 65.0 },
    { id: 'referralCommissions/rc2', referrerId: referrer.id, amount: 65.0 }
  ];

  // Sum amounts per referrer
  const sums = {};
  existingCommissions.forEach(c => { sums[c.referrerId] = (sums[c.referrerId]||0) + c.amount; });
  console.log('\nAmounts to reverse by referrer:', sums);

  // Hybrid logic: auto-deduct if referrer has sufficient balance
  Object.entries(sums).forEach(([refId, amt]) => {
    console.log(`\nProcessing reversal for referrer ${refId}, amount ${amt}`);
    if (referrer.balance >= amt) {
      referrer.balance = Math.round((referrer.balance - amt) * 100) / 100;
      console.log('Auto-deducted from referrer. New balance:', referrer.balance);
      const reversalDoc = {
        _id: `referralReversals/rev_${Date.now()}`,
        referrerId: refId,
        referredUserId: referred.id,
        amount: amt,
        status: 'auto_reversed',
        refs: existingCommissions.map(c => c.id),
        createdAt: nowTs(),
        reversedAt: nowTs(),
        triggerWithdrawalId: withdrawal.id
      };
      console.log('Created reversal doc:', JSON.stringify(reversalDoc, null, 2));

      // Mark commissions reversed
      existingCommissions.forEach(c => {
        console.log(`Marking ${c.id} as reversed`);
      });

    } else {
      console.log('Insufficient funds for auto-deduct; creating pending_admin reversal');
      const reversalDoc = {
        _id: `referralReversals/rev_${Date.now()}`,
        referrerId: refId,
        referredUserId: referred.id,
        amount: amt,
        status: 'pending_admin',
        refs: existingCommissions.map(c => c.id),
        createdAt: nowTs(),
        triggerWithdrawalId: withdrawal.id
      };
      console.log('Created pending reversal doc:', JSON.stringify(reversalDoc, null, 2));
    }
  });

  // Delete qualification doc
  console.log('\nDeleting referralQualifications/' + referred.id);
}

console.log('\nSimulation complete.\n');
