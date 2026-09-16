
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { AdminLayout } from "@/components/layout/admin-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, AlertTriangle } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, writeBatch, getDoc, serverTimestamp, runTransaction, orderBy, addDoc } from 'firebase/firestore';
import { format, isAfter, differenceInSeconds, addHours, addDays, addWeeks, addMonths, addYears } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { addEarning } from '@/lib/earnings';

interface UserInvestment {
    id: string;
    userId: string;
    userEmail?: string;
    userName?: string;
    userFirstName?: string;
    userLastName?: string;
    planName: string;
    amount: number;
    status: 'active' | 'completed';
    returnsCalculated: number;
    termDuration: number;
    interestRate: number;
    returnPeriod: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'lifetime';
    nextReturnDate: any;
    lastReturnDate: any;
    capitalBack: boolean;
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
                setTimeLeft("Due Now");
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

export default function ActiveInvestmentsPage() {
    const { toast } = useToast();
    const [activeInvestments, setActiveInvestments] = useState<UserInvestment[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [currency, setCurrency] = useState<CurrencySettings>({ symbol: '$', position: 'left' });

    const fetchActiveInvestments = useCallback(async () => {
        if (!db) { setLoading(false); return; }
        setLoading(true);
        try {
            const currencyDoc = await getDoc(doc(db, "settings", "currency"));
            if (currencyDoc.exists()) {
              setCurrency(currencyDoc.data() as CurrencySettings);
            }

            const q = query(collection(db, "userInvestments"), where("status", "==", "active"));
            const querySnapshot = await getDocs(q);

            const data = await Promise.all(querySnapshot.docs.map(async (d) => {
                const investmentData = d.data() as UserInvestment;
                const userDoc = await getDoc(doc(db, "users", investmentData.userId));
                const userData = userDoc.exists() ? userDoc.data() : {};
                return { 
                    ...investmentData,
                    id: d.id,
                    userEmail: userData.email || 'Unknown User',
                    userName: userData.username,
                    userFirstName: userData.firstName,
                    userLastName: userData.lastName,
                };
            }));
            
            // Sort client-side
            data.sort((a,b) => (a.nextReturnDate?.seconds || 0) - (b.nextReturnDate?.seconds || 0));

            setActiveInvestments(data);
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: `Failed to fetch investments: ${error.message}` });
        } finally {
            setLoading(false);
        }
    }, [toast]);
    
    useEffect(() => {
        fetchActiveInvestments();
    }, [fetchActiveInvestments]);

    const getNextReturnDate = (startDate: Date, returnPeriod: UserInvestment['returnPeriod']): Date => {
        switch (returnPeriod) {
            case 'hourly': return addHours(startDate, 1);
            case 'daily': return addDays(startDate, 1);
            case 'weekly': return addWeeks(startDate, 1);
            case 'monthly': return addMonths(startDate, 1);
            case 'yearly': return addYears(startDate, 1);
            default: return startDate;
        }
    }
    
    const formatCurrency = (amount: number) => {
        const value = amount.toFixed(2);
        return currency.position === 'left' ? `${currency.symbol}${value}` : `${value}${currency.symbol}`;
    }

