"use client";

import Link from "next/link";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function MarketsPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold font-headline tracking-tight">Markets</h1>
          <p className="text-muted-foreground">Overview of market tickers. This is a trading-style placeholder page.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>BTC/USDT</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">$27,500</div>
              <div className="text-sm text-emerald-500">+2.4%</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>ETH/USDT</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">$1,800</div>
              <div className="text-sm text-red-500">-1.2%</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>SOL/USDT</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">$30.12</div>
              <div className="text-sm text-emerald-500">+0.8%</div>
            </CardContent>
          </Card>
        </div>

        <div>
          <Button asChild>
            <Link href="/trade">Open Trade</Link>
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
