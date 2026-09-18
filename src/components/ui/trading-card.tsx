import React from 'react';
import { cn } from '@/lib/utils';

export function TradingCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-lg bg-card border border-border p-4 shadow-sm', className)}>
      {children}
    </div>
  );
}

export default TradingCard;
