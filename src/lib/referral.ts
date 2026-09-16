// Old multi-tier referral/level system removed.
// This module now exposes only the helper functions needed by the app
// (counting direct referrals, qualified referrals, and computing the
// referral daily percentage progression).

import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

async function countQualified(referrerId: string, minimumDepositTotal = 495) {
  const referralsSnapshot = await getDocs(query(collection(db, "users"), where("referredBy", "==", referrerId)));

  const results: Array<{ id: string; referredAt: any; qualified: boolean }> = [];

  for (const referralDoc of referralsSnapshot.docs) {
    const depositsSnapshot = await getDocs(query(collection(db, "deposits"), where("userId", "==", referralDoc.id)));

    const completedDepositTotal = depositsSnapshot.docs.reduce((sum, depositDoc) => {
      const data = depositDoc.data();
      const status = String(data.status || "").toLowerCase();
      if (status !== "completed" && status !== "approved") return sum;
      return sum + Number(data.amount || 0);
    }, 0);

    const qualified = completedDepositTotal >= minimumDepositTotal;
    results.push({ id: referralDoc.id, referredAt: referralDoc.data()?.referredAt ?? null, qualified });
  }

  return results;
}

export async function getReferralDailyPercentage(userId: string): Promise<number> {
  // New simplified referral daily percentage rules:
  // - 0 qualified referrals => 1%
  // - 1 qualified referral  => 1.5%
  // - 2 or more qualified  => 2%
  const BASELINE = 1;
  try {
    const referrals = await countQualified(userId, 495);
    const qualifiedCount = referrals.filter((r) => r.qualified).length;

    if (qualifiedCount >= 2) return 2;
    if (qualifiedCount === 1) return 1.5;
    return BASELINE;
  } catch (e) {
    console.warn('Failed to compute referral daily percentage, falling back to baseline', e);
    return BASELINE;
  }
}

// Note: the previous `getDirectReferralStatus` and `tiers` concept
// has been intentionally removed as the multi-level program is no
// longer supported.

export async function isFirstCompletedDepositForUser(userId: string, excludeDepositId?: string): Promise<boolean> {
  return false;
}
