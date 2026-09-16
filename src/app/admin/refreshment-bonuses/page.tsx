"use client";

import React, { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/layout/admin-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';

export default function AdminRefreshmentBonusesPage() {
  const [bonuses, setBonuses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'refreshmentBonuses'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      setBonuses(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
    } catch (e) {
      console.warn('Failed to load refreshment bonuses', e);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetch(); }, []);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Refreshment Bonuses</h1>
          <p className="text-muted-foreground">All refreshment bonus history.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>History</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <div className="p-8 flex justify-center"><Loader2 className="animate-spin"/></div> : (
              <div className="space-y-2">
                {bonuses.map(b => (
                  <div key={b.id} className="flex justify-between p-3 bg-background rounded-md">
                    <div>
                      <div className="font-medium">{b.title || 'Refreshment Bonus'}</div>
                      <div className="text-xs text-muted-foreground">User: {b.userId}</div>
                      <div className="text-xs text-muted-foreground">{b.description || ''}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">${Number(b.amount || 0).toFixed(2)}</div>
                      <div className="text-xs text-muted-foreground">{b.createdAt?.seconds ? format(new Date(b.createdAt.seconds * 1000), 'PPP') : 'N/A'}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
