"use client";

import dynamic from 'next/dynamic';
import React, { useState } from 'react';
import { doc, getDoc, onSnapshot, collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { TradingCard } from '@/components/ui/trading-card';
import { MarketCard } from '@/components/ui/market-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { auth, db } from '@/lib/firebase';

const CandlestickChart = dynamic(() => import('@/components/charts/CandlestickChart'), { ssr: false });

export default function TradePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [symbol, setSymbol] = useState('BTC/USDT');
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [amount, setAmount] = useState('');
  const [price, setPrice] = useState('');
  const [pendingEarnings, setPendingEarnings] = useState(0);
  const [dailyRate, setDailyRate] = useState<number | null>(null);
  const [minClaimAmount, setMinClaimAmount] = useState(1);
  const [claimCooldownHours, setClaimCooldownHours] = useState(24);
  const [lastClaimedAt, setLastClaimedAt] = useState<number | null>(null);
  const [cooldownRemainingMs, setCooldownRemainingMs] = useState(0);
  const [claiming, setClaiming] = useState(false);

  React.useEffect(() => {
    if (!user || !db) return;
    const firestore = db;

    const unsubscribe = onSnapshot(doc(firestore, 'users', user.uid), (snapshot) => {
      const data = snapshot.data();
      setPendingEarnings(Number(data?.pendingEarnings || 0));
      const claimedAt = data?.lastClaimedAt;
      if (claimedAt?.toDate) setLastClaimedAt(claimedAt.toDate().getTime());
      else if (claimedAt) setLastClaimedAt(new Date(claimedAt).getTime());
    });

    void getDoc(doc(firestore, 'settings', 'dailyEarnings')).then((snapshot) => {
      if (!snapshot.exists()) return;
      const settings = snapshot.data();
      setMinClaimAmount(Number(settings.minClaimAmount || 1));
      setClaimCooldownHours(Number(settings.claimCooldownHours || 24));
    }).catch(() => undefined);

    const loadLatestRate = async () => {
      const earningsQuery = query(
        collection(firestore, 'earningTransactions'),
        where('userId', '==', user.uid),
        where('type', '==', 'dailyEarning'),
        orderBy('date', 'desc'),
        limit(1),
      );
      const snapshot = await getDocs(earningsQuery);
      if (!snapshot.empty) {
        const latest = snapshot.docs[0].data();
        setDailyRate(Number(latest.rate || 0));
      }
    };

    void loadLatestRate().catch(() => setDailyRate(null));
    return () => unsubscribe();
  }, [user]);

  React.useEffect(() => {
    const updateCooldown = () => {
      if (!lastClaimedAt) {
        setCooldownRemainingMs(0);
        return;
      }
      const cooldownMs = claimCooldownHours * 60 * 60 * 1000;
      setCooldownRemainingMs(Math.max(0, cooldownMs - (Date.now() - lastClaimedAt)));
    };

    updateCooldown();
    const timer = window.setInterval(updateCooldown, 1000);
    return () => window.clearInterval(timer);
  }, [lastClaimedAt, claimCooldownHours]);

  const canClaim = pendingEarnings >= minClaimAmount && cooldownRemainingMs === 0;
  const formatCooldown = (remainingMs: number) => {
    const totalSeconds = Math.ceil(remainingMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleClaim = async () => {
    if (!auth?.currentUser || !canClaim || claiming) return;
    setClaiming(true);
    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch('/api/earnings/claim', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error || 'Claim failed');
      setLastClaimedAt(Date.now());
      toast({ title: 'Earnings claimed', description: 'Your pending earnings were added to your balance.' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Claim failed', description: error?.message || 'Please try again.' });
    } finally {
      setClaiming(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            <TradingCard>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-muted-foreground">{symbol}</div>
                  <div className="text-xl font-bold">$27,500 <span className="text-sm text-success">+2.4%</span></div>
                </div>
                <div className="flex items-center gap-2">
                  <Select onValueChange={(v) => setSymbol(v)}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder={symbol} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BTC/USDT">BTC/USDT</SelectItem>
                      <SelectItem value="ETH/USDT">ETH/USDT</SelectItem>
                      <SelectItem value="SOL/USDT">SOL/USDT</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="mt-4 w-full rounded-md">
                <CandlestickChart symbol={symbol.replace('/', '').toLowerCase()} interval="1m" />
              </div>
            </TradingCard>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TradingCard>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Order Form</h3>
                  <div className="text-xs text-muted-foreground">Market / Limit</div>
                </div>
                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Button variant={side === 'buy' ? 'default' : 'outline'} onClick={() => setSide('buy')}>Buy</Button>
                    <Button variant={side === 'sell' ? 'default' : 'outline'} onClick={() => setSide('sell')}>Sell</Button>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Amount</label>
                    <Input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Price</label>
                    <Input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Market" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Button className="flex-1" variant="default">Place {side === 'buy' ? 'Buy' : 'Sell'} Order</Button>
                    <Button variant="ghost">Reset</Button>
                  </div>
                </div>
              </TradingCard>

              <TradingCard>
                <h3 className="text-sm font-semibold">Order Book</h3>
                <div className="mt-3 space-y-2">
                  <div className="flex justify-between text-xs text-muted-foreground"><span>Price</span><span>Amount</span><span>Total</span></div>
                  <div className="h-40 overflow-y-auto">
                    <div className="py-2 text-sm">No live order book available (visual placeholder)</div>
                  </div>
                </div>
              </TradingCard>
            </div>
          </div>

          <div className="space-y-4">
            <TradingCard>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold">Daily Earnings</h3>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold">${pendingEarnings.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">
                    {dailyRate === null ? 'Rate unavailable' : `${(dailyRate * 100).toFixed(2)}% daily`}
                  </p>
                </div>
              </div>
              <Button className="mt-4 w-full" onClick={handleClaim} disabled={!canClaim || claiming}>
                {claiming ? 'Claiming...' : cooldownRemainingMs > 0 ? (
                  <>Claim Earnings <span className="ml-2 text-xs opacity-60">{formatCooldown(cooldownRemainingMs)}</span></>
                ) : canClaim ? 'Claim Earnings' : 'No earnings available yet'}
              </Button>
            </TradingCard>

            <TradingCard>
              <h3 className="text-sm font-semibold">Recent Trades</h3>
                  <div className="mt-3 space-y-2 h-64 overflow-y-auto text-sm text-muted-foreground">No recent trades</div>
            </TradingCard>

            <TradingCard>
              <h3 className="text-sm font-semibold">Markets</h3>
              <div className="mt-3 grid gap-2">
                <MarketCard symbol="BTC/USDT" price="$27,500" change={2.4} />
                <MarketCard symbol="ETH/USDT" price="$1,800" change={-1.2} />
                <MarketCard symbol="SOL/USDT" price="$30.12" change={0.8} />
              </div>
            </TradingCard>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
