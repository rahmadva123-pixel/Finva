import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  runTransaction,
  serverTimestamp,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";
import { addEarning } from "./earnings";
import { getReferralDailyPercentage } from "./referral";

export interface PromoCodeSettings {
  promoCodeEnabled: boolean;
  promoCodeMinDeposit: number;
  promoCodeRewardPercentage: number;
}

export interface PromoCodeRecord {
  id: string;
  userId: string;
  code: string;
  cycleKey: string;
  status: "active" | "redeemed" | "expired";
  eligibleDepositTotal: number;
  rewardPercentage: number;
  rewardAmount: number;
  minDepositRequired: number;
  issuedAtMs: number;
  expiresAtMs: number;
  createdAt?: any;
  redeemedAt?: any;
  expiredAt?: any;
}

export interface PromoCodeStatus {
  eligible: boolean;
  depositTotal: number;
  settings: PromoCodeSettings;
  reason?: string;
  data?: PromoCodeRecord;
  nextAvailableAtMs?: number | null;
  qualifiedAtMs?: number | null;
}

interface CompletedDepositInfo {
  total: number;
  qualifyingAtMs: number | null;
}

const DEFAULT_PROMO_SETTINGS: PromoCodeSettings = {
  promoCodeEnabled: false,
  promoCodeMinDeposit: 495,
  promoCodeRewardPercentage: 1,
};

const PROMO_INTERVAL_MS = 24 * 60 * 60 * 1000;

const roundToCents = (value: number) => Math.round((value || 0) * 100) / 100;

const formatDollar = (value: number) => `$${roundToCents(value).toFixed(2)}`;

const getTimestampMs = (value: any): number => {
  if (!value) return 0;
  if (typeof value === "number") return value;
  if (value instanceof Date) return value.getTime();
  if (typeof value?.toDate === "function") return value.toDate().getTime();
  if (typeof value?.seconds === "number") return value.seconds * 1000;
  return 0;
};

const normalizePromoCode = (value: string) => value.trim().toUpperCase().replace(/\s+/g, "");

const buildPromoCode = (userId: string, issuedAtMs: number) => {
  const cyclePart = issuedAtMs.toString(36).slice(-6).toUpperCase();
  const userPart = userId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 4).toUpperCase() || "USER";
  const randomPart = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `WW-${userPart}-${cyclePart}-${randomPart}`;
};

export async function getPromoCodeSettings(): Promise<PromoCodeSettings> {
  // Promo system disabled globally for this deployment. Return disabled settings.
  return DEFAULT_PROMO_SETTINGS;
}

async function getCompletedDepositInfo(userId: string, minDeposit: number): Promise<CompletedDepositInfo> {
  if (!db || !userId) return { total: 0, qualifyingAtMs: null };

  const depositsQuery = query(collection(db, "deposits"), where("userId", "==", userId));
  const depositsSnapshot = await getDocs(depositsQuery);

  const completedDeposits = depositsSnapshot.docs
    .map((depositDoc) => {
      const data = depositDoc.data();
      const status = String(data.status || "").toLowerCase();
      return {
        amount: Number(data.amount || 0),
        status,
        effectiveAtMs: getTimestampMs(data.completedAt || data.updatedAt || data.createdAt),
      };
    })
    .filter((deposit) => (deposit.status === "completed" || deposit.status === "approved") && deposit.amount > 0)
    .sort((a, b) => a.effectiveAtMs - b.effectiveAtMs);

  let total = 0;
  let qualifyingAtMs: number | null = null;

  for (const deposit of completedDeposits) {
    total += deposit.amount;
    if (qualifyingAtMs === null && total >= minDeposit) {
      qualifyingAtMs = deposit.effectiveAtMs || Date.now();
    }
  }

  return {
    total: roundToCents(total),
    qualifyingAtMs,
  };
}

export async function getCompletedDepositTotal(userId: string): Promise<number> {
  const { total } = await getCompletedDepositInfo(userId, 0);
  return total;
}

async function getUserPromoCodes(userId: string): Promise<PromoCodeRecord[]> {
  if (!db || !userId) return [];

  const promoSnapshot = await getDocs(query(collection(db, "promoCodes"), where("userId", "==", userId)));
  return promoSnapshot.docs
    .map((promoDoc) => ({ id: promoDoc.id, ...promoDoc.data() } as PromoCodeRecord))
    .sort((a, b) => Number(b.issuedAtMs || 0) - Number(a.issuedAtMs || 0));
}

