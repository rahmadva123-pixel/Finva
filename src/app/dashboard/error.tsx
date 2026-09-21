"use client";

import { useEffect } from "react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard client error:", error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-8 text-foreground">
      <section className="w-full max-w-md rounded-2xl border border-destructive/30 bg-card p-6 shadow-xl">
        <p className="text-sm font-medium text-destructive">Dashboard could not load</p>
        <h1 className="mt-2 text-xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Please reload the dashboard. If the problem continues, share the error details below.
        </p>
        <pre className="mt-4 max-h-40 overflow-auto rounded-lg bg-muted p-3 text-xs text-muted-foreground">
          {error.message || "Unknown dashboard error"}
        </pre>
        {error.digest && <p className="mt-2 text-xs text-muted-foreground">Reference: {error.digest}</p>}
        <button
          type="button"
          onClick={() => reset()}
          className="mt-5 min-h-11 w-full rounded-xl bg-primary px-4 py-2 font-medium text-primary-foreground hover:bg-primary/90"
        >
          Reload dashboard
        </button>
      </section>
    </main>
  );
}
