const admin = require('firebase-admin');

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error('Usage: node scripts/ensure_broadcast_for_user.js <email>');
    process.exit(1);
  }

  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.error('Set GOOGLE_APPLICATION_CREDENTIALS to your service account JSON path.');
    process.exit(1);
  }

  admin.initializeApp();
  const db = admin.firestore();

  const usersSnap = await db.collection('users').where('email', '==', email).get();
  if (usersSnap.empty) {
    console.log(JSON.stringify({ found: false, msg: 'No user with that email' }));
    return;
  }

  for (const udoc of usersSnap.docs) {
    const uid = udoc.id;
    const user = udoc.data();
    const existing = await db.collection('notifications')
      .where('userId', '==', uid)
      .where('meta.broadcast', '==', true)
      .limit(1)
      .get();

    if (existing.size > 0) {
      console.log(JSON.stringify({ found: true, uid, email, hasBroadcast: true }));
    } else {
      const notifRef = db.collection('notifications').doc();
      await notifRef.set({
        userId: uid,
        title: 'Important: Referral Program, Bonuses & Daily Promo Update',
        description: `- Both the person who refers and the new user will receive a 13% bonus credited after the referred deposit is confirmed.\n- Existing users: withdrawals are locked until you refer one new qualifying user — this is a one-time requirement. New signups are not affected.\n- Qualifying referral: a referred user whose completed/approved deposits total ≥ $495.\n- Daily promo percent: your current legacy daily promo % is preserved until you refer a qualifying user. After that, your daily promo will follow the referral tiers: 1→2.5%, 2→3.5%, 3→4.5%, 4→5.5%, 5+→6.5%.\n- Earnings & records: referral bonuses and daily earnings are credited to your balance, logged in your transaction history, and appear in your notification center when posted.\n\nVisit your referral page to get your share link: /dashboard/referral`,
        type: 'globalAnnouncement',
        link: '/dashboard/referral',
        isRead: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        meta: { broadcast: true }
      });
      console.log(JSON.stringify({ found: true, uid, email, hasBroadcast: false, createdNotificationId: notifRef.id }));
    }
  }
}

main().catch(err => { console.error(err); process.exit(1); });
