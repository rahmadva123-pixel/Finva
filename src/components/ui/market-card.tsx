import React from 'react';
import { TradingCard } from './trading-card';

export function MarketCard({ symbol, name, price, change }: { symbol: string; name?: string; price: string; change?: number | string }) {
  const positive = typeof change === 'number' ? change >= 0 : String(change).startsWith('+');
  return (
    <TradingCard className="flex items-center justify-between gap-4">
      <div className="flex flex-col">
        <div className="text-sm font-semibold">{symbol}</div>
        {name && <div className="text-xs text-muted-foreground">{name}</div>}
      </div>
      <div className="text-right">
        <div className="text-sm font-semibold">{price}</div>
        {change !== undefined && (
          <div className={`text-xs font-medium ${positive ? 'text-success' : 'text-destructive'}`}>
            {typeof change === 'number' ? `${change.toFixed(2)}%` : change}
          </div>
        )}
      </div>
    </TradingCard>
  );
}

export default MarketCard;
