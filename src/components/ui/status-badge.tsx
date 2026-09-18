import React from 'react';

export function StatusBadge({ children, variant = 'default' }: { children: React.ReactNode; variant?: 'default' | 'success' | 'danger' | 'warning' }) {
  const base = 'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium';
  const cls =
    variant === 'success'
      ? `${base} bg-success/10 text-success`
      : variant === 'danger'
      ? `${base} bg-destructive/10 text-destructive`
      : variant === 'warning'
      ? `${base} bg-warning/10 text-warning`
      : `${base} bg-muted/30 text-muted-foreground`;
  return <span className={cls as string}>{children}</span>;
}

export default StatusBadge;
