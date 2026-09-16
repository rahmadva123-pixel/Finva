
"use client";

import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, orderBy, or } from "firebase/firestore";
import { useEffect, useState } from "react";
import { Loader2, ArrowUp, ArrowDown } from "lucide-react";
import { format } from "date-fns";

interface Transaction {
    id: string;
    amount: number;
    currencySymbol: string;
    fromWalletId: string;
    toWalletId: string;
    fromUserId: string;
    toUserId: string;
    date: any;
}

export default function DigitalWalletHistoryPage() {
    const { user } = useAuth();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
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
                    collection(db, "digitalWalletTransactions"),
                    or(where("fromUserId", "==", user.uid), where("toUserId", "==", user.uid)),
                    orderBy("date", "desc")
                );
                const querySnapshot = await getDocs(q);
                const historyData = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Transaction));
                setTransactions(historyData);
            } catch (error) {
                console.error("Error fetching transaction history:", error);
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
                    <h1 className="text-3xl font-bold font-headline">Transaction History</h1>
                    <p className="text-muted-foreground">A record of your digital wallet transactions.</p>
                </div>
                <Card>
                    <CardHeader>
                        <CardTitle>All Transactions</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="flex justify-center items-center h-48"><Loader2 className="h-8 w-8 animate-spin"/></div>
                        ) : transactions.length === 0 ? (
                            <p className="text-center text-muted-foreground py-8">No transactions yet.</p>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Type</TableHead>
                                        <TableHead>Amount</TableHead>
                                        <TableHead>From/To</TableHead>
                                        <TableHead>Date</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {transactions.map(tx => {
                                        const isSent = tx.fromUserId === user?.uid;
                                        return (
                                            <TableRow key={tx.id}>
                                                <TableCell>
                                                    {isSent ? (
                                                        <div className="flex items-center gap-2 text-red-500"><ArrowUp className="h-4 w-4"/> Sent</div>
                                                    ) : (
                                                        <div className="flex items-center gap-2 text-green-500"><ArrowDown className="h-4 w-4"/> Received</div>
                                                    )}
                                                </TableCell>
                                                <TableCell className={`font-semibold ${isSent ? 'text-red-500' : 'text-green-500'}`}>
                                                    {isSent ? '-' : '+'} {tx.amount.toLocaleString()} {tx.currencySymbol}
                                                </TableCell>
                                                <TableCell className="font-mono text-xs">
                                                    {isSent ? `To: ${tx.toWalletId.slice(0, 10)}...` : `From: ${tx.fromWalletId.slice(0,10)}...`}
                                                </TableCell>
                                                <TableCell>{format(tx.date.toDate(), 'PPp')}</TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    );
}

