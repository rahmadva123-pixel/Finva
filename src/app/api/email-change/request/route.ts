import { NextResponse } from 'next/server';
import { getFirebaseAdminDb, isFirebaseAdminConfigured } from '@/lib/firebase-admin';
import { randomBytes } from 'crypto';

async function sendConfirmationEmail(to: string, link: string) {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.FROM_EMAIL || process.env.SMTP_FROM;

  if (!host || !port || !user || !pass || !from) {
    return false;
  }
  let nodemailer: any = null;
  try {
    // dynamically require to avoid type errors when nodemailer isn't installed in dev
     
    nodemailer = require('nodemailer');
  } catch (e) {
    return false;
  }

  const transporter = nodemailer.createTransport({ host, port, auth: { user, pass }, secure: port === 465 });

  const info = await transporter.sendMail({
    from,
    to,
    subject: 'Confirm your new email address',
    html: `<p>Click the link below to confirm your new email address:</p><p><a href="${link}">${link}</a></p><p>If you didn't request this, ignore this email.</p>`
  });

  return !!info;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { uid, newEmail } = body;
    if (!uid || !newEmail) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

    const token = randomBytes(24).toString('hex');
    const expiresAt = Date.now() + 1000 * 60 * 60; // 1 hour

    if (!isFirebaseAdminConfigured()) {
      // Server isn't configured with Admin SDK — return token in response for dev use
      await Promise.resolve();
    } else {
      const adminDb = getFirebaseAdminDb();
      await adminDb.collection('emailChangeTokens').doc(token).set({ uid, newEmail, createdAt: Date.now(), expiresAt, used: false });
    }

    const appUrl = process.env.APP_URL || (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000');
    const confirmLink = `${appUrl.replace(/\/$/, '')}/confirm-email-change?token=${token}`;

    // Try to send email; if SMTP not configured, return token for dev/testing
    const sent = await sendConfirmationEmail(newEmail, confirmLink).catch(() => false);

    if (!sent) {
      // Development fallback: return token so developer can confirm manually
      return NextResponse.json({ ok: true, token, confirmLink });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
  }
}
