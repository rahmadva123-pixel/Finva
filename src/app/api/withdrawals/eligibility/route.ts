import { NextResponse } from 'next/server';
import { getFirebaseAdminAuth, isFirebaseAdminConfigured } from '@/lib/firebase-admin';

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const match = authHeader.match(/^Bearer (.*)$/);
    if (!match) return NextResponse.json({ error: 'Missing auth token' }, { status: 401 });
    const idToken = match[1];

    if (!isFirebaseAdminConfigured()) {
      if (process.env.NODE_ENV !== 'production') {
        return NextResponse.json({ blocked: false, developmentFallback: true });
      }
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }
    const adminAuth = getFirebaseAdminAuth();

    const decoded = await adminAuth.verifyIdToken(idToken);
    void decoded;
    return NextResponse.json({ blocked: false });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
  }
}
