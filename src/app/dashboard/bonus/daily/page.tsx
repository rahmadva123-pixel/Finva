"use client";

import Link from "next/link";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function DailyBonusPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold font-headline tracking-tight">Markets</h1>
          <p className="text-muted-foreground">The promo reward system has been removed. Explore markets and trading tools instead.</p>
        </div>

        <Card>
          <CardContent className="p-8 text-center">
            <p className="mb-4">Promo rewards are no longer available.</p>
            <Button asChild>
              <Link href="/markets">Open Markets</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
}
