
"use client";

import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from 'date-fns';

interface BonusTransaction {
    id: string;
    amount: number;
    date: any;
    description: string;
    type: 'signup' | 'daily' | 'task' | 'promo' | 'interest';
}

interface CurrencySettings {
  symbol: string;
  position: 'left' | 'right';
}

export default function BonusHistoryPage() {
    const { user } = useAuth();
    const [transactions, setTransactions] = useState<BonusTransaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [currency, setCurrency] = useState<CurrencySettings>({ symbol: '$', position: 'left' });

    useEffect(() => {
        if (!db || !user) {
            setLoading(false);
            return;
        }

        const fetchHistory = async () => {
            setLoading(true);
            try {
                const currencyDoc = await getDoc(doc(db, "settings", "currency"));
                if (currencyDoc.exists()) {
                    setCurrency(currencyDoc.data() as CurrencySettings);
                }

                const q = query(collection(db, "bonusTransactions"), where("userId", "==", user.uid));
                const querySnapshot = await getDocs(q);
                const historyData = querySnapshot.docs
                    .map(doc => ({ id: doc.id, ...doc.data() } as BonusTransaction))
                    .sort((a,b) => b.date.seconds - a.date.seconds);

                setTransactions(historyData);
            } catch (error) {
                console.error("Error fetching bonus history:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchHistory();
    }, [user]);

    const formatCurrency = (amount: number) => {
        const value = amount.toFixed(2);
        return currency.position === 'left' ? `${currency.symbol}${value}` : `${value}${currency.symbol}`;
    }

    const getTypeBadge = (type: BonusTransaction['type']) => {
        switch(type) {
            case 'signup': return <Badge variant="secondary">Signup</Badge>
            case 'daily': return <Badge variant="default">Daily</Badge>
            case 'task': return <Badge variant="outline">Task</Badge>
            case 'promo': return <Badge className="bg-primary/10 text-primary hover:bg-primary/10">Promo</Badge>
            case 'interest': return <Badge variant="outline">Interest</Badge>
            default: return <Badge>{type}</Badge>
        }
    }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
            <h1 className="text-3xl font-bold font-headline tracking-tight">Bonus History</h1>
            <p className="text-muted-foreground">A complete log of all signup, promo, task, and other bonus rewards.</p>
        </div>
        <Card>
            <CardHeader>
                <CardTitle>All Bonuses</CardTitle>
                <CardDescription>
                   Your signup, promo, task, and daily bonuses are listed here.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="flex justify-center items-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
                ) : transactions.length > 0 ? (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Description</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Amount</TableHead>
                                <TableHead className="text-right">Date</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {transactions.map(tx => (
                                <TableRow key={tx.id}>
                                    <TableCell className="font-medium">{tx.description}</TableCell>
                                    <TableCell>{getTypeBadge(tx.type)}</TableCell>
                                    <TableCell className="font-semibold text-primary">{formatCurrency(tx.amount)}</TableCell>
                                    <TableCell className="text-right">{format(new Date(tx.date.seconds * 1000), 'PPp')}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                ) : (
                    <p className="text-center text-muted-foreground p-8">You haven't received any bonuses yet.</p>
                )}
            </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