async function expireOutdatedPromoCodes(promoCodes: PromoCodeRecord[], nowMs: number) {
  if (!db) return;

  const staleCodes = promoCodes.filter(
    (promoCode) => promoCode.status === "active" && Number(promoCode.expiresAtMs || 0) > 0 && Number(promoCode.expiresAtMs) <= nowMs
  );

  if (staleCodes.length === 0) return;

  const batch = writeBatch(db);
  staleCodes.forEach((promoCode) => {
    batch.update(doc(db, "promoCodes", promoCode.id), {
      status: "expired",
      expiredAt: serverTimestamp(),
    });
    promoCode.status = "expired";
  });

  await batch.commit();
}

async function createPromoCodeForUser(
  userId: string,
  depositTotal: number, // kept for compatibility, but will use wallet balance
  settings: PromoCodeSettings,
  qualifiedAtMs: number,
  lastIssuedAtMs: number
) {
  if (!db) {
    return { created: false as const, waitUntilMs: null as number | null };
  }

  const userRef = doc(db, "users", userId);

  return runTransaction(db, async (transaction) => {
    const userDoc = await transaction.get(userRef);
    if (!userDoc.exists()) {
      throw new Error("User not found.");
    }

    const storedLastIssuedAtMs = Number(userDoc.data()?.lastPromoCodeIssuedAtMs || 0);
    const effectiveLastIssuedAtMs = Math.max(storedLastIssuedAtMs, lastIssuedAtMs);
    const nextReadyAtMs = effectiveLastIssuedAtMs > 0 ? effectiveLastIssuedAtMs + PROMO_INTERVAL_MS : qualifiedAtMs + PROMO_INTERVAL_MS;
    const nowMs = Date.now();

    if (nowMs < nextReadyAtMs) {
      return {
        created: false as const,
        waitUntilMs: nextReadyAtMs,
      };
    }

    const promoRef = doc(collection(db, "promoCodes"));
    const issuedAtMs = nowMs;
    // Fetch wallet balance from userDoc
    const walletBalance = Number(userDoc.data()?.balance || 0);
    const rewardAmount = roundToCents((walletBalance * settings.promoCodeRewardPercentage) / 100);
    const promoData: Omit<PromoCodeRecord, "id"> = {
      userId,
      code: buildPromoCode(userId, issuedAtMs),
      cycleKey: String(issuedAtMs),
      status: "active",
      eligibleDepositTotal: walletBalance, // now reflects wallet balance
      rewardPercentage: settings.promoCodeRewardPercentage,
      rewardAmount,
      minDepositRequired: settings.promoCodeMinDeposit,
      issuedAtMs,
      expiresAtMs: issuedAtMs + PROMO_INTERVAL_MS,
      createdAt: serverTimestamp(),
    };

    transaction.set(promoRef, promoData);
    transaction.set(
      userRef,
      {
        lastPromoCodeIssuedAtMs: issuedAtMs,
        lastPromoCodeId: promoRef.id,
        promoQualifiedAtMs: qualifiedAtMs,
      },
      { merge: true }
    );

    return {
      created: true as const,
      waitUntilMs: promoData.expiresAtMs,
      data: { id: promoRef.id, ...promoData } as PromoCodeRecord,
    };
  });
}

async function notifyPromoCode(userId: string, promoCode: PromoCodeRecord) {
  if (!db) return;

  let promoNotificationEnabled = true;
  try {
    const notificationSettingsSnap = await getDoc(doc(db, "settings", "notifications"));
    if (notificationSettingsSnap.exists()) {
      promoNotificationEnabled = notificationSettingsSnap.data().promoCode ?? true;
    }
  } catch (error) {
    console.error("Failed to load notification settings for promo code:", error);
  }

  if (!promoNotificationEnabled) return;

  await addDoc(collection(db, "notifications"), {
    userId,
    title: "Your unique promo code is ready",
    description: `Use code ${promoCode.code} once within 24 hours to claim ${promoCode.rewardPercentage}% (${formatDollar(promoCode.rewardAmount)}) in the Promo section.`,
    isRead: false,
    createdAt: serverTimestamp(),
    link: "/dashboard/bonus/daily",
    type: "promoCode",
  });
}

export async function ensureDailyPromoCode(userId: string): Promise<PromoCodeStatus> {
  // Promo service has been disabled for this deployment. Return a disabled status.
  return {
    eligible: false,
    depositTotal: 0,
    settings: DEFAULT_PROMO_SETTINGS,
    reason: "Promo rewards have been disabled.",
  };
}

export async function redeemPromoCode(userId: string, enteredCode: string) {
  throw new Error("Promo system has been disabled.");
}
