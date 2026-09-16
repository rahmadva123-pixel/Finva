
"use client";

import React, { useState, useEffect } from 'react';
import { AdminLayout } from "@/components/layout/admin-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from '@/lib/firebase';
import { collection, query, getDocs, doc, getDoc, orderBy } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';

interface UserStake {
    id: string;
    userId: string;
    userEmail?: string;
    planName: string;
    amount: number;
    status: 'active' | 'completed';
    startDate: any;
    endDate: any;
}

interface CurrencySettings {
  symbol: string;
  position: 'left' | 'right';
}

export default function AdminStakingHistoryPage() {
    const [stakes, setStakes] = useState<UserStake[]>([]);
    const [loading, setLoading] = useState(true);
    const [currency, setCurrency] = useState<CurrencySettings>({ symbol: '$', position: 'left' });
    const { toast } = useToast();

    useEffect(() => {
        const fetchHistory = async () => {
            if (!db) {
                setLoading(false);
                return;
            }
            try {
                const currencyDoc = await getDoc(doc(db, "settings", "currency"));
                if (currencyDoc.exists()) {
                  setCurrency(currencyDoc.data() as CurrencySettings);
                }

                const q = query(collection(db, "userStakes"), orderBy("startDate", "desc"));
                const querySnapshot = await getDocs(q);
                const stakesData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as UserStake[];

                const stakesWithUsers = await Promise.all(stakesData.map(async (stake) => {
                    const userDoc = await getDoc(doc(db, "users", stake.userId));
                    return { ...stake, userEmail: userDoc.exists() ? userDoc.data().email : 'Unknown User' };
                }));

                setStakes(stakesWithUsers);
            } catch (error: any) {
                toast({ variant: 'destructive', title: 'Error fetching history', description: error.message });
            } finally {
                setLoading(false);
            }
        };
        fetchHistory();
    }, [toast]);
    
    const formatCurrency = (amount: number) => {
        const value = amount.toFixed(2);
        return currency.position === 'left' ? `${currency.symbol}${value}` : `${value}${currency.symbol}`;
    }

  return (
    <AdminLayout>
      <div className="flex flex-col gap-8">
        <div>
          <h1 className="text-3xl font-bold font-headline tracking-tight">Staking History</h1>
          <p className="text-muted-foreground">View a complete history of all user stakes.</p>
        </div>
         <Card>
            <CardHeader>
                <CardTitle>All Stakes</CardTitle>
                <CardDescription>
                   A log of every stake made on the platform.
                </CardDescription>
            </CardHeader>
            <CardContent>
                 {loading ? (
                    <div className="flex justify-center items-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
                 ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>User</TableHead>
                                <TableHead>Plan</TableHead>
                                <TableHead>Amount</TableHead>
                                <TableHead>Start Date</TableHead>
                                <TableHead>End Date</TableHead>
                                <TableHead className="text-right">Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {stakes.map(stake => (
                                <TableRow key={stake.id}>
                                    <TableCell className="font-medium">{stake.userEmail}</TableCell>
                                    <TableCell>{stake.planName}</TableCell>
                                    <TableCell>{formatCurrency(stake.amount)}</TableCell>
                                    <TableCell>{format(new Date(stake.startDate.seconds * 1000), "PPp")}</TableCell>
                                    <TableCell>{format(new Date(stake.endDate.seconds * 1000), "PPp")}</TableCell>
                                    <TableCell className="text-right">
                                        <Badge variant={stake.status === 'active' ? 'default' : 'secondary'} className="capitalize">
                                            {stake.status}
                                        </Badge>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                 )}
            </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
