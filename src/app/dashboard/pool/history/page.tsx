
"use client";

import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";

interface PoolHistory {
    id: string;
    amount: number;
    poolName: string;
    returnAmount: number;
    investedAt: any;
}

interface CurrencySettings {
  symbol: string;
  position: 'left' | 'right';
}

export default function PoolHistoryPage() {
    const { user } = useAuth();
    const [history, setHistory] = useState<PoolHistory[]>([]);
    const [loading, setLoading] = useState(true);
    const [currency, setCurrency] = useState<CurrencySettings>({ symbol: '$', position: 'left' });

    useEffect(() => {
        if (!db || !user) {
            setLoading(false);
            return;
        }

        const fetchHistory = async () => {
            try {
                const currencyDoc = await getDoc(doc(db, "settings", "currency"));
                if (currencyDoc.exists()) {
                    setCurrency(currencyDoc.data() as CurrencySettings);
                }

                const q = query(
                    collection(db, "userPoolInvestments"), 
                    where("userId", "==", user.uid),
                    where("status", "==", "completed")
                );
                const querySnapshot = await getDocs(q);
                const historyData = querySnapshot.docs.map(doc => {
                    const data = doc.data();
                    return {
                        id: doc.id,
                        ...data,
                        returnAmount: data.returnAmount || 0
                    } as PoolHistory;
                }).sort((a,b) => b.investedAt.seconds - a.investedAt.seconds);

                setHistory(historyData);
            } catch (error) {
                console.error("Error fetching pool history:", error);
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

    return (
        <DashboardLayout>
            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold font-headline tracking-tight">Pool History</h1>
                    <p className="text-muted-foreground">A record of your returns from completed pools.</p>
                </div>
                <Card>
                    <CardHeader>
                        <CardTitle>Return History</CardTitle>
                        <CardDescription>
                           Your returns from past pools will be listed here.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                         {loading ? (
                            <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
                        ) : history.length === 0 ? (
                            <p className="text-center text-muted-foreground p-8">You have no completed pool investments.</p>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Pool Name</TableHead>
                                        <TableHead>Invested Amount</TableHead>
                                        <TableHead>Total Return</TableHead>
                                        <TableHead>Invested On</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {history.map((item) => (
                                        <TableRow key={item.id}>
                                            <TableCell className="font-medium">{item.poolName}</TableCell>
                                            <TableCell>{formatCurrency(item.amount)}</TableCell>
                                            <TableCell className="font-semibold text-primary">{formatCurrency(item.returnAmount)}</TableCell>
                                            <TableCell>{format(new Date(item.investedAt.seconds * 1000), "PPp")}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    );
}
