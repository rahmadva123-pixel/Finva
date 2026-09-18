import React from 'react';
import { TradingCard } from './trading-card';

export function FinancialStatCard({ title, value, hint }: { title: string; value: string; hint?: string }) {
  return (
    <TradingCard className="flex flex-col gap-1">
      <div className="text-sm text-muted-foreground">{title}</div>
      <div className="text-2xl font-semibold text-card-foreground">{value}</div>
      {hint ? <div className="text-xs text-muted-foreground">{hint}</div> : null}
    </TradingCard>
  );
}

export default FinancialStatCard;
