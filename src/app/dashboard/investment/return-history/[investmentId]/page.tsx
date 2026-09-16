
"use client";

import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

interface Return {
    id: string;
    amount: number;
    date: any;
    investmentId: string;
    userId: string;
}

interface CurrencySettings {
  symbol: string;
  position: 'left' | 'right';
}

export default function InvestmentReturnHistoryPage() {
    const { user } = useAuth();
    const params = useParams();
    const router = useRouter();
    const investmentId = params.investmentId as string;

    const [returns, setReturns] = useState<Return[]>([]);
    const [loading, setLoading] = useState(true);
    const [currency, setCurrency] = useState<CurrencySettings>({ symbol: '$', position: 'left' });
    const [planName, setPlanName] = useState('');

    useEffect(() => {
        if (!db || !user || !investmentId) {
            setLoading(false);
            return;
        }

        const fetchHistory = async () => {
            try {
                // Fetch currency settings
                const currencyDoc = await getDoc(doc(db, "settings", "currency"));
                if (currencyDoc.exists()) {
                    setCurrency(currencyDoc.data() as CurrencySettings);
                }
                
                // Fetch investment details to get plan name
                const investmentDoc = await getDoc(doc(db, "userInvestments", investmentId));
                if (investmentDoc.exists() && investmentDoc.data()?.userId === user.uid) {
                    setPlanName(investmentDoc.data()?.planName || 'Investment');
                } else {
                     router.push('/dashboard/investment/my-investment');
                }

                // Fetch return history
                const q = query(
                    collection(db, "returnHistory"), 
                    where("investmentId", "==", investmentId),
                    where("userId", "==", user.uid)
                );
                const querySnapshot = await getDocs(q);
                const returnsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Return));
                
                // Sort the data by date on the client side
                returnsData.sort((a, b) => b.date.seconds - a.date.seconds);

                setReturns(returnsData);

            } catch (error) {
                console.error("Error fetching return history:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchHistory();

    }, [user, investmentId, router]);
    
    const formatCurrency = (amount: number) => {
        const value = amount.toFixed(2);
        return currency.position === 'left' ? `${currency.symbol}${value}` : `${value}${currency.symbol}`;
    }

    return (
        <DashboardLayout>
            <div className="space-y-6 max-w-4xl mx-auto">
                <Button variant="ghost" onClick={() => router.back()}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back to My Investments
                </Button>
                <Card>
                    <CardHeader>
                        <CardTitle>Return History for {planName}</CardTitle>
                        <CardDescription>A log of all returns paid out for this investment.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
                        ) : returns.length === 0 ? (
                            <p className="text-center text-muted-foreground p-8">No returns have been paid out for this investment yet.</p>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Amount</TableHead>
                                        <TableHead className="text-right">Date</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {returns.map((r) => (
                                        <TableRow key={r.id}>
                                            <TableCell className="font-medium">{formatCurrency(r.amount)}</TableCell>
                                            <TableCell className="text-right">{format(new Date(r.date.seconds * 1000), 'PPpp')}</TableCell>
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
