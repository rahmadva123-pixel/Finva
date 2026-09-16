import { NextResponse } from 'next/server';
import admin, { getFirebaseAdminAuth, getFirebaseAdminDb, isFirebaseAdminConfigured } from '@/lib/firebase-admin';

export async function GET(req: Request) {
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

    const userRef = adminDb.collection('users').doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    const userData: any = userSnap.data();

    // Respect global allow toggle in settings/referral
    const referralSettingsDoc = await adminDb.collection('settings').doc('referral').get();
    const referralSettings: any = referralSettingsDoc.exists ? referralSettingsDoc.data() : {};
    if (referralSettings?.allowWithdrawalsWithoutReferral === true) {
      return NextResponse.json({ blocked: false });
    }

    // Admin override
    if (userData?.withdrawAllowedWithoutReferral === true || userData?.withdrawAllowedByAdminAt) {
      return NextResponse.json({ blocked: false });
    }

    // Determine migration cutoff: prefer settings.referral.migrationCutoffIso, fallback to env
    const migrationIso = referralSettings?.migrationCutoffIso || process.env.REFERRAL_UNLOCK_MIGRATION_AT || new Date().toISOString();
    const migrationDate = new Date(migrationIso);

    // If user created at/after cutoff, exempt
    const userCreatedAt = userData?.createdAt?.seconds ? new Date(userData.createdAt.seconds * 1000) : null;
    if (userCreatedAt && userCreatedAt >= migrationDate) {
      return NextResponse.json({ blocked: false });
    }

    // Query referred users created after cutoff
    let refsQuery = adminDb.collection('users').where('referredBy', '==', uid);
    try {
      refsQuery = refsQuery.where('referredAt', '>', admin.firestore.Timestamp.fromDate(migrationDate));
    } catch (e) {
      refsQuery = adminDb.collection('users').where('referredBy', '==', uid);
    }

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
      return NextResponse.json({ blocked: true, message: msg });
    }

    return NextResponse.json({ blocked: false });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
  }
}
