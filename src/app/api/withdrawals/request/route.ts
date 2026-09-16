import { NextResponse } from 'next/server';
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

    // By default, withdrawals are locked for all users unless:
    // - admin granted `withdrawAllowedWithoutReferral`, OR
    // - the user has referred at least one other user who completed a deposit
    // IMPORTANT: We require the qualifying referral to be created AFTER a migration cutoff so
    // previous referrals do not automatically grant unlocks. Set `REFERRAL_UNLOCK_MIGRATION_AT`
    // (ISO string) in the environment to control the cutoff. If not set, default is now,
    // meaning existing referrals will NOT count and every user must refer one new user.
    // Check global setting first: admins can enable withdrawals for everyone via settings/referral
    const referralSettingsDoc = await adminDb.collection('settings').doc('referral').get();
    const referralSettings: any = referralSettingsDoc.exists ? referralSettingsDoc.data() : {};
    if (referralSettings?.allowWithdrawalsWithoutReferral === true) {
      // Global allow enabled — skip referral checks
    } else if (!(userData?.withdrawAllowedWithoutReferral === true || userData?.withdrawAllowedByAdminAt)) {
      const migrationIso = process.env.REFERRAL_UNLOCK_MIGRATION_AT || new Date().toISOString();
      const migrationDate = new Date(migrationIso);
      // Query for referred users created after the migration cutoff
      let refsQuery = adminDb.collection('users').where('referredBy', '==', uid);
      try {
        // Only apply referredAt cutoff if the field exists in the DB (Firestore Timestamp)
        refsQuery = refsQuery.where('referredAt', '>', admin.firestore.Timestamp.fromDate(migrationDate));
      } catch (e) {
        // If Firestore can't compare (missing field types), fall back to raw referredBy query
        refsQuery = adminDb.collection('users').where('referredBy', '==', uid);
      }

      // If the user account was created at/after the migration cutoff, treat them as new
      const userCreatedAt = userData?.createdAt?.seconds ? new Date(userData.createdAt.seconds * 1000) : null;
      if (userCreatedAt && userCreatedAt >= migrationDate) {
        // New user after cutoff — do not enforce the extra referral requirement for them
        // (they follow normal referral rules / may withdraw if other conditions allow)
      } else {
        const refsSnap = await refsQuery.get();
        let qualifyingRefs = 0;
        for (const r of refsSnap.docs) {
          const refUserId = r.id;
          const depSnap = await adminDb.collection('deposits')
            .where('userId', '==', refUserId)
            .where('status', 'in', ['completed', 'approved'])
            .limit(1)
            .get();
          if (!depSnap.empty) qualifyingRefs++;
          if (qualifyingRefs >= 1) break;
        }
        if (qualifyingRefs < 1) {
          const msg = `Withdrawals locked until you refer one user (who completes a deposit) after ${migrationDate.toISOString()}.`;
          return NextResponse.json({ error: msg }, { status: 403 });
        }
      }
      
    }

    // compute recent principal amount
    const cutoffMs = Date.now() - EARLY_WITHDRAWAL_DAYS * 24 * 60 * 60 * 1000;
    const depositsSnap = await adminDb.collection('deposits').where('userId', '==', uid).get();
    const recentPrincipalTotal = depositsSnap.docs.reduce((sum: number, d) => {
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
    await adminDb.runTransaction(async (tx) => {
      const latestUser = await tx.get(userRef);
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
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      tx.update(userRef, { balance: curBalance - amount });
    });

    return NextResponse.json({ ok: true, amount, fee, finalAmount });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
  }
}
