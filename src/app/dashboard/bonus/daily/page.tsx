
"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { BellRing, Gift, Loader2, ShieldCheck, TicketPercent, Wallet } from "lucide-react";

import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { ensureDailyPromoCode, redeemPromoCode, type PromoCodeStatus } from "@/lib/promo";

interface CurrencySettings {
  symbol: string;
  position: "left" | "right";
}

interface BonusTransaction {
  id: string;
  amount: number;
  date: any;
  description: string;
  type: "signup" | "daily" | "task" | "promo" | "interest";
  promoCode?: string;
}

function PromoCountdown({ targetTime, label }: { targetTime: number; label: string }) {
  const [timeLeft, setTimeLeft] = useState("--:--:--");

  useEffect(() => {
    const updateCountdown = () => {
      const distance = targetTime - Date.now();
      if (distance <= 0) {
        setTimeLeft("00:00:00");
        return;
      }

      const totalSeconds = Math.floor(distance / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;

      setTimeLeft(
        `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
      );
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [targetTime]);

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-center">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-bold text-primary">{timeLeft}</p>
    </div>
  );
}

export default function DailyBonusPage() {
  const { toast } = useToast();
  const { user } = useAuth();

  const [currency, setCurrency] = useState<CurrencySettings>({ symbol: "$", position: "left" });
  const [promoStatus, setPromoStatus] = useState<PromoCodeStatus | null>(null);
  const [promoInput, setPromoInput] = useState("");
  const [history, setHistory] = useState<BonusTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const formatCurrency = useCallback(
    (amount: number) => {
      const value = Number(amount || 0).toFixed(2);
      return currency.position === "left" ? `${currency.symbol}${value}` : `${value}${currency.symbol}`;
    },
    [currency]
  );

  const loadPromoData = useCallback(async () => {
    if (!user || !db) {
      setLoading(false);
      setLoadingHistory(false);
      return;
    }

    setLoading(true);
    setLoadingHistory(true);

    try {
      const [currencyDoc, promoResult, historySnapshot] = await Promise.all([
        getDoc(doc(db, "settings", "currency")),
        ensureDailyPromoCode(user.uid),
        getDocs(query(collection(db, "bonusTransactions"), where("userId", "==", user.uid))),
      ]);

      if (currencyDoc.exists()) {
        setCurrency(currencyDoc.data() as CurrencySettings);
      }

      setPromoStatus(promoResult);

      const historyData = historySnapshot.docs
        .map((historyDoc) => ({ id: historyDoc.id, ...historyDoc.data() } as BonusTransaction))
        .filter((item) => item.type === "promo")
        .sort((a, b) => (b.date?.seconds || 0) - (a.date?.seconds || 0));

      setHistory(historyData);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message || "Failed to load promo rewards." });
    } finally {
      setLoading(false);
      setLoadingHistory(false);
    }
  }, [toast, user]);

  useEffect(() => {
    void loadPromoData();
  }, [loadPromoData]);

  const handleRedeem = async () => {
    if (!user) return;

    setSubmitting(true);
    try {
      const result = await redeemPromoCode(user.uid, promoInput);
      toast({
        title: "Promo claimed",
        description: `${formatCurrency(result.rewardAmount)} has been added to your wallet successfully.`,
      });
      setPromoInput("");
      await loadPromoData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Promo redeem failed",
        description: error.message || "Please check the code and try again.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  const promoEnabled = promoStatus?.settings.promoCodeEnabled ?? true;
  const minDeposit = promoStatus?.settings.promoCodeMinDeposit ?? 495;
  const rewardPercentage = promoStatus?.settings.promoCodeRewardPercentage ?? 1;
  const depositTotal = promoStatus?.depositTotal ?? 0;
  const rewardAmount = promoStatus?.data?.rewardAmount ?? (depositTotal * rewardPercentage) / 100;
  const isEligible = promoStatus?.eligible ?? false;
  const isRedeemed = promoStatus?.data?.status === "redeemed";
  const remainingToUnlock = Math.max(0, minDeposit - depositTotal);
  const hasQualifiedDeposit = depositTotal >= minDeposit;
  const waitingForNextCode = hasQualifiedDeposit && !isEligible;
  const nextAvailableText = promoStatus?.nextAvailableAtMs ? format(new Date(promoStatus.nextAvailableAtMs), "PPp") : null;
  const statusLabel = isEligible ? "Code ready" : waitingForNextCode ? "Waiting 24h" : "Locked";

  if (!promoEnabled) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold font-headline tracking-tight">24-Hour Promo Code</h1>
            <p className="text-muted-foreground">Redeem your unique promo reward from your in-app notifications.</p>
          </div>
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              The promo reward system is currently not available.
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold font-headline tracking-tight">24-Hour Promo Code</h1>
          <p className="text-muted-foreground">
            Users with at least {formatCurrency(minDeposit)} in completed deposits receive their first code after 24 hours, then each next code unlocks 24 hours after the previous one.
          </p>
        </div>

        <Tabs defaultValue="redeem">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="redeem">Promo Section</TabsTrigger>
            <TabsTrigger value="history">Promo History</TabsTrigger>
          </TabsList>

          <TabsContent value="redeem" className="space-y-6 pt-4">
            <Card className="border-primary/20 bg-gradient-to-br from-primary/10 via-background to-background">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Gift className="h-5 w-5 text-primary" />
                      Your Promo Reward Cycle
                    </CardTitle>
                    <CardDescription>
                      The first code arrives 24 hours after your qualifying deposit, and each code can be used once only.
                    </CardDescription>
                  </div>
                  <Badge variant={isEligible ? "default" : "secondary"}>{statusLabel}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border bg-background/70 p-4">
                    <p className="text-xs text-muted-foreground">Completed deposits</p>
                    <p className="mt-1 text-xl font-semibold">{formatCurrency(depositTotal)}</p>
                  </div>
                  <div className="rounded-xl border bg-background/70 p-4">
                    <p className="text-xs text-muted-foreground">Daily reward</p>
                    <p className="mt-1 text-xl font-semibold">{formatCurrency(rewardAmount)}</p>
                  </div>
                  <div className="rounded-xl border bg-background/70 p-4">
                    <p className="text-xs text-muted-foreground">Reward rate</p>
                    <p className="mt-1 text-xl font-semibold">{rewardPercentage}%</p>
                  </div>
                </div>

                {isEligible && promoStatus?.data ? (
                  <div className="space-y-4 rounded-2xl border border-dashed border-primary/40 bg-background/80 p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-1">
                        <p className="flex items-center gap-2 text-sm font-medium">
                          <BellRing className="h-4 w-4 text-primary" />
                          Your current unique code has been sent to your notifications.
                        </p>
                        <p className="text-xs text-muted-foreground">Use it once only before the next 24-hour cycle begins.</p>
                      </div>
                      <Badge variant={isRedeemed ? "secondary" : "default"}>
                        {isRedeemed ? "Already used" : "Code ready"}
                      </Badge>
                    </div>

                    <div className="rounded-xl bg-muted/60 p-4 text-center">
                      <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Your Unique Promo Code</p>
                      <p className="mt-2 break-all text-2xl font-bold tracking-[0.2em] text-primary">{promoStatus.data.code}</p>
                    </div>

                    {promoStatus.data.expiresAtMs ? (
                      <PromoCountdown targetTime={promoStatus.data.expiresAtMs} label="This code expires in" />
                    ) : null}

                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button type="button" variant="outline" className="flex-1" onClick={() => setPromoInput(promoStatus.data?.code || "") }>
                        <TicketPercent className="mr-2 h-4 w-4" />
                        Use Current Code
                      </Button>
                      <Button type="button" variant="ghost" className="flex-1" asChild>
                        <Link href="/dashboard/notifications">Open Notifications</Link>
                      </Button>
                    </div>
                  </div>
                ) : waitingForNextCode ? (
                  <div className="space-y-4 rounded-2xl border bg-muted/30 p-4">
                    <div className="flex items-start gap-3">
                      <BellRing className="mt-0.5 h-5 w-5 text-primary" />
                      <div>
                        <p className="font-medium">Next code is on the way</p>
                        <p className="text-sm text-muted-foreground">
                          You already qualify. Your next unique promo code will appear after the current 24-hour waiting period ends.
                        </p>
                      </div>
                    </div>
                    {promoStatus?.nextAvailableAtMs ? (
                      <PromoCountdown targetTime={promoStatus.nextAvailableAtMs} label="Next code unlocks in" />
                    ) : null}
                    {nextAvailableText ? (
                      <div className="rounded-xl border bg-background p-4 text-sm">
                        <p>Next code available: <span className="font-semibold text-primary">{nextAvailableText}</span></p>
                      </div>
                    ) : null}
                    {promoStatus?.reason ? <p className="text-xs text-muted-foreground">{promoStatus.reason}</p> : null}
                    <Button type="button" variant="outline" asChild>
                      <Link href="/dashboard/notifications">Open Notifications</Link>
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4 rounded-2xl border bg-muted/30 p-4">
                    <div className="flex items-start gap-3">
                      <ShieldCheck className="mt-0.5 h-5 w-5 text-primary" />
                      <div>
                        <p className="font-medium">Promo unlock requirement</p>
                        <p className="text-sm text-muted-foreground">
                          Complete deposits totaling at least {formatCurrency(minDeposit)} to start the 24-hour promo cycle.
                        </p>
                      </div>
                    </div>
                    <div className="rounded-xl border bg-background p-4 text-sm">
                      <p>You still need <span className="font-semibold text-primary">{formatCurrency(remainingToUnlock)}</span> in completed deposits to unlock the promo reward.</p>
                    </div>
                    <Button asChild>
                      <Link href="/dashboard/finance/deposit">
                        <Wallet className="mr-2 h-4 w-4" />
                        Make a Deposit
                      </Link>
                    </Button>
                    {promoStatus?.reason ? <p className="text-xs text-muted-foreground">{promoStatus.reason}</p> : null}
                  </div>
                )}

                <div className="rounded-2xl border border-primary/20 bg-background/90 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <TicketPercent className="h-5 w-5 text-primary" />
                    <p className="font-semibold">Redeem promo code</p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Paste your code here</label>
                    <Input
                      value={promoInput}
                      onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                      placeholder="Enter your promo code"
                      disabled={submitting || isRedeemed}
                    />
                    <p className="text-xs text-muted-foreground">
                      {isEligible
                        ? "Use the code from your notification, then tap redeem."
                        : "When you receive a promo code in notifications, paste it here to redeem your reward."}
                    </p>
                  </div>
                  <Button className="mt-4 w-full" size="lg" disabled={submitting || isRedeemed || !promoInput.trim()} onClick={handleRedeem}>
                    {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {isRedeemed ? "Already Redeemed This Cycle" : `Redeem ${formatCurrency(rewardAmount)}`}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="pt-4">
            <Card>
              <CardHeader>
                <CardTitle>Promo Reward History</CardTitle>
                <CardDescription>All redeemed daily promo rewards are listed here.</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingHistory ? (
                  <div className="flex h-40 items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : history.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Description</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead className="text-right">Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {history.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.description}</TableCell>
                          <TableCell className="font-semibold text-primary">{formatCurrency(item.amount)}</TableCell>
                          <TableCell className="text-right">{item.date?.seconds ? format(new Date(item.date.seconds * 1000), "PPp") : "N/A"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="p-8 text-center text-muted-foreground">No promo rewards have been redeemed yet.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
