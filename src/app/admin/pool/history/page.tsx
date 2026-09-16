
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

interface UserPoolInvestment {
    id: string;
    userId: string;
    userEmail?: string;
    poolName: string;
    amount: number;
    status: 'active' | 'completed';
    investedAt: any;
}

interface CurrencySettings {
  symbol: string;
  position: 'left' | 'right';
}

export default function AdminPoolHistoryPage() {
    const [investments, setInvestments] = useState<UserPoolInvestment[]>([]);
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

                const q = query(collection(db, "userPoolInvestments"), orderBy("investedAt", "desc"));
                const querySnapshot = await getDocs(q);
                const investmentsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as UserPoolInvestment[];

                const investmentsWithUsers = await Promise.all(investmentsData.map(async (investment) => {
                    const userDoc = await getDoc(doc(db, "users", investment.userId));
                    return { ...investment, userEmail: userDoc.exists() ? userDoc.data().email : 'Unknown User' };
                }));

                setInvestments(investmentsWithUsers);
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
          <h1 className="text-3xl font-bold font-headline tracking-tight">Pool Investment History</h1>
          <p className="text-muted-foreground">View a complete history of all user investments in pools.</p>
        </div>
         <Card>
            <CardHeader>
                <CardTitle>All Pool Investments</CardTitle>
                <CardDescription>
                   A log of every pool investment made on the platform.
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
                                <TableHead>Pool</TableHead>
                                <TableHead>Amount</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead className="text-right">Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {investments.map(inv => (
                                <TableRow key={inv.id}>
                                    <TableCell className="font-medium">{inv.userEmail}</TableCell>
                                    <TableCell>{inv.poolName}</TableCell>
                                    <TableCell>{formatCurrency(inv.amount)}</TableCell>
                                    <TableCell>{format(new Date(inv.investedAt.seconds * 1000), "PPp")}</TableCell>
                                    <TableCell className="text-right">
                                        <Badge variant={inv.status === 'active' ? 'default' : 'secondary'} className="capitalize">
                                            {inv.status}
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
