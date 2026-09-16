
"use client";

import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { useEffect, useState } from "react";
import { Loader2, Repeat } from "lucide-react";
import { format } from "date-fns";

interface SwapTransaction {
    id: string;
    fromCurrency: string;
    toCurrency: string;
    fromAmount: number;
    toAmount: number;
    fee: number;
    rate: number;
    date: any;
}

export default function SwapHistoryPage() {
    const { user } = useAuth();
    const [transactions, setTransactions] = useState<SwapTransaction[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user || !db) {
            setLoading(false);
            return;
        }

        const fetchHistory = async () => {
            setLoading(true);
            try {
                const q = query(
                    collection(db, "swapTransactions"),
                    where("userId", "==", user.uid),
                    orderBy("date", "desc")
                );
                const querySnapshot = await getDocs(q);
                const historyData = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() } as SwapTransaction));
                setTransactions(historyData);
            } catch (error) {
                console.error("Error fetching swap history:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchHistory();
    }, [user]);

    return (
        <DashboardLayout>
            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold font-headline">Swap History</h1>
                    <p className="text-muted-foreground">A record of your past currency exchanges.</p>
                </div>
                <Card>
                    <CardHeader>
                        <CardTitle>All Swaps</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="flex justify-center items-center h-48"><Loader2 className="h-8 w-8 animate-spin"/></div>
                        ) : transactions.length === 0 ? (
                            <p className="text-center text-muted-foreground py-8">No swap transactions yet.</p>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Transaction</TableHead>
                                        <TableHead>Amount Sent</TableHead>
                                        <TableHead>Amount Received</TableHead>
                                        <TableHead>Date</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {transactions.map(tx => (
                                        <TableRow key={tx.id}>
                                            <TableCell>
                                                <div className="flex items-center gap-2 font-semibold">
                                                   <span>{tx.fromCurrency}</span>
                                                   <Repeat className="h-4 w-4 text-primary" />
                                                   <span>{tx.toCurrency}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="font-mono">{tx.fromAmount.toFixed(4)} {tx.fromCurrency}</TableCell>
                                            <TableCell className="font-mono text-primary">{tx.toAmount.toFixed(4)} {tx.toCurrency}</TableCell>
                                            <TableCell>{format(tx.date.toDate(), 'PPp')}</TableCell>
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