    const handleManualPayout = async (investment: UserInvestment) => {
        if (!db) return;
    
        const nextReturnDateFromUI = investment.nextReturnDate?.toDate();
        if (!nextReturnDateFromUI || isAfter(nextReturnDateFromUI, new Date())) {
            toast({ variant: 'destructive', title: 'Not Due Yet', description: 'This investment is not yet due for a payout.' });
            return;
        }
    
        setProcessingId(investment.id);
    
        try {
            const notificationSettingsDoc = await getDoc(doc(db, 'settings', 'notifications'));
            const notificationSettings = notificationSettingsDoc.exists() ? notificationSettingsDoc.data() : {};

            await runTransaction(db, async (transaction) => {
                const investmentRef = doc(db, 'userInvestments', investment.id);
                const investmentDoc = await transaction.get(investmentRef);

                if (!investmentDoc.exists()) {
                    throw new Error("Investment not found.");
                }
                const currentInvestmentData = investmentDoc.data() as UserInvestment;

                // CRITICAL CHECK: ensure we are processing the same return we thought we were.
                if (currentInvestmentData.nextReturnDate.toMillis() !== investment.nextReturnDate.toMillis()) {
                    throw new Error("This return has already been processed. Please refresh the page.");
                }

                // Check again if it's due, inside the transaction
                const nextReturnDate = currentInvestmentData.nextReturnDate.toDate();
                if (isAfter(nextReturnDate, new Date())) {
                    throw new Error("This investment is not yet due for a payout.");
                }
                
                const userRef = doc(db, 'users', investment.userId);
                const earningRulesDocRef = doc(db, "settings", "earningRules");
                
                const userDoc = await transaction.get(userRef);
                const earningRulesDoc = await transaction.get(earningRulesDocRef);
    
                if (!userDoc.exists()) {
                    throw new Error("User not found.");
                }
    
                const profitPerReturn = (currentInvestmentData.amount * currentInvestmentData.interestRate) / 100;
                
                const newReturnsCalculated = currentInvestmentData.returnsCalculated + 1;
                const isCompleted = currentInvestmentData.termDuration !== -1 && newReturnsCalculated >= currentInvestmentData.termDuration;
                
                const capitalToReturn = (isCompleted && currentInvestmentData.capitalBack) ? currentInvestmentData.amount : 0;
    
                await addEarning(transaction, investment.userId, profitPerReturn, userDoc, earningRulesDoc, capitalToReturn);
    
                const transactionLogRef = doc(collection(db, 'investmentTransactions'));
                transaction.set(transactionLogRef, {
                    userId: investment.userId,
                    investmentId: investment.id,
                    planName: investment.planName,
                    amount: profitPerReturn,
                    type: 'Profit Return (Manual)',
                    date: serverTimestamp(),
                });

                if (capitalToReturn > 0) {
                     const capitalBackLogRef = doc(collection(db, 'investmentTransactions'));
                    transaction.set(capitalBackLogRef, {
                        userId: investment.userId,
                        investmentId: investment.id,
                        planName: investment.planName,
                        amount: capitalToReturn,
                        type: 'Capital Back (Manual)',
                        date: serverTimestamp(),
                    });
                }
    
                const lastReturnDate = currentInvestmentData.nextReturnDate.toDate();
                const nextDueDate = isCompleted ? null : getNextReturnDate(lastReturnDate, currentInvestmentData.returnPeriod);
    
                transaction.update(investmentRef, {
                    returnsCalculated: newReturnsCalculated,
                    lastReturnDate: lastReturnDate,
                    nextReturnDate: nextDueDate,
                    status: isCompleted ? 'completed' : 'active',
                });
            });

            // Send notifications outside the transaction
            const batch = writeBatch(db);
            const profitPerReturn = (investment.amount * investment.interestRate) / 100;
            
            if (notificationSettings.investmentReturn) {
                const notificationRef = doc(collection(db, 'notifications'));
                batch.set(notificationRef, {
                    userId: investment.userId,
                    title: 'Investment Return Received',
                    description: `You received ${formatCurrency(profitPerReturn)} return from your ${investment.planName} investment.`,
                    isRead: false,
                    createdAt: serverTimestamp(),
                    link: '/dashboard/investment/my-investment',
                    type: 'investmentReturn'
                });
            }

            const isCompleted = investment.termDuration !== -1 && (investment.returnsCalculated + 1) >= investment.termDuration;
            if (isCompleted && investment.capitalBack && notificationSettings.capitalBack) {
                const notificationRef = doc(collection(db, 'notifications'));
                batch.set(notificationRef, {
                    userId: investment.userId,
                    title: 'Investment Capital Returned',
                    description: `Your capital of ${formatCurrency(investment.amount)} from ${investment.planName} has been returned.`,
                    isRead: false,
                    createdAt: serverTimestamp(),
                    link: '/dashboard/investment/my-investment',
                    type: 'capitalBack'
                });
            }
            await batch.commit();
    
            toast({ title: 'Success', description: `Return paid to ${investment.userEmail}.` });
            fetchActiveInvestments();
    
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Payout Failed', description: `Failed to process payment: ${error.message}` });
        } finally {
            setProcessingId(null);
        }
    }

