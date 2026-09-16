import { NextResponse } from 'next/server';
import admin, { getFirebaseAdminAuth, getFirebaseAdminDb, isFirebaseAdminConfigured } from '@/lib/firebase-admin';

export async function POST(req: Request, ctx: any) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const match = authHeader.match(/^Bearer (.*)$/);
    if (!match) return NextResponse.json({ error: 'Missing auth token' }, { status: 401 });
    const idToken = match[1];

    if (!isFirebaseAdminConfigured()) return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    const adminAuth = getFirebaseAdminAuth();
    const adminDb = getFirebaseAdminDb();

    const decoded = await adminAuth.verifyIdToken(idToken);
    const callerUid = decoded.uid;

    // verify caller is admin
    const callerDoc = await adminDb.collection('users').doc(callerUid).get();
    const callerData = callerDoc.exists ? callerDoc.data() : null;
    if (!callerData || (callerData.role !== 'admin' && callerData.role !== 'sadmin')) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    // Ignore any custom fee values and remove per-user overrides.
    const resolvedParams: any = await ctx.params;
    const targetUid = resolvedParams.targetUid;
    if (!targetUid) return NextResponse.json({ error: 'Target user required' }, { status: 400 });

    const targetRef = adminDb.collection('users').doc(targetUid);
    // Always delete any existing per-user override so the global 20% applies.
    await targetRef.update({ withdrawalFeePercent: admin.firestore.FieldValue.delete(), withdrawalFeeUpdatedBy: callerUid, withdrawalFeeUpdatedAt: admin.firestore.FieldValue.serverTimestamp() });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
  }
}
