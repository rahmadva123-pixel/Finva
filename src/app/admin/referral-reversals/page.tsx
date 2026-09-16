"use client";

import React, { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/layout/admin-layout';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy, doc, getDoc, runTransaction, serverTimestamp, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

export default function ReferralReversalsAdminPage() {
  const [reversals, setReversals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchReversals = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'referralReversals'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      const docs = await Promise.all(snap.docs.map(async d => ({ id: d.id, ...(d.data() as any) })));
      setReversals(docs);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Failed to load reversals', description: e.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReversals(); }, []);

  const processAdminReverse = async (rev: any) => {
    try {
      await runTransaction(db, async (tx) => {
        const revRef = doc(db, 'referralReversals', rev.id);
        const revSnap = await tx.get(revRef);
        if (!revSnap.exists()) throw new Error('Not found');
        const revData: any = revSnap.data();
        if (revData.status !== 'pending_admin') throw new Error('Not pending');

        const referrerRef = doc(db, 'users', revData.referrerId);
        const refSnap = await tx.get(referrerRef);
        if (!refSnap.exists()) throw new Error('Referrer not found');
        const balance = Number(refSnap.data()?.balance || 0);
        const amount = Number(revData.amount || 0);
        if (balance < amount) {
          tx.update(revRef, { status: 'admin_failed', adminHandledAt: serverTimestamp() });
          throw new Error('Insufficient funds');
        }

        tx.update(referrerRef, { balance: balance - amount, totalEarning: Math.max(0, Number(refSnap.data()?.totalEarning || 0) - amount) });
        // mark related commission docs reversed
        const refs = revData.refs || [];
        refs.forEach((r: any) => tx.update(r, { reversed: true, reversedAt: serverTimestamp(), reversedBy: 'admin' }));
        tx.update(revRef, { status: 'admin_reversed', adminHandledAt: serverTimestamp() });
      });
      toast({ title: 'Processed', description: 'Reversal processed.' });
      fetchReversals();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Failed', description: e.message || String(e) });
    }
  };

  const markResolved = async (rev: any) => {
    try {
      await updateDoc(doc(db, 'referralReversals', rev.id), { status: 'resolved', resolvedAt: serverTimestamp() });
      toast({ title: 'Marked resolved' });
      fetchReversals();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Failed', description: e.message });
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Referral Reversals</h1>
          <p className="text-muted-foreground">Review and resolve pending reversal requests.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Pending Reversals</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <div>Loading...</div> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Referrer</TableHead>
                    <TableHead>Referred</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reversals.map(r => (
                    <TableRow key={r.id}>
                      <TableCell>{r.referrerId}</TableCell>
                      <TableCell>{r.referredUserId}</TableCell>
                      <TableCell>{Number(r.amount || 0).toFixed(2)}</TableCell>
                      <TableCell>{r.status}</TableCell>
                      <TableCell>{r.createdAt?.seconds ? format(new Date(r.createdAt.seconds * 1000), 'PPP') : 'N/A'}</TableCell>
                      <TableCell className="flex gap-2">
                        {r.status === 'pending_admin' && <Button onClick={() => processAdminReverse(r)}>Auto Deduct</Button>}
                        {r.status !== 'resolved' && <Button variant="secondary" onClick={() => markResolved(r)}>Mark Resolved</Button>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
          <CardFooter>
            <Button onClick={fetchReversals}>Refresh</Button>
          </CardFooter>
        </Card>
      </div>
    </AdminLayout>
  );
}
