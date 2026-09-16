import { NextResponse } from 'next/server';
import { getFirebaseAdminAuth, getFirebaseAdminDb, isFirebaseAdminConfigured } from '@/lib/firebase-admin';

export async function POST(req: Request) {
  try {
    const { token } = await req.json();
    if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 });

    if (!isFirebaseAdminConfigured()) return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    const adminDb = getFirebaseAdminDb();
    const adminAuth = getFirebaseAdminAuth();

    const docRef = adminDb.collection('emailChangeTokens').doc(token);
    const docSnap = await docRef.get();
    if (!docSnap.exists) return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
    const data = docSnap.data();
    if (!data) return NextResponse.json({ error: 'Invalid token data' }, { status: 400 });
    if (data.used) return NextResponse.json({ error: 'Token already used' }, { status: 400 });
    if (typeof data.expiresAt === 'number' && Date.now() > data.expiresAt) return NextResponse.json({ error: 'Token expired' }, { status: 400 });

    const uid = data.uid as string | undefined;
    const newEmail = data.newEmail as string | undefined;
    if (!uid || !newEmail) return NextResponse.json({ error: 'Token missing uid/newEmail' }, { status: 400 });
    // Update auth email and firestore users doc
    await adminAuth.updateUser(uid, { email: newEmail, emailVerified: true });
    await adminDb.collection('users').doc(uid).update({ email: newEmail });

    await docRef.update({ used: true, usedAt: Date.now() });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
  }
}
