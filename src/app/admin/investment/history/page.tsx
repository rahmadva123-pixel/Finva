
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { AdminLayout } from "@/components/layout/admin-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from '@/lib/firebase';
import { collection, query, getDocs, doc, getDoc, orderBy, deleteDoc } from 'firebase/firestore';
import { Loader2, Trash2, Banknote, History, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, differenceInSeconds } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";


interface UserInvestment {
    id: string;
    userId: string;
    userEmail?: string;
    planName: string;
    amount: number;
    status: 'active' | 'completed';
    startDate: any;
    nextReturnDate?: any;
}

interface CurrencySettings {
  symbol: string;
  position: 'left' | 'right';
}

function Countdown({ nextReturnDate }: { nextReturnDate: any }) {
    const [timeLeft, setTimeLeft] = useState<string>('');

    useEffect(() => {
        if (!nextReturnDate?.seconds) {
            setTimeLeft('N/A');
            return;
        }
        const interval = setInterval(() => {
            const now = new Date();
            const nextReturn = new Date(nextReturnDate.seconds * 1000);
            const distance = differenceInSeconds(nextReturn, now);

            if (distance < 0) {
                setTimeLeft("Now");
                clearInterval(interval);
                return;
            }

            const days = Math.floor(distance / (3600 * 24));
            const hours = Math.floor((distance % (3600 * 24)) / 3600);
            const minutes = Math.floor((distance % 3600) / 60);
            const seconds = distance % 60;
            
            setTimeLeft(`${days}d ${hours}h ${minutes}m ${seconds}s`);
        }, 1000);

        return () => clearInterval(interval);
    }, [nextReturnDate]);

    return <span>{timeLeft}</span>;
}


export default function AdminInvestmentHistoryPage() {
    const [investments, setInvestments] = useState<UserInvestment[]>([]);
    const [loading, setLoading] = useState(true);
    const [currency, setCurrency] = useState<CurrencySettings>({ symbol: '$', position: 'left' });
    const { toast } = useToast();

    const fetchHistory = async () => {
        if (!db) {
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const currencyDoc = await getDoc(doc(db, "settings", "currency"));
            if (currencyDoc.exists()) {
              setCurrency(currencyDoc.data() as CurrencySettings);
            }

            const q = query(collection(db, "userInvestments"), orderBy("startDate", "desc"));
            const querySnapshot = await getDocs(q);
            const investmentsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as UserInvestment[];

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
    
    useEffect(() => {
        fetchHistory();
    }, [toast]);
    
    const handleDelete = async (investmentId: string) => {
        if (!db) return;
        try {
            await deleteDoc(doc(db, "userInvestments", investmentId));
            toast({ title: "Success", description: "Investment record has been deleted." });
            fetchHistory(); // Refresh the list
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: `Failed to delete record: ${error.message}` });
        }
    };
    
    const formatCurrency = (amount: number) => {
        const value = amount.toFixed(2);
        return currency.position === 'left' ? `${currency.symbol}${value}` : `${value}${currency.symbol}`;
    }

    const { activeInvestments, completedInvestments, totalAmount, activeAmount, completedAmount } = useMemo(() => {
        const active = investments.filter(inv => inv.status === 'active');
        const completed = investments.filter(inv => inv.status === 'completed');
        const total = investments.reduce((sum, inv) => sum + inv.amount, 0);
        const activeTotal = active.reduce((sum, inv) => sum + inv.amount, 0);
        const completedTotal = completed.reduce((sum, inv) => sum + inv.amount, 0);
        return {
            activeInvestments: active,
            completedInvestments: completed,
            totalAmount: total,
            activeAmount: activeTotal,
            completedAmount: completedTotal,
        };
    }, [investments]);

  return (
    <AdminLayout>
      <div className="flex flex-col gap-8">
        <div>
          <h1 className="text-3xl font-bold font-headline tracking-tight">Investment History</h1>
          <p className="text-muted-foreground">View a complete history of all user investments.</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Total Investments</CardTitle>
                    <Banknote className="h-4 w-4 text-muted-foreground"/>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(totalAmount)}</div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Active Investments</CardTitle>
                    <History className="h-4 w-4 text-muted-foreground"/>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(activeAmount)}</div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Completed Investments</CardTitle>
                    <CheckCircle className="h-4 w-4 text-muted-foreground"/>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(completedAmount)}</div>
                </CardContent>
            </Card>
        </div>
        
        {loading ? (
            <div className="flex justify-center items-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
        ) : (
            <Tabs defaultValue="active">
                <TabsList className="grid w-full max-w-md grid-cols-2">
                    <TabsTrigger value="active">Active ({activeInvestments.length})</TabsTrigger>
                    <TabsTrigger value="completed">Completed ({completedInvestments.length})</TabsTrigger>
                </TabsList>
                <TabsContent value="active">
                    <Card>
                        <CardHeader>
                            <CardTitle>Active Investments</CardTitle>
                            <CardDescription>A log of all ongoing investments.</CardDescription>
                        </CardHeader>
                        <CardContent>
                             <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>User</TableHead>
                                        <TableHead>Plan</TableHead>
                                        <TableHead>Amount</TableHead>
                                        <TableHead>Start Date</TableHead>
                                        <TableHead>Next Return</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {activeInvestments.map(inv => (
                                        <TableRow key={inv.id}>
                                            <TableCell className="font-medium">{inv.userEmail}</TableCell>
                                            <TableCell>{inv.planName}</TableCell>
                                            <TableCell>{formatCurrency(inv.amount)}</TableCell>
                                            <TableCell>{format(new Date(inv.startDate.seconds * 1000), "PPp")}</TableCell>
                                            <TableCell><Countdown nextReturnDate={inv.nextReturnDate} /></TableCell>
                                            <TableCell className="text-right">
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                            <AlertDialogDescription>This action will permanently delete this investment record. This may affect user earning calculations if not handled carefully.</AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                            <AlertDialogAction onClick={() => handleDelete(inv.id)}>Delete</AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="completed">
                     <Card>
                        <CardHeader>
                            <CardTitle>Completed Investments</CardTitle>
                            <CardDescription>A log of all completed investments.</CardDescription>
                        </CardHeader>
                        <CardContent>
                             <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>User</TableHead>
                                        <TableHead>Plan</TableHead>
                                        <TableHead>Amount</TableHead>
                                        <TableHead>Start Date</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {completedInvestments.map(inv => (
                                        <TableRow key={inv.id}>
                                            <TableCell className="font-medium">{inv.userEmail}</TableCell>
                                            <TableCell>{inv.planName}</TableCell>
                                            <TableCell>{formatCurrency(inv.amount)}</TableCell>
                                            <TableCell>{format(new Date(inv.startDate.seconds * 1000), "PPp")}</TableCell>
                                            <TableCell className="text-right">
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                            <AlertDialogDescription>This action will permanently delete this investment record. This may affect historical data but should not impact live user balances.</AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                            <AlertDialogAction onClick={() => handleDelete(inv.id)}>Delete</AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        )}
      </div>
    </AdminLayout>
  );
}
