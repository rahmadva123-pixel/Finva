import { NextResponse } from "next/server";
import { Resend } from "resend";
import { getFirebaseAdminAuth } from "@/lib/firebase-admin";

export const runtime = "nodejs";

type ActionEmailType = "password-reset" | "verify-email";

function isValidActionType(value: unknown): value is ActionEmailType {
  return value === "password-reset" || value === "verify-email";
}

function isContinueUrlError(error: unknown) {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  return code === "auth/invalid-continue-uri" || code === "auth/unauthorized-continue-uri";
}

function getBaseUrl(request: Request) {
  const url = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const forwardedProto = request.headers.get("x-forwarded-proto") || url.protocol.replace(":", "");

  return forwardedHost ? `${forwardedProto}://${forwardedHost}` : url.origin;
}

function buildEmailTemplate(type: ActionEmailType, actionLink: string, email: string) {
  const actionText = type === "verify-email" ? "Verify Email" : "Reset Password";
  const title = type === "verify-email" ? "Verify your email address" : "Reset your password";
  const description =
    type === "verify-email"
      ? `Please confirm that ${email} belongs to you by clicking the button below.`
      : `We received a request to reset the password for ${email}. Click the button below to continue.`;

  return {
    subject: title,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827; max-width: 560px; margin: 0 auto; padding: 24px;">
        <h2 style="margin-bottom: 16px;">${title}</h2>
        <p style="margin-bottom: 16px;">${description}</p>
        <p style="margin: 24px 0;">
          <a href="${actionLink}" style="background: #2563eb; color: white; text-decoration: none; padding: 12px 18px; border-radius: 8px; display: inline-block;">
            ${actionText}
          </a>
        </p>
        <p style="margin-bottom: 8px;">If the button does not work, copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #2563eb;">${actionLink}</p>
      </div>
    `,
  };
}

export async function POST(request: Request) {
  const resendApiKey = process.env.RESEND_API_KEY;
  const resendFrom = process.env.RESEND_FROM;

  if (!resendApiKey || !resendFrom) {
    return NextResponse.json({ error: "Resend is not configured." }, { status: 503 });
  }

  try {
    const body = await request.json();
    const email = typeof body?.email === "string" ? body.email.trim() : "";
    const type = body?.type;

    if (!email || !isValidActionType(type)) {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const adminAuth = getFirebaseAdminAuth();
    const baseUrl = getBaseUrl(request);
    const actionCodeSettings = {
      url: `${baseUrl}/login`,
      handleCodeInApp: false,
    };

    let actionLink: string;

    try {
      actionLink =
        type === "verify-email"
          ? await adminAuth.generateEmailVerificationLink(email, actionCodeSettings)
          : await adminAuth.generatePasswordResetLink(email, actionCodeSettings);
    } catch (error) {
      if (!isContinueUrlError(error)) {
        throw error;
      }

      actionLink =
        type === "verify-email"
          ? await adminAuth.generateEmailVerificationLink(email)
          : await adminAuth.generatePasswordResetLink(email);
    }

    const resend = new Resend(resendApiKey);
    const emailTemplate = buildEmailTemplate(type, actionLink, email);

    await resend.emails.send({
      from: resendFrom,
      to: [email],
      subject: emailTemplate.subject,
      html: emailTemplate.html,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (String(error?.code || "") === "auth/user-not-found") {
      return NextResponse.json({ success: true });
    }

    console.error("Failed to send auth action email", error);
    return NextResponse.json(
      { error: error?.message || "Failed to send email." },
      { status: 500 }
    );
  }
}
