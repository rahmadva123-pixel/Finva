import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getFirebaseAdminAuth, getFirebaseAdminDb, isFirebaseAdminConfigured } from "@/lib/firebase-admin";

export const runtime = "nodejs";

const DEFAULT_TIERS = [
  { minReferrals: 0, rate: 0.015 },
  { minReferrals: 1, rate: 0.02 },
  { minReferrals: 2, rate: 0.025 },
];

function normalizeRate(value: unknown) {
  const rate = Number(value || 0);
  return Math.abs(rate) > 1 ? rate / 100 : rate;
}

export async function POST(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.match(/^Bearer (.+)$/)?.[1];
  if (!token) return NextResponse.json({ error: "Missing auth token" }, { status: 401 });
  if (!isFirebaseAdminConfigured()) return NextResponse.json({ error: "Server not configured" }, { status: 503 });

  const adminAuth = getFirebaseAdminAuth();
  const adminDb = getFirebaseAdminDb();
  if (!adminAuth || !adminDb) return NextResponse.json({ error: "Server not configured" }, { status: 503 });

  try {
    const userId = (await adminAuth.verifyIdToken(token)).uid;
    const now = new Date();
    now.setUTCHours(0, 0, 0, 0);
    const dayKey = now.toISOString().slice(0, 10);
    const earningRef = adminDb.collection("earningTransactions").doc(`${userId}_${dayKey}`);

    const settingsSnap = await adminDb.collection("settings").doc("dailyEarnings").get();
    const settings = settingsSnap.exists ? settingsSnap.data() || {} : {};
    const minBalance = Number(settings.minBalance || 0);
    const tiers = Array.isArray(settings.tiers) && settings.tiers.length
      ? settings.tiers.map((tier: any) => ({ minReferrals: Number(tier.minReferrals || 0), rate: normalizeRate(tier.rate) }))
      : DEFAULT_TIERS;

    const result = await adminDb.runTransaction(async (transaction: any) => {
      const existing = await transaction.get(earningRef);
      if (existing.exists) return { created: false, amount: Number(existing.data()?.amount || 0) };

      const userRef = adminDb.collection("users").doc(userId);
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists) throw new Error("User not found");
      const user = userSnap.data() || {};
      const balance = Number(user.balance || 0);
      if (balance < minBalance) return { created: false, amount: 0 };

      const [referralsSnap, completedDepositsSnap] = await Promise.all([
        adminDb.collection("users").where("referredBy", "==", userId).get(),
        adminDb.collection("deposits").where("status", "in", ["completed", "approved"]).get(),
      ]);
      const completedDepositors = new Set(completedDepositsSnap.docs.map((deposit: any) => String(deposit.data()?.userId || "")));
      const directCompletedReferrals = referralsSnap.docs.filter((referral: any) => completedDepositors.has(referral.id)).length;
      const rate = [...tiers]
        .sort((first: any, second: any) => second.minReferrals - first.minReferrals)
        .find((tier: any) => directCompletedReferrals >= tier.minReferrals)?.rate || 0;
      const amount = Math.round((balance * rate + Number.EPSILON) * 100) / 100;
      if (amount <= 0) return { created: false, amount: 0 };

      transaction.set(earningRef, {
        userId,
        amount,
        rate,
        directCompletedReferrals,
        date: now,
        createdAt: FieldValue.serverTimestamp(),
        type: "dailyEarning",
        status: "pending",
        description: `Daily earnings for ${dayKey} at rate ${rate}`,
      });
      transaction.update(userRef, {
        pendingEarnings: Number((Number(user.pendingEarnings || 0) + amount).toFixed(2)),
      });
      return { created: true, amount };
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    console.error("Daily earnings accrual failed", error);
    return NextResponse.json({ error: error?.message || "Daily earnings accrual failed" }, { status: 500 });
  }
}