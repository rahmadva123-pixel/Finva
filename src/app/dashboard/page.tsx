"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { useEffect, useState } from "react";
import { collection, doc, getDoc, getDocs, onSnapshot, query, where } from "firebase/firestore";
import { ArrowUp, Headset, RefreshCw, TrendingUp, Wallet } from "lucide-react";

import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { FinancialStatCard } from '@/components/ui/financial-stat-card';
import { MarketCard } from '@/components/ui/market-card';
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
interface UserData {
  username?: string;
  firstName?: string;
  lastName?: string;
  balance?: number;
  verificationStatus?: string;
  disabled?: boolean;
  locked?: boolean;
  status?: string;
}

interface CurrencySettings {
  symbol: string;
  position: "left" | "right";
  mainWalletName?: string;
}

export const dynamic = 'force-dynamic'

export default function DashboardPage() {
  const pathname = usePathname();
  const { user } = useAuth();
  const { toast } = useToast();
  const [promoStatus, setPromoStatus] = useState<any>(null);
  const [promoTimer, setPromoTimer] = useState<string>("");

interface CurrencySettings {
  symbol: string;
  position: "left" | "right";
  mainWalletName?: string;
}

  const [userData, setUserData] = useState<UserData | null>(null);
  const [currency, setCurrency] = useState<CurrencySettings>({
    symbol: "$",
    position: "left",
    mainWalletName: "Main Wallet",
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [redeemCode, setRedeemCode] = useState("");
  const [redeemingCode, setRedeemingCode] = useState(false);
  const [refreshingBalance, setRefreshingBalance] = useState(false);
  const [todayEarnings, setTodayEarnings] = useState(0);

  const getTimestampMs = (value: any) => {
    if (!value) return 0;
    if (typeof value === "number") return value;
    if (value instanceof Date) return value.getTime();
    if (typeof value?.toDate === "function") return value.toDate().getTime();
    if (typeof value?.seconds === "number") return value.seconds * 1000;
    return 0;
  };

  const calculateTodaysEarnings = async (userId: string) => {
    if (!db || !userId) return 0;

    try {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const startMs = startOfToday.getTime();
      let earnings = 0;

      const [investmentTxSnapshot, completedStakesSnapshot, completedPoolsSnapshot, bonusSnapshot, commissionsSnapshot] = await Promise.all([
        getDocs(query(collection(db, "investmentTransactions"), where("userId", "==", userId), where("type", "in", ["Profit Return (Auto)", "Profit Return (Manual)"]))),
        getDocs(query(collection(db, "userStakes"), where("userId", "==", userId), where("status", "==", "completed"))),
        getDocs(query(collection(db, "userPoolInvestments"), where("userId", "==", userId), where("status", "==", "completed"))),
        getDocs(query(collection(db, "bonusTransactions"), where("userId", "==", userId))),
        getDocs(query(collection(db, "referralCommissions"), where("referrerId", "==", userId))),
      ]);

      investmentTxSnapshot.forEach((snapshotDoc) => {
        const data = snapshotDoc.data();
        const createdAtMs = getTimestampMs(data.date || data.createdAt || data.updatedAt);
        if (createdAtMs >= startMs) earnings += Number(data.amount || 0);
      });

      completedStakesSnapshot.forEach((snapshotDoc) => {
        const data = snapshotDoc.data();
        const completedAtMs = getTimestampMs(data.completedAt || data.updatedAt || data.date);
        if (completedAtMs >= startMs) {
          earnings += (Number(data.amount || 0) * Number(data.returnPercentage || 0)) / 100;
        }
      });

      completedPoolsSnapshot.forEach((snapshotDoc) => {
        const data = snapshotDoc.data();
        const completedAtMs = getTimestampMs(data.completedAt || data.updatedAt || data.date);
        if (completedAtMs >= startMs) {
          const profit = Number(data.returnAmount || 0) - Number(data.amount || 0);
          if (profit > 0) earnings += profit;
        }
      });

      bonusSnapshot.forEach((snapshotDoc) => {
        const data = snapshotDoc.data();
        const createdAtMs = getTimestampMs(data.date || data.createdAt || data.updatedAt);
        if (createdAtMs >= startMs) earnings += Number(data.amount || 0);
      });

      commissionsSnapshot.forEach((snapshotDoc) => {
        const data = snapshotDoc.data();
        const createdAtMs = getTimestampMs(data.date || data.createdAt || data.updatedAt);
        if (createdAtMs >= startMs) earnings += Number(data.amount || 0);
      });

      return Math.round(earnings * 100) / 100;
    } catch (error) {
      console.error("Failed to calculate today's earnings:", error);
      return 0;
    }
  };

  useEffect(() => {
    let unsubscribe = () => {};

    const fetchOverviewData = async () => {
      if (!user) {
        setLoadError("Please sign in to continue.");
        setLoading(false);
        return;
      }

      if (!db) {
        setLoadError("Dashboard data is temporarily unavailable.");
        setLoading(false);
        return;
      }

      try {
        setLoadError(null);
        const currencySnap = await getDoc(doc(db, "settings", "currency"));
        if (currencySnap.exists()) {
          setCurrency((prev) => ({ ...prev, ...(currencySnap.data() as CurrencySettings) }));
        }

        const latestTodayEarnings = await calculateTodaysEarnings(user.uid);
        setTodayEarnings(latestTodayEarnings);

        unsubscribe = onSnapshot(
          doc(db, "users", user.uid),
          (snapshot) => {
            if (snapshot.exists()) {
              const data = snapshot.data() as UserData;
              setUserData({
                username: data.username || user.email?.split("@")[0] || user.uid.slice(0, 8).toUpperCase(),
                firstName: data.firstName || "",
                lastName: data.lastName || "",
                balance: data.balance || 0,
                verificationStatus: data.verificationStatus || "unverified",
                disabled: data.disabled === true,
                locked: data.locked === true || String(data.status || "").toLowerCase() === "locked",
              });
            } else {
              setUserData({
                username: user.email?.split("@")[0] || user.uid.slice(0, 8).toUpperCase(),
                firstName: "",
                lastName: "",
                balance: 0,
                verificationStatus: "unverified",
                disabled: false,
                locked: false,
              });
            }
            setLoading(false);
          },
          () => {
            setLoadError("We couldn't refresh your dashboard right now.");
            setLoading(false);
          }
        );
      } catch {
        setLoadError("We couldn't load your dashboard right now.");
        setLoading(false);
      }
    };

    void fetchOverviewData();
    return () => unsubscribe();
  }, [user]);

  const formatCurrency = (amount = 0) => {
    const numericAmount = Number(amount || 0);
    const value = numericAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return currency.position === "left" ? `${currency.symbol}${value}` : `${value}${currency.symbol}`;
  };

  const displayName = [userData?.firstName, userData?.lastName].filter(Boolean).join(" ") || userData?.username || user?.email || "Investor";
  const accountStatus = userData?.disabled
    ? "Disabled"
    : userData?.locked
      ? "Locked"
      : String(userData?.verificationStatus || "").toLowerCase() === "verified"
        ? "Verified"
        : "Unverified";

  const handleRefreshBalance = async () => {
    if (!user || !db || refreshingBalance) return;

    setRefreshingBalance(true);
    try {
      const [currencySnap, userSnap, latestTodayEarnings] = await Promise.all([
        getDoc(doc(db, "settings", "currency")),
        getDoc(doc(db, "users", user.uid)),
        calculateTodaysEarnings(user.uid),
      ]);

      setTodayEarnings(latestTodayEarnings);

      if (currencySnap.exists()) {
        setCurrency((prev) => ({ ...prev, ...(currencySnap.data() as CurrencySettings) }));
      }

      if (userSnap.exists()) {
        const data = userSnap.data() as UserData;
        setUserData((prev) => ({
          username: data.username || prev?.username || user.email?.split("@")[0] || user.uid.slice(0, 8).toUpperCase(),
          firstName: data.firstName || "",
          lastName: data.lastName || "",
          balance: data.balance || 0,
          verificationStatus: data.verificationStatus || "unverified",
          disabled: data.disabled === true,
          locked: data.locked === true || String(data.status || "").toLowerCase() === "locked",
        }));
      }

      toast({
        title: "Balance refreshed",
        description: "Your latest wallet balance and today's earnings are now showing.",
      });
    } catch {
      toast({
        variant: "destructive",
        title: "Refresh failed",
        description: "We couldn't refresh your balance right now.",
      });
    } finally {
      setRefreshingBalance(false);
    }
  };

  const handleRedeemFromDashboard = async () => { /* promo system removed */ };

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-5xl space-y-4 sm:space-y-6">
        {loadError && (
          <Card className="rounded-2xl border-amber-500/30 bg-amber-500/5">
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">{loadError}</p>
              {!user && (
                <Button asChild variant="outline" className="min-h-11 rounded-xl">
                  <Link href="/login">Go to login</Link>
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/15 via-card to-card">
          <CardContent className="p-0">
            <div className="grid gap-4 p-4 sm:p-6 lg:grid-cols-[1.3fr_0.7fr]">
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Welcome back</p>
                  <h1 className="text-2xl font-bold font-headline sm:text-3xl">{displayName}</h1>
                  <p className="mt-1 break-all text-sm text-muted-foreground">{user?.email || "Unknown user"}</p>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <FinancialStatCard
                    title={currency.mainWalletName || 'Main Wallet'}
                    value={loading ? 'Loading...' : formatCurrency(userData?.balance || 0)}
                    hint={loading ? '' : 'Available balance'}
                  />
                  <FinancialStatCard
                    title="Today's Earnings"
                    value={loading ? 'Loading...' : formatCurrency(todayEarnings)}
                    hint="Today"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                  <Button
                    asChild
                    variant={pathname.startsWith('/dashboard/finance/deposit') ? 'default' : 'outline'}
                    className="min-h-11 rounded-xl active:bg-primary active:text-primary-foreground"
                  >
                    <Link href="/dashboard/finance/deposit">Deposit</Link>
                  </Button>
                  <Button
                    asChild
                    variant={pathname.startsWith('/dashboard/finance/withdraw') ? 'default' : 'outline'}
                    className="min-h-11 rounded-xl active:bg-primary active:text-primary-foreground"
                  >
                    <Link href="/dashboard/finance/withdraw">Withdraw</Link>
                  </Button>
                </div>
              </div>

              <div className="grid gap-3 lg:grid-cols-1">
                <div className="rounded-2xl border bg-background/70 p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Account Status</p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{accountStatus}</span>
                    <Badge
                      className={
                        accountStatus === "Verified"
                          ? "bg-green-600 hover:bg-green-600"
                          : accountStatus === "Disabled" || accountStatus === "Locked"
                            ? "bg-red-600 hover:bg-red-600"
                            : ""
                      }
                      variant={accountStatus === "Unverified" ? "secondary" : undefined}
                    >
                      {accountStatus}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {accountStatus === "Verified"
                      ? "Your account is fully active."
                      : accountStatus === "Unverified"
                        ? "Please complete verification to unlock all features."
                        : "This account is currently restricted."}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden rounded-2xl border shadow-sm">
          <CardContent className="space-y-4 p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="mb-2 inline-flex items-center rounded-full bg-muted px-3 py-1 text-xs font-semibold text-foreground">
                  Markets
                </div>
                <h2 className="text-xl font-bold">Top Markets</h2>
                <p className="text-sm text-muted-foreground">Quick access to market tickers and a summary of top movers.</p>
              </div>
              <div>
                <Button asChild size="sm" variant="outline" className="rounded-xl">
                  <Link href="/markets">Open Markets</Link>
                </Button>
              </div>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <MarketCard symbol="BTC/USDT" price="$27,500" change={2.4} />
              <MarketCard symbol="ETH/USDT" price="$1,800" change={-1.2} />
              <MarketCard symbol="SOL/USDT" price="$30.12" change={0.8} />
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Card className="rounded-2xl transition-colors hover:border-primary/20 hover:bg-primary/5">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base"><Wallet className="h-4 w-4 text-primary" /> Wallet</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-sm text-muted-foreground">Check balances and transactions quickly.</p>
              <Button asChild variant="outline" className="min-h-11 w-full rounded-xl"><Link href="/dashboard/finance/wallet">Open Wallet</Link></Button>
            </CardContent>
          </Card>

          <Card className="rounded-2xl transition-colors hover:border-primary/20 hover:bg-primary/5">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base"><ArrowUp className="h-4 w-4 text-primary" /> Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-sm text-muted-foreground">Review deposits, withdrawals, and recent account history.</p>
              <Button asChild variant="outline" className="min-h-11 w-full rounded-xl"><Link href="/dashboard/finance/history">Open History</Link></Button>
            </CardContent>
          </Card>

          <Card className="rounded-2xl transition-colors hover:border-primary/20 hover:bg-primary/5">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base"><Headset className="h-4 w-4 text-primary" /> Support</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-sm text-muted-foreground">Reach help fast without leaving the app.</p>
              <Button asChild variant="outline" className="min-h-11 w-full rounded-xl"><Link href="/dashboard/support">Get Help</Link></Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
