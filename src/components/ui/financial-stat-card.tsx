import React from 'react';
import { TradingCard } from './trading-card';

export function FinancialStatCard({ title, value, hint }: { title: string; value: string; hint?: string }) {
  return (
    <TradingCard className="flex flex-col gap-2 sm:gap-1">
      <div className="text-sm text-muted-foreground truncate">{title}</div>
      <div className="text-lg sm:text-2xl font-semibold text-card-foreground break-words">{value}</div>
      {hint ? <div className="text-xs text-muted-foreground truncate">{hint}</div> : null}
    </TradingCard>
  );
}

export default FinancialStatCard;