    const dueInvestments = activeInvestments.filter(inv => {
        const nextReturnDate = inv.nextReturnDate?.toDate();
        return nextReturnDate && isAfter(new Date(), nextReturnDate);
    });

    const renderInvestmentTable = (investments: UserInvestment[]) => (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Invested</TableHead>
                    <TableHead>Return</TableHead>
                    <TableHead>Capital Back</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Next Return</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {investments.map(inv => {
                    const isDue = inv.nextReturnDate && isAfter(new Date(), inv.nextReturnDate.toDate());
                    return (
                    <TableRow key={inv.id}>
                        <TableCell>
                            <div className="font-medium">{inv.userFirstName} {inv.userLastName}</div>
                            <div className="text-sm text-muted-foreground">{inv.userEmail}</div>
                            {inv.userName && <div className="text-xs text-muted-foreground">@{inv.userName}</div>}
                        </TableCell>
                        <TableCell>{inv.planName}</TableCell>
                        <TableCell>{formatCurrency(inv.amount)}</TableCell>
                        <TableCell className="font-semibold text-primary">
                            {formatCurrency((inv.amount * inv.interestRate) / 100)} / {inv.returnPeriod}
                        </TableCell>
                        <TableCell>
                            <Badge variant={inv.capitalBack ? 'default' : 'secondary'}>{inv.capitalBack ? 'Yes' : 'No'}</Badge>
                        </TableCell>
                        <TableCell>{inv.returnsCalculated} / {inv.termDuration === -1 ? 'Lifetime' : inv.termDuration}</TableCell>
                        <TableCell><Countdown nextReturnDate={inv.nextReturnDate} /></TableCell>
                        <TableCell className="text-right">
                            <Button 
                                size="sm" 
                                onClick={() => handleManualPayout(inv)} 
                                disabled={processingId === inv.id || !isDue}
                                variant={isDue ? 'default' : 'outline'}
                            >
                                {processingId === inv.id && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                                {isDue ? 'Pay Now' : 'Pay'}
                            </Button>
                        </TableCell>
                    </TableRow>
                )})}
            </TableBody>
        </Table>
    );

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div className="flex justify-between items-center">
            <div>
                <h1 className="text-3xl font-bold font-headline tracking-tight">Active Investments</h1>
                <p className="text-muted-foreground">Monitor upcoming and due investment returns.</p>
            </div>
             <Button variant="outline" onClick={() => fetchActiveInvestments()} disabled={loading}>
                <RefreshCw className={loading ? 'animate-spin mr-2' : 'mr-2'}/>
                Refresh
            </Button>
        </div>
        
        <Tabs defaultValue="due">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="due">Due for Payout ({dueInvestments.length})</TabsTrigger>
            <TabsTrigger value="active">All Active ({activeInvestments.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="due" className="mt-4">
            <Card>
                <CardHeader>
                    <CardTitle>Due Payments</CardTitle>
                    <CardDescription>
                       These investments are past their next return date and require manual payment.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
                    ) : dueInvestments.length === 0 ? (
                        <div className="text-center p-8 space-y-2">
                            <AlertTriangle className="mx-auto h-12 w-12 text-muted-foreground" />
                            <h3 className="font-semibold text-lg">No Payments Due</h3>
                            <p className="text-muted-foreground">There are no investments currently awaiting manual payout.</p>
                        </div>
                    ) : renderInvestmentTable(dueInvestments) }
                </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="active" className="mt-4">
             <Card>
                <CardHeader>
                    <CardTitle>All Active Investments</CardTitle>
                    <CardDescription>
                       A list of all ongoing investments, ordered by their next return date.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
                    ) : activeInvestments.length === 0 ? (
                        <div className="text-center p-8 space-y-2">
                            <AlertTriangle className="mx-auto h-12 w-12 text-muted-foreground" />
                            <h3 className="font-semibold text-lg">No Active Investments</h3>
                            <p className="text-muted-foreground">There are currently no active user investments.</p>
                        </div>
                    ) : renderInvestmentTable(activeInvestments) }
                </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
