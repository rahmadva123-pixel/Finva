import { NextResponse } from 'next/server';
import { FieldValue, Transaction } from 'firebase-admin/firestore';
import admin, { getFirebaseAdminAuth, getFirebaseAdminDb, isFirebaseAdminConfigured } from '@/lib/firebase-admin';

const EARLY_WITHDRAWAL_DAYS = 60;
const REGULAR_WITHDRAWAL_FEE_PERCENTAGE = 20;
// Enforce a flat 20% fee for all users for both regular and early withdrawals
const EARLY_WITHDRAWAL_FEE_PERCENTAGE = 20;

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

    const body = await req.json();
    const amount = Number(body?.amount || 0);
    const method = body?.method;
    const details = body?.details || {};

    if (!method) return NextResponse.json({ error: 'Method required' }, { status: 400 });
    if (!amount || amount <= 0) return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });

    // Load user
    const userRef = adminDb.collection('users').doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    const userData: any = userSnap.data();

    // compute recent principal amount
    const cutoffMs = Date.now() - EARLY_WITHDRAWAL_DAYS * 24 * 60 * 60 * 1000;
    const depositsSnap = await adminDb.collection('deposits').where('userId', '==', uid).get();
    const recentPrincipalTotal = depositsSnap.docs.reduce((sum: number, d: any) => {
      const data: any = d.data();
      const status = String(data.status || '').toLowerCase();
      if (status !== 'completed' && status !== 'approved') return sum;
      const completedAt = data.completedAt?.seconds ? new Date(data.completedAt.seconds * 1000) : null;
      const createdAt = data.createdAt?.seconds ? new Date(data.createdAt.seconds * 1000) : null;
      const depositDate = completedAt || createdAt;
      if (!depositDate || depositDate.getTime() < cutoffMs) return sum;
      return sum + Number(data.amount || 0);
    }, 0);

    // compute fee: enforce flat regularPercent (ignore per-user overrides)
    const regularPercent = REGULAR_WITHDRAWAL_FEE_PERCENTAGE;
    const earlyPrincipalAmount = Math.min(amount, recentPrincipalTotal);
    const regularWithdrawalAmount = Math.max(0, amount - earlyPrincipalAmount);
    const fee = Math.round(((earlyPrincipalAmount * (EARLY_WITHDRAWAL_FEE_PERCENTAGE / 100)) + (regularWithdrawalAmount * (regularPercent / 100))) * 100) / 100;
    const finalAmount = Math.round((amount - fee) * 100) / 100;

    // ensure sufficient balance
    const balance = Number(userData.balance || 0);
    if (amount > balance) return NextResponse.json({ error: 'Insufficient funds' }, { status: 400 });

    // perform transaction: create withdrawal doc and update balance
    await adminDb.runTransaction(async (tx: Transaction) => {
      const latestUser: any = await tx.get(userRef);
      const curBalance = Number(latestUser.data()?.balance || 0);
      if (amount > curBalance) throw new Error('Insufficient funds');

      const withdrawRef = adminDb.collection('withdrawals').doc();
      tx.set(withdrawRef, {
        userId: uid,
        amount: amount,
        fee: fee,
        finalAmount: finalAmount,
        method: method,
        details: details,
        status: 'pending',
        createdAt: FieldValue.serverTimestamp(),
      });

      tx.update(userRef, { balance: curBalance - amount });
    });

    return NextResponse.json({ ok: true, amount, fee, finalAmount });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
  }
}
