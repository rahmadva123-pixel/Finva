"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ReferralSettingsPage() {
  return (
    <div className="p-6">
      <Card>
        <CardHeader>
          <CardTitle>Referral Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Referral tracking and rewards are active. Withdrawals are available without referral requirements.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
