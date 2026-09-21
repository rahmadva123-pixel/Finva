"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import { collection, doc, getDoc, getDocs, onSnapshot, query, where, updateDoc } from "firebase/firestore";
import { Loader2, ArrowUp, ArrowDown, Gift, TrendingUp, CircleDollarSign, RefreshCw } from "lucide-react";
import { TradingCard } from '@/components/ui/trading-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatDistanceToNow } from 'date-fns';

import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { FinancialStatCard } from '@/components/ui/financial-stat-card';
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { format } from 'date-fns';
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
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  

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
  const [totalDeposits, setTotalDeposits] = useState<number | null>(null);
  const [totalWithdrawals, setTotalWithdrawals] = useState<number | null>(null);

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

      const [investmentTxSnapshot, completedStakesSnapshot, completedPoolsSnapshot, bonusSnapshot, commissionsSnapshot, dailyEarningsSnapshot] = await Promise.all([
        getDocs(query(collection(db, "investmentTransactions"), where("userId", "==", userId), where("type", "in", ["Profit Return (Auto)", "Profit Return (Manual)"]))),
        getDocs(query(collection(db, "userStakes"), where("userId", "==", userId), where("status", "==", "completed"))),
        getDocs(query(collection(db, "userPoolInvestments"), where("userId", "==", userId), where("status", "==", "completed"))),
        getDocs(query(collection(db, "bonusTransactions"), where("userId", "==", userId))),
        getDocs(query(collection(db, "referralCommissions"), where("referrerId", "==", userId))),
        getDocs(query(collection(db, "earningTransactions"), where("userId", "==", userId), where("type", "==", "dailyEarning"))),
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
        if (data.type === "earningClaim") return;
        const createdAtMs = getTimestampMs(data.date || data.createdAt || data.updatedAt);
        if (createdAtMs >= startMs) earnings += Number(data.amount || 0);
      });

      commissionsSnapshot.forEach((snapshotDoc) => {
        const data = snapshotDoc.data();
        const createdAtMs = getTimestampMs(data.date || data.createdAt || data.updatedAt);
        if (createdAtMs >= startMs) earnings += Number(data.amount || 0);
      });

      dailyEarningsSnapshot.forEach((snapshotDoc) => {
        const data = snapshotDoc.data();
        const accruedAtMs = getTimestampMs(data.date || data.createdAt || data.updatedAt);
        if (accruedAtMs >= startMs) earnings += Number(data.amount || 0);
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

        // fetch total deposits and withdrawals
        try {
          // Total Deposits is the all-time amount actually credited to the wallet.
          const depSnap = await getDocs(query(collection(db, 'deposits'), where('userId', '==', user.uid)));
          const totalDep = depSnap.docs.reduce((sum, depositDoc) => {
            const deposit = depositDoc.data();
            const status = String(deposit.status || '').toLowerCase();
            if (status !== 'completed' && status !== 'approved') return sum;
            return sum + Number(deposit.amount || 0);
          }, 0);
          setTotalDeposits(Math.round(totalDep * 100) / 100);

          const withSnap = await getDocs(query(collection(db, 'withdrawals'), where('userId', '==', user.uid)));
          const totalWith = withSnap.docs.reduce((s, d) => s + (Number(d.data()?.amount || 0)), 0);
          setTotalWithdrawals(Math.round(totalWith * 100) / 100);
        } catch (e) {
          console.warn('Failed to fetch totals', e);
          setTotalDeposits(null);
          setTotalWithdrawals(null);
        }

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

  function RecentActivity() {
    const { user } = useAuth();
    const [txs, setTxs] = useState<any[]>([]);
    const [loadingRecent, setLoadingRecent] = useState(true);
    const [recentCurrency, setRecentCurrency] = useState<{symbol:string; position:'left'|'right'}>({ symbol: '$', position: 'left' });
    const [postBalances, setPostBalances] = useState<Record<string, number>>({});
    const [balancesEstimated, setBalancesEstimated] = useState(false);

    useEffect(() => {
      const fetchRecent = async () => {
        setLoadingRecent(true);
        if (!db || !user) { setLoadingRecent(false); return; }
        try {
          const currencyDoc = await getDoc(doc(db, 'settings', 'currency'));
          if (currencyDoc.exists()) setRecentCurrency(currencyDoc.data() as any);

          const all: any[] = [];

          const deposits = await getDocs(query(collection(db, 'deposits'), where('userId','==', user.uid)));
          deposits.forEach(d => { const data = d.data(); all.push({ id: d.id, amount: Number(data.amount||0), title: `Deposit via ${data.method||'card'}`, type: 'deposit', status: data.status, date: data.createdAt }); });

          const withdrawals = await getDocs(query(collection(db, 'withdrawals'), where('userId','==', user.uid)));
          withdrawals.forEach(d => { const data = d.data(); all.push({ id: d.id, amount: Number(data.amount||0), title: `Withdrawal via ${data.method||'method'}`, type: 'withdraw', status: data.status, date: data.createdAt }); });

          const bonus = await getDocs(query(collection(db, 'bonusTransactions'), where('userId','==', user.uid)));
          bonus.forEach(d => { const data = d.data(); all.push({ id: d.id, amount: Number(data.amount||0), title: data.description || 'Bonus', type: 'bonus', status: 'completed', date: data.date }); });

          const invest = await getDocs(query(collection(db, 'investmentTransactions'), where('userId','==', user.uid)));
          invest.forEach(d => { const data = d.data(); all.push({ id: d.id, amount: Number(data.amount||0), title: `${data.type} from ${data.planName||''}`, type: 'investment', status: 'completed', date: data.date }); });

          const p2p = await getDocs(query(collection(db, 'transactions'), where('userId','==', user.uid)));
          p2p.forEach(d => { const data = d.data(); all.push({ id: d.id, amount: Number(data.amount||0), title: data.title || '', type: data.type || 'receive', status: 'completed', date: data.date }); });

          all.sort((a,b) => (b.date?.seconds || 0) - (a.date?.seconds || 0));
          setTxs(all.slice(0, 6));
        } catch (e) {
          console.error('Error fetching recent activity', e);
        } finally {
          setLoadingRecent(false);
        }
      };
      fetchRecent();
    }, [user]);

    useEffect(() => {
      // compute running/post balances for each tx (compact display)
      if (!txs || txs.length === 0) { setPostBalances({}); return; }
      const getTimestamp = (d: any) => (d?.seconds ? d.seconds * 1000 : (typeof d === 'number' ? d : (d?.toDate ? d.toDate().getTime() : 0)));
      const signedAmount = (tx: any) => {
        // Pending transactions shouldn't affect the confirmed running balance
        if (tx.status === 'pending') return 0;
        const p = getProps(tx);
        const sign = p.sign === '+' ? 1 : p.sign === '-' ? -1 : 0;
        return sign * Number(tx.amount || 0);
      };

      // total effect of listed txs
      const totalSigned = txs.reduce((s, t) => s + signedAmount(t), 0);
      const currentBalanceRaw = (userData && typeof userData.balance === 'number') ? Number(userData.balance) : null;
      const balancesAreEstimated = currentBalanceRaw === null;
      setBalancesEstimated(balancesAreEstimated);
      const currentBalance = balancesAreEstimated ? 0 : currentBalanceRaw;
      const startingBalanceBeforeAll = Math.round((currentBalance - totalSigned) * 100) / 100;

      // sort ascending (oldest -> newest) and compute post-balance after each
      const itemsAsc = [...txs].sort((a,b) => getTimestamp(a.date) - getTimestamp(b.date));
      const balancesById: Record<string, number> = {};
      let running = startingBalanceBeforeAll;
      itemsAsc.forEach(it => {
        running = Math.round((running + signedAmount(it)) * 100) / 100;
        balancesById[it.id] = running;
      });

      setPostBalances(balancesById);
    }, [txs, userData]);

    const getProps = (tx:any) => {
      switch (tx.type) {
        case 'deposit': case 'receive': return { icon: <ArrowDown className="h-4 w-4 text-green-600" />, color: 'text-green-600', bg: 'bg-green-50', sign: '+' };
        case 'withdraw': case 'send': return { icon: <ArrowUp className="h-4 w-4 text-red-600" />, color: 'text-red-600', bg: 'bg-red-50', sign: '-' };
        case 'bonus': return { icon: <Gift className="h-4 w-4 text-yellow-600" />, color: 'text-yellow-600', bg: 'bg-yellow-50', sign: '+' };
        case 'investment': return { icon: <CircleDollarSign className="h-4 w-4 text-sky-600" />, color: 'text-sky-600', bg: 'bg-sky-50', sign: '+' };
        default: return { icon: <TrendingUp className="h-4 w-4 text-muted-foreground" />, color: 'text-muted-foreground', bg: 'bg-muted/10', sign: '' };
      }
    };

    return (
      <div>
        {loadingRecent ? (
          <div className="flex justify-center p-6"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : txs.length === 0 ? (
          <p className="text-center text-muted-foreground p-6">No recent activity.</p>
        ) : (
          <div className="divide-y divide-border/50">
            {txs.map(tx => {
              const p = getProps(tx);
              const relative = tx.date?.seconds ? formatDistanceToNow(new Date(tx.date.seconds * 1000), { addSuffix: true }) : '';
              const amountText = recentCurrency.position === 'left' ? `${recentCurrency.symbol}${Number(tx.amount||0).toFixed(2)}` : `${Number(tx.amount||0).toFixed(2)}${recentCurrency.symbol}`;
              const postBalance = postBalances[tx.id];
              return (
                <div key={tx.id} className="py-1">
                  <div className="flex items-center justify-between gap-2 p-2 sm:p-3 bg-card rounded-xl shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`${p.bg} flex items-center justify-center h-8 w-8 sm:h-10 sm:w-10 rounded-xl`}>
                        <div className="h-4 w-4 sm:h-6 sm:w-6">{p.icon}</div>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm sm:text-base font-medium text-card-foreground">{tx.title}</p>
                        <p className="text-[11px] sm:text-xs text-muted-foreground">{relative}</p>
                      </div>
                    </div>

                    <div className="flex flex-col items-end w-28 sm:w-auto text-right flex-shrink-0">
                      <div className="flex items-baseline gap-2">
                        <p className={`font-semibold ${p.color} text-sm sm:text-base`}>{p.sign}{amountText}</p>
                        {typeof postBalance === 'number' && <p className="text-[11px] sm:text-xs text-muted-foreground">Bal {formatCurrency(postBalance)}</p>}
                      </div>
                      <div className="mt-1">
                        {tx.status === 'pending' && <span className="inline-block px-1.5 py-0.5 text-[11px] rounded-full bg-yellow-50 text-yellow-600">Pending</span>}
                        {tx.status === 'completed' && <span className="inline-block px-1.5 py-0.5 text-[11px] rounded-full bg-green-50 text-green-600">Completed</span>}
                        {tx.status === 'rejected' && <span className="inline-block px-1.5 py-0.5 text-[11px] rounded-full bg-red-50 text-red-600">Rejected</span>}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
        <div className="mt-4">
          <Button asChild variant="outline" className="w-full rounded-xl"><Link href="/dashboard/finance/history">View All History</Link></Button>
        </div>
      </div>
    )
  }

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

  const handleForceVerify = async () => {
    if (!user || !db) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), { verificationStatus: 'verified', devForceUnverified: false });
      toast({ title: 'Success', description: 'Account marked as verified (dev).' });
    } catch (e) {
      console.error('Error forcing verification', e);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to mark verified.' });
    }
  }

  const handleForceUnverify = async () => {
    if (!user || !db || process.env.NODE_ENV === 'production') return;
    try {
      await updateDoc(doc(db, 'users', user.uid), { verificationStatus: 'unverified', devForceUnverified: true });
      toast({ title: 'Account reset', description: 'Your account is now unverified.' });
      router.push('/verification');
    } catch (e) {
      console.error('Error forcing unverified status', e);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to mark unverified.' });
    }
  }

  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-full sm:max-w-5xl space-y-4 sm:space-y-6">
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
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <FinancialStatCard
                    title="Total Deposits"
                    value={totalDeposits === null ? (loading ? 'Loading...' : '—') : formatCurrency(totalDeposits)}
                    hint="All-time deposits"
                  />
                  <FinancialStatCard
                    title="Total Withdrawals"
                    value={totalWithdrawals === null ? (loading ? 'Loading...' : '—') : formatCurrency(totalWithdrawals)}
                    hint="All-time withdrawals"
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
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">KYC Status</p>
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
                      ? "Your KYC is complete."
                      : accountStatus === "Unverified"
                        ? "Please complete KYC to unlock all features."
                        : "This account is currently restricted."}
                  </p>
                  {accountStatus !== 'Verified' && (
                    <div className="mt-3 flex items-center gap-2">
                      <Button asChild size="sm">
                        <Link href="/verification">Get Verified</Link>
                      </Button>
                      {process.env.NODE_ENV !== 'production' && (
                        <Button size="sm" variant="ghost" onClick={handleForceVerify}>Mark Verified</Button>
                      )}
                    </div>
                  )}
                  {accountStatus === 'Verified' && process.env.NODE_ENV !== 'production' && (
                    <div className="mt-3">
                      <Button size="sm" variant="ghost" onClick={handleForceUnverify}>Mark Unverified</Button>
                    </div>
                  )}
                </div>

              </div>
            </div>
          </CardContent>
        </Card>

        {/* Top Markets removed per request */}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Card className="rounded-2xl transition-colors hover:border-primary/20 hover:bg-primary/5">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="w-full px-3 sm:px-4">
                <RecentActivity />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
