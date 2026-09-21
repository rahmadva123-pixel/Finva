import { NextResponse } from 'next/server';
import { FieldValue, Transaction } from 'firebase-admin/firestore';
import { getFirebaseAdminAuth, getFirebaseAdminDb, isFirebaseAdminConfigured } from '@/lib/firebase-admin';

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const match = authHeader.match(/^Bearer (.*)$/);
    if (!match) return NextResponse.json({ error: 'Missing auth token' }, { status: 401 });
    const idToken = match[1];

    if (!isFirebaseAdminConfigured()) return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    const adminAuth = getFirebaseAdminAuth();
    const adminDb = getFirebaseAdminDb();

    const decoded = await adminAuth.verifyIdToken(idToken);
    const uid = decoded.uid;

    // load claim settings
    const settingsSnap: any = await adminDb.collection('settings').doc('dailyEarnings').get();
    const settings: any = settingsSnap.exists ? settingsSnap.data() : {};
    const minClaimAmount = Number(settings.minClaimAmount || 1);
    const claimCooldownHours = Number(settings.claimCooldownHours || 24);

    await adminDb.runTransaction(async (tx: Transaction) => {
      const userRef = adminDb.collection('users').doc(uid);
      const userSnap: any = await tx.get(userRef);
      if (!userSnap.exists) throw new Error('User not found');
      const userData: any = userSnap.data();

      const pending = Number(userData.pendingEarnings || 0);
      if (pending < minClaimAmount) throw new Error('Pending earnings too low to claim');

      // Read all documents needed for the claim before writing in the transaction.
      const etSnap = await adminDb.collection('earningTransactions').where('userId', '==', uid).where('status', '==', 'pending').get();

      // check last claim
      const lastClaimQ = await adminDb.collection('claims').where('userId', '==', uid).orderBy('createdAt', 'desc').limit(1).get();
      if (!lastClaimQ.empty) {
        const last = lastClaimQ.docs[0].data();
        const lastMs = (last.processedAt && last.processedAt.toDate) ? last.processedAt.toDate().getTime() : (last.processedAt ? new Date(last.processedAt).getTime() : 0);
        const cooldownMs = claimCooldownHours * 60 * 60 * 1000;
        if (Date.now() - lastMs < cooldownMs) throw new Error('Claim cooldown not yet elapsed');
      }

      // create claim doc
      const claimRef = adminDb.collection('claims').doc();
      tx.set(claimRef, {
        userId: uid,
        amount: pending,
        status: 'processed',
        createdAt: FieldValue.serverTimestamp(),
        processedAt: FieldValue.serverTimestamp(),
      });

      // credit user: move pending -> balance, reset pending
      const curBal = Number(userData.balance || 0);
      const newBal = Number((curBal + pending).toFixed(2));
      tx.update(userRef, { balance: newBal, pendingEarnings: 0, lastClaimedAt: FieldValue.serverTimestamp(), totalEarning: Number(((userData.totalEarning || 0) + pending).toFixed(2)) });

      // mark pending earningTransactions as claimed
      for (const d of etSnap.docs) {
        tx.update(d.ref, { status: 'claimed', claimedAt: FieldValue.serverTimestamp(), claimId: claimRef.id });
      }

      // add a transaction record for wallet history
      const txRef = adminDb.collection('bonusTransactions').doc();
      tx.set(txRef, {
        userId: uid,
        amount: pending,
        title: 'Earnings Claimed',
        description: `User claimed earnings of ${pending}`,
        date: FieldValue.serverTimestamp(),
        type: 'earningClaim',
      });

      // notification
      const notifRef = adminDb.collection('notifications').doc();
      tx.set(notifRef, {
        userId: uid,
        title: 'Earnings Claimed',
        description: `You claimed ${pending} from your pending earnings.`,
        isRead: false,
        createdAt: FieldValue.serverTimestamp(),
        link: '/dashboard/finance/wallet',
        type: 'earningClaim'
      });
    });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || String(e) }, { status: 400 });
  }
}
