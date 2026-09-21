import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
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
    if (!adminAuth || !adminDb) return NextResponse.json({ error: 'Server not configured' }, { status: 500 });

    const decoded = await adminAuth.verifyIdToken(idToken);
    const uid = decoded.uid;

    const body = await req.json();
    const bonusId = body?.id;
    if (!bonusId) return NextResponse.json({ error: 'Missing bonus id' }, { status: 400 });

    await adminDb.runTransaction(async (tx: any) => {
      const bonusRef = adminDb.collection('refreshmentBonuses').doc(bonusId);
      const bonusSnap = await tx.get(bonusRef);
      if (!bonusSnap.exists) throw new Error('Bonus not found');
      const data: any = bonusSnap.data();
      if (data.claimed) throw new Error('Already claimed');
      if (data.userId !== uid) throw new Error('Not allowed to claim this bonus');

      const timestampToMillis = (value: any) => {
        if (!value) return 0;
        if (typeof value.toMillis === 'function') return value.toMillis();
        if (typeof value.seconds === 'number') return value.seconds * 1000;
        if (typeof value === 'number') return value;
        return 0;
      };
      const availableAt = timestampToMillis(data.availableAt) || timestampToMillis(data.createdAt) + 24 * 60 * 60 * 1000;
      if (Date.now() < availableAt) {
        throw new Error('This refreshment bonus will be available after the 24-hour waiting period.');
      }

      // mark claimed
      tx.update(bonusRef, { claimed: true, claimedAt: FieldValue.serverTimestamp(), status: 'claimed' });

      // credit user balance
      const userRef = adminDb.collection('users').doc(uid);
      const userSnap = await tx.get(userRef);
      if (!userSnap.exists) throw new Error('User not found');
      const cur = (userSnap.data()?.balance || 0) as number;
      tx.update(userRef, { balance: cur + Number(data.amount || 0) });

      // add bonus transaction
      const bonusTxRef = adminDb.collection('bonusTransactions').doc();
      tx.set(bonusTxRef, {
        userId: uid,
        amount: Number(data.amount || 0),
        title: 'Refreshment Bonus Claimed',
        description: `Claimed refreshment bonus for referring ${data.referredUserId}`,
        date: FieldValue.serverTimestamp(),
        type: 'refreshmentBonus'
      });

      // notification
      const notifRef = adminDb.collection('notifications').doc();
      tx.set(notifRef, {
        userId: uid,
        title: 'Refreshment Bonus Claimed',
        description: `You claimed a refreshment bonus of ${data.amount}.`,
        isRead: false,
        createdAt: FieldValue.serverTimestamp(),
        link: '/dashboard/finance/wallet',
        type: 'refreshmentBonus'
      });
    });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || String(e) }, { status: 400 });
  }
}
