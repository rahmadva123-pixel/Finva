
"use client";

import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, getDoc, orderBy } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

interface Transaction {
    id: string;
    amount: number;
    date: any;
    type: 'Invested' | 'Profit Return (Auto)' | 'Profit Return (Manual)' | 'Capital Back (Auto)' | 'Capital Back (Manual)';
    planName: string;
}

interface CurrencySettings {
  symbol: string;
  position: 'left' | 'right';
}

export default function TransactionHistoryPage() {
    const { user } = useAuth();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [currency, setCurrency] = useState<CurrencySettings>({ symbol: '$', position: 'left' });

    useEffect(() => {
        if (!user || !db) {
            setLoading(false);
            return;
        }

        const fetchTransactions = async () => {
            setLoading(true);
            try {
                // Fetch Currency
                const currencyDoc = await getDoc(doc(db, "settings", "currency"));
                if (currencyDoc.exists()) {
                    setCurrency(currencyDoc.data() as CurrencySettings);
                }

                const allTransactions: Transaction[] = [];

                // Fetch initial investments from userInvestments
                const investmentsQuery = query(collection(db, "userInvestments"), where("userId", "==", user.uid));
                const investmentsSnapshot = await getDocs(investmentsQuery);
                investmentsSnapshot.forEach(doc => {
                    const data = doc.data();
                    allTransactions.push({
                        id: doc.id,
                        amount: data.amount,
                        date: data.startDate,
                        type: 'Invested',
                        planName: data.planName,
                    });
                });
                
                // Fetch returns and capital backs from investmentTransactions
                const transactionLogQuery = query(collection(db, "investmentTransactions"), where("userId", "==", user.uid));
                const transactionLogSnapshot = await getDocs(transactionLogQuery);
                transactionLogSnapshot.forEach(doc => {
                    const data = doc.data();
                    allTransactions.push({
                        id: doc.id,
                        amount: data.amount,
                        date: data.date,
                        type: data.type,
                        planName: data.planName,
                    });
                });

                // Sort all transactions by date
                allTransactions.sort((a, b) => b.date.seconds - a.date.seconds);

                setTransactions(allTransactions);

            } catch (error) {
                console.error("Error fetching transaction history: ", error);
            } finally {
                setLoading(false);
            }
        };

        fetchTransactions();

    }, [user]);
    
    const formatCurrency = (amount: number) => {
        const value = amount.toFixed(2);
        return currency.position === 'left' ? `${currency.symbol}${value}` : `${value}${currency.symbol}`;
    }
    
    const getTypeBadge = (type: Transaction['type']) => {
        if (type.includes('Invested')) {
            return <Badge variant="destructive">Invested</Badge>;
        }
        if (type.includes('Profit')) {
            return <Badge variant="default">Return</Badge>;
        }
        if (type.includes('Capital')) {
             return <Badge variant="secondary">Capital Back</Badge>;
        }
        return <Badge variant="outline">{type}</Badge>;
    }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
            <h1 className="text-3xl font-bold font-headline tracking-tight">Investment Transactions</h1>
            <p className="text-muted-foreground">A complete history of your investment returns and invested capital.</p>
        </div>
        <Card>
            <CardHeader>
                <CardTitle>Transaction Log</CardTitle>
                <CardDescription>
                   All investment-related transactions are listed here.
                </CardDescription>
            </CardHeader>
            <CardContent>
                 {loading ? (
                    <div className="flex justify-center items-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
                 ) : transactions.length === 0 ? (
                     <p className="text-center text-muted-foreground p-8">Your transaction history is empty.</p>
                 ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Plan</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Amount</TableHead>
                                <TableHead className="text-right">Date</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {transactions.map((t) => (
                                <TableRow key={t.id}>
                                    <TableCell className="font-medium">{t.planName}</TableCell>
                                    <TableCell>{getTypeBadge(t.type)}</TableCell>
                                    <TableCell className="font-semibold">{formatCurrency(t.amount)}</TableCell>
                                    <TableCell className="text-right">{format(new Date(t.date.seconds * 1000), "PPp")}</TableCell>
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
