"use client";

import React, { useState } from 'react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { TradingCard } from '@/components/ui/trading-card';
import { MarketCard } from '@/components/ui/market-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';

export default function TradePage() {
  const [symbol, setSymbol] = useState('BTC/USDT');
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [amount, setAmount] = useState('');
  const [price, setPrice] = useState('');

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
              <div className="mt-4 h-64 w-full rounded-md bg-muted/30 flex items-center justify-center text-muted-foreground">Chart placeholder</div>
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
              <h3 className="text-sm font-semibold">Recent Trades</h3>
              <div className="mt-3 space-y-2 h-64 overflow-y-auto text-sm text-muted-foreground">No recent trades (placeholder)</div>
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
