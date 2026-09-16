"use client";

import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { db, auth } from '@/lib/firebase';
import { collection, getDocs, query, where, orderBy, doc, runTransaction, serverTimestamp, addDoc } from 'firebase/firestore';
import { useAuth } from '@/hooks/use-auth';
import { Loader2 } from 'lucide-react';
import { format } from 'date-fns';

export default function RefreshmentBonusPage() {
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [bonuses, setBonuses] = useState<any[]>([]);

  useEffect(() => {
    const fetch = async () => {
      if (!db || !user) return setLoading(false);
      setLoading(true);
      try {
        const q = query(collection(db, 'refreshmentBonuses'), where('userId', '==', user.uid), orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        setBonuses(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
      } catch (e) {
        console.warn('Failed to load refreshment bonuses', e);
      } finally {
        setLoading(false);
      }
    };

    if (!authLoading) fetch();
  }, [user, authLoading]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Refreshment Bonus</h1>
          <p className="text-muted-foreground">Your refreshment bonuses and history.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>History</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center p-8"><Loader2 className="h-6 w-6 animate-spin"/></div>
            ) : bonuses.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground">No refreshment bonuses yet.</div>
            ) : (
              <div className="space-y-3">
                {bonuses.map(b => (
                  <div key={b.id} className="flex justify-between p-3 bg-background rounded-md">
                    <div>
                      <div className="font-medium">{b.title || 'Refreshment Bonus'}</div>
                      <div className="text-xs text-muted-foreground">{b.description || ''}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">${Number(b.amount || 0).toFixed(2)}</div>
                      <div className="text-xs text-muted-foreground">{b.createdAt?.seconds ? format(new Date(b.createdAt.seconds * 1000), 'PPP') : 'N/A'}</div>
                      {!b.claimed && b.status === 'claimable' ? (
                        <div className="mt-2">
                          <button
                            className="px-3 py-1 rounded bg-primary text-white text-sm"
                            onClick={async () => {
                              try {
                                setLoading(true);
                                const token = await auth.currentUser?.getIdToken();
                                if (!token) throw new Error('Not authenticated');
                                const res = await fetch('/api/refreshment/claim', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                                  body: JSON.stringify({ id: b.id })
                                });
                                const json = await res.json();
                                if (!res.ok) throw new Error(json?.error || 'Claim failed');
                                // refresh list
                                const q = query(collection(db, 'refreshmentBonuses'), where('userId', '==', auth.currentUser?.uid), orderBy('createdAt', 'desc'));
                                const snap = await getDocs(q);
                                setBonuses(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
                                setLoading(false);
                              } catch (err: any) {
                                console.warn('Claim failed', err);
                                setLoading(false);
                              }
                            }}
                          >
                            Claim $50
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
