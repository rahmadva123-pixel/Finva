"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

export default function ConfirmEmailChangeClient({ token: initialToken }: { token?: string }) {
  const router = useRouter();
  const token = initialToken;
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!token) setStatus('missing');
  }, [token]);

  const handleConfirm = async () => {
    if (!token) return setStatus('missing');
    setLoading(true);
    try {
      const res = await fetch('/api/email-change/confirm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || 'Confirm failed');
      setStatus('success');
    } catch (e: any) {
      setStatus(e.message || 'failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="max-w-xl w-full">
        <CardHeader>
          <CardTitle>Email Change Confirmation</CardTitle>
        </CardHeader>
        <CardContent>
          {status === 'missing' && <p className="text-sm text-muted-foreground">No token provided.</p>}
          {status === 'success' && <p className="text-sm text-green-600">Your email has been updated successfully.</p>}
          {status && status !== 'missing' && status !== 'success' && <p className="text-sm text-red-600">{status}</p>}
          {!status && (
            <div className="space-y-4">
              <p className="text-sm">Click confirm to complete email change.</p>
              <div className="flex gap-2">
                <Button onClick={handleConfirm} disabled={loading}>{loading ? <Loader2 className="h-4 w-4 animate-spin"/> : 'Confirm'}</Button>
                <Button variant="ghost" onClick={() => router.push('/dashboard/profile')}>Cancel</Button>
              </div>
            </div>
          )}
          {status === 'success' && (
            <div className="mt-4">
              <Button onClick={() => router.push('/dashboard/profile')}>Return to Profile</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
