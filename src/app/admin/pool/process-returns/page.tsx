
"use client";

import React, { useState, useEffect } from 'react';
import { AdminLayout } from "@/components/layout/admin-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Check } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, doc, getDoc, writeBatch, runTransaction, serverTimestamp, orderBy, updateDoc, DocumentSnapshot } from 'firebase/firestore';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { format, differenceInSeconds, parseISO } from 'date-fns';
import { addEarning } from '@/lib/earnings';

interface PoolPlan {
  id: string;
  poolName: string;
  totalAmount: number;
  returnDate: string;
  payoutType: 'auto' | 'manual';
  minReturn: number;
  maxReturn: number;
}

interface PoolInvestment {
    id: string;
    userId: string;
    userEmail?: string;
    amount: number;
}

interface AutoPayout {
    investmentId: string;
    userId: string;
    userEmail?: string;
    invested: number;
    returnAmount: number;
}

interface AutoPayoutPreview {
    returnPercentage: number;
    payouts: AutoPayout[];
}

function Countdown({ endDate }: { endDate: Date }) {
    const [timeLeft, setTimeLeft] = useState<string>("--d --h --m --s");

    useEffect(() => {
        const timer = setInterval(() => {
            const now = new Date();
            const remainingSeconds = differenceInSeconds(endDate, now);
            
            if (remainingSeconds <= 0) {
                setTimeLeft("Due for payout");
                clearInterval(timer);
                return;
            }

            const days = Math.floor(remainingSeconds / (3600 * 24));
            const hours = Math.floor((remainingSeconds % (3600 * 24)) / 3600);
            const minutes = Math.floor((remainingSeconds % 3600) / 60);
            const seconds = remainingSeconds % 60;
            
            setTimeLeft(`${days}d ${hours}h ${minutes}m ${seconds}s`);

        }, 1000);

        return () => clearInterval(timer);
    }, [endDate]);

    return <span className="font-mono text-sm">{timeLeft}</span>;
}


export default function AllPoolReturnsPayPage() {
    const { toast } = useToast();
    const [isProcessingId, setIsProcessingId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [duePools, setDuePools] = useState<PoolPlan[]>([]);
    const [upcomingPools, setUpcomingPools] = useState<PoolPlan[]>([]);
    const [poolInvestors, setPoolInvestors] = useState<Record<string, PoolInvestment[]>>({});
    const [returnAmounts, setReturnAmounts] = useState<Record<string, string>>({}); // for manual
    const [previewAmounts, setPreviewAmounts] = useState<Record<string, AutoPayoutPreview>>({}); // for auto

    useEffect(() => {
        const fetchDuePools = async () => {
            if (!db) return;
            setLoading(true);
            try {
                const today = new Date().toISOString().split('T')[0];
                const q = query(collection(db, 'poolPlans'), where('status', '==', 'active'));
                const querySnapshot = await getDocs(q);
                
                const duePoolsData: PoolPlan[] = [];
                const upcomingPoolsData: PoolPlan[] = [];

                for (const d of querySnapshot.docs) {
                    const plan = { id: d.id, ...d.data() } as PoolPlan;
                    
                    const investmentsQuery = query(collection(db, 'userPoolInvestments'), where('poolId', '==', d.id), where('status', '==', 'active'));
                    const investmentsSnapshot = await getDocs(investmentsQuery);

                    if (!investmentsSnapshot.empty) {
                        if (plan.returnDate <= today) {
                            duePoolsData.push(plan);
                        } else {
                            upcomingPoolsData.push(plan);
                        }
                    }
                }
                
                setDuePools(duePoolsData.sort((a,b) => new Date(a.returnDate).getTime() - new Date(b.returnDate).getTime()));
                setUpcomingPools(upcomingPoolsData.sort((a,b) => new Date(a.returnDate).getTime() - new Date(b.returnDate).getTime()));

            } catch (error: any) {
                toast({ variant: 'destructive', title: 'Error', description: `Failed to fetch pools: ${error.message}` });
            } finally {
                setLoading(false);
            }
        };
        fetchDuePools();
    }, [toast]);
    
    const fetchInvestorsForPool = async (pool: PoolPlan) => {
        if (!db || poolInvestors[pool.id]) return; 
        
        try {
            const q = query(collection(db, 'userPoolInvestments'), where('poolId', '==', pool.id), where('status', '==', 'active'));
            const querySnapshot = await getDocs(q);
            
            const investorsData = await Promise.all(querySnapshot.docs.map(async (d) => {
                const data = d.data();
                const userDoc = await getDoc(doc(db, 'users', data.userId));
                return { 
                    id: d.id,
                    ...data,
                    userEmail: userDoc.exists() ? userDoc.data().email : 'Unknown User'
                } as PoolInvestment;
            }));
            
            setPoolInvestors(prev => ({ ...prev, [pool.id]: investorsData }));

            if (pool.payoutType === 'auto') {
                const min = pool.minReturn || 0;
                const max = pool.maxReturn || 0;
                const randomReturnPercentage = Math.random() * (max - min) + min;
                
                const payouts = investorsData.map(inv => {
                    const profit = inv.amount * (randomReturnPercentage / 100);
                    const totalReturn = inv.amount + profit;
                    return {
                        investmentId: inv.id,
                        userId: inv.userId,
                        userEmail: inv.userEmail,
                        invested: inv.amount,
                        returnAmount: totalReturn,
                    };
                });
                
                setPreviewAmounts(prev => ({
                    ...prev,
                    [pool.id]: {
                        returnPercentage: randomReturnPercentage,
                        payouts: payouts,
                    }
                }));
            }

        } catch(error: any) {
            toast({ variant: 'destructive', title: 'Error', description: `Failed to fetch investors: ${error.message}`});
        }
    };

    const handleReturnAmountChange = (investmentId: string, amount: string) => {
        setReturnAmounts(prev => ({...prev, [investmentId]: amount}));
    }

    const handleSingleManualPayout = async (pool: PoolPlan, investment: PoolInvestment) => {
        if (!db) return;
        const returnAmount = parseFloat(returnAmounts[investment.id] || '0');
        if (returnAmount <= 0) {
            toast({ variant: 'destructive', title: 'Invalid Amount', description: 'Please enter a valid return amount.' });
            return;
        }
        
        setIsProcessingId(investment.id);
    
        try {
            const profit = returnAmount - investment.amount;

            await runTransaction(db, async (transaction) => {
                const userRef = doc(db, 'users', investment.userId);
                const earningRulesDocRef = doc(db, 'settings', 'earningRules');

                const [userDoc, earningRulesDoc] = await Promise.all([
                    transaction.get(userRef),
                    transaction.get(earningRulesDocRef),
                ]);

                if (!userDoc.exists()) throw new Error("User not found.");
                
                await addEarning(transaction, investment.userId, profit, userDoc, earningRulesDoc, investment.amount);
                
                const investmentRef = doc(db, 'userPoolInvestments', investment.id);
                transaction.update(investmentRef, { status: 'completed', returnAmount: returnAmount });
            });

            const batch = writeBatch(db);
            if (profit > 0) {
                batch.set(doc(collection(db, "investmentTransactions")), {
                    userId: investment.userId, planName: pool.poolName, amount: profit, type: 'Pool Return', date: serverTimestamp(),
                });
            }
            batch.set(doc(collection(db, "investmentTransactions")), {
                userId: investment.userId, planName: pool.poolName, amount: investment.amount, type: 'Pool Capital Back', date: serverTimestamp(),
            });
            await batch.commit();
            
            toast({ title: 'Success', description: `Payout to ${investment.userEmail} processed.` });
    
            setPoolInvestors(prev => {
                const updatedInvestors = (prev[pool.id] || []).filter(inv => inv.id !== investment.id);
                if (updatedInvestors.length === 0) {
                    setDuePools(duePools.filter(p => p.id !== pool.id));
                    updateDoc(doc(db, 'poolPlans', pool.id), { status: 'completed' });
                }
                return { ...prev, [pool.id]: updatedInvestors };
            });
            
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: `Failed to process payout: ${error.message}` });
        } finally {
            setIsProcessingId(null);
        }
    }
    
    const handleSingleAutoPayout = async (pool: PoolPlan, payout: AutoPayout) => {
        if (!db) return;
        setIsProcessingId(payout.investmentId);
    
        try {
            const { userId, invested, returnAmount, investmentId } = payout;
            const profit = returnAmount - invested;
    
            await runTransaction(db, async (transaction) => {
                const userRef = doc(db, 'users', userId);
                const investmentRef = doc(db, 'userPoolInvestments', investmentId);
                const earningRulesDocRef = doc(db, 'settings', 'earningRules');

                const [userDoc, investmentDoc, earningRulesDoc] = await Promise.all([
                    transaction.get(userRef),
                    transaction.get(investmentRef),
                    transaction.get(earningRulesDocRef)
                ]);
    
                if (!userDoc.exists()) throw new Error("User document not found.");
                if (!investmentDoc.exists() || investmentDoc.data().status !== 'active') {
                    console.warn(`Pool investment ${investmentId} not found or not active.`);
                    return; 
                }
                
                await addEarning(transaction, userId, profit, userDoc, earningRulesDoc, invested);
                
                transaction.update(investmentRef, { status: 'completed', returnAmount: returnAmount, actualReturnPercentage: previewAmounts[pool.id].returnPercentage });
            });
    
            const batch = writeBatch(db);
            if (profit > 0) {
                batch.set(doc(collection(db, "investmentTransactions")), {
                    userId: userId, planName: pool.poolName, amount: profit, type: 'Pool Return', date: serverTimestamp(),
                });
            }
            batch.set(doc(collection(db, "investmentTransactions")), {
                userId: userId, planName: pool.poolName, amount: invested, type: 'Pool Capital Back', date: serverTimestamp(),
            });
            await batch.commit();

            toast({ title: `Payout for ${payout.userEmail} Processed!` });
    
            setPoolInvestors(prev => {
                const updatedInvestors = (prev[pool.id] || []).filter(inv => inv.id !== investmentId);
                if (updatedInvestors.length === 0) {
                    setDuePools(duePools.filter(p => p.id !== pool.id));
                    updateDoc(doc(db, 'poolPlans', pool.id), { status: 'completed' });
                }
                return { ...prev, [pool.id]: updatedInvestors };
            });
    
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: `Failed to process payout: ${error.message}` });
        } finally {
            setIsProcessingId(null);
        }
    };


  return (
    <AdminLayout>
      <div className="space-y-8">
         <div>
          <h1 className="text-3xl font-bold font-headline tracking-tight">All Due Pool Payouts</h1>
          <p className="text-muted-foreground">Process returns for all matured pools.</p>
        </div>
        <Card>
            <CardHeader>
                <CardTitle>Matured Pools</CardTitle>
                <CardDescription>Review and process payouts for any pool that has reached its return date.</CardDescription>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="flex justify-center items-center h-48"><Loader2 className="h-8 w-8 animate-spin" /></div>
                ) : duePools.length > 0 ? (
                    <Accordion type="single" collapsible className="w-full space-y-4">
                        {duePools.map(pool => (
                            <AccordionItem value={pool.id} key={pool.id} className="border rounded-lg">
                                <AccordionTrigger className="px-4 py-3 text-lg font-semibold hover:no-underline" onClick={() => fetchInvestorsForPool(pool)}>
                                    {pool.poolName} (Return Date: {format(parseISO(pool.returnDate + 'T00:00:00Z'), 'PPP')})
                                </AccordionTrigger>
                                <AccordionContent className="p-4 border-t">
                                    {!poolInvestors[pool.id] ? (
                                        <div className="flex justify-center items-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
                                    ) : pool.payoutType === 'auto' ? (
                                        <div className="space-y-4">
                                            <div className="text-center">
                                                <p className="text-muted-foreground">This is an automatic payout pool.</p>
                                                <div className="font-semibold">Return Range: {pool.minReturn}% - {pool.maxReturn}%</div>
                                            </div>
                                            {previewAmounts[pool.id] && (
                                                 <div className="space-y-4">
                                                    <div className="p-4 bg-muted rounded-lg text-center">
                                                        <h4 className="font-bold text-lg">Generated Return: {previewAmounts[pool.id].returnPercentage.toFixed(2)}%</h4>
                                                    </div>
                                                    <Table>
                                                        <TableHeader><TableRow><TableHead>User</TableHead><TableHead>Invested</TableHead><TableHead>Total Return</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
                                                        <TableBody>
                                                            {previewAmounts[pool.id].payouts.map((payout) => (
                                                                <TableRow key={payout.investmentId}>
                                                                    <TableCell>{payout.userEmail}</TableCell>
                                                                    <TableCell>${payout.invested.toFixed(2)}</TableCell>
                                                                    <TableCell className="font-semibold text-primary">${payout.returnAmount.toFixed(2)}</TableCell>
                                                                    <TableCell className="text-right">
                                                                        <Button size="sm" onClick={() => handleSingleAutoPayout(pool, payout)} disabled={isProcessingId === payout.investmentId}>
                                                                            {isProcessingId === payout.investmentId ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : 'Pay'}
                                                                        </Button>
                                                                    </TableCell>
                                                                </TableRow>
                                                            ))}
                                                        </TableBody>
                                                    </Table>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>User Email</TableHead>
                                                        <TableHead>Invested Amount</TableHead>
                                                        <TableHead>Return Amount</TableHead>
                                                        <TableHead className="text-right">Action</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {poolInvestors[pool.id].map(inv => (
                                                        <TableRow key={inv.id}>
                                                            <TableCell>{inv.userEmail}</TableCell>
                                                            <TableCell>${inv.amount.toFixed(2)}</TableCell>
                                                            <TableCell>
                                                                <Input 
                                                                    type="number"
                                                                    placeholder="Enter return"
                                                                    value={returnAmounts[inv.id] || ''}
                                                                    onChange={(e) => handleReturnAmountChange(inv.id, e.target.value)}
                                                                />
                                                            </TableCell>
                                                            <TableCell className="text-right">
                                                                <Button size="sm" onClick={() => handleSingleManualPayout(pool, inv)} disabled={isProcessingId === inv.id || !returnAmounts[inv.id]}>
                                                                    {isProcessingId === inv.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : 'Pay'}
                                                                </Button>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    )}
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                ) : (
                    <p className="text-center text-muted-foreground p-8">No pools are ready for payout.</p>
                )}
            </CardContent>
        </Card>
        <Card>
            <CardHeader>
                <CardTitle>Upcoming Pools</CardTitle>
                <CardDescription>A list of active pools that have not yet reached their return date.</CardDescription>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="flex justify-center items-center h-48"><Loader2 className="h-8 w-8 animate-spin" /></div>
                ) : upcomingPools.length > 0 ? (
                    <Accordion type="single" collapsible className="w-full space-y-4">
                        {upcomingPools.map(pool => (
                             <AccordionItem value={pool.id} key={pool.id} className="border rounded-lg">
                                <AccordionTrigger className="px-4 py-3 hover:no-underline" onClick={() => fetchInvestorsForPool(pool)}>
                                    <div className="flex justify-between items-center w-full">
                                        <span className="font-semibold">{pool.poolName}</span>
                                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                            <span>{format(parseISO(pool.returnDate + 'T00:00:00Z'), 'PPP')}</span>
                                            <Countdown endDate={parseISO(pool.returnDate + 'T00:00:00Z')} />
                                        </div>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="p-4 border-t">
                                     {!poolInvestors[pool.id] ? (
                                        <div className="flex justify-center items-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
                                    ) : (
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>User Email</TableHead>
                                                    <TableHead className="text-right">Invested Amount</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {poolInvestors[pool.id].map(inv => (
                                                    <TableRow key={inv.id}>
                                                        <TableCell>{inv.userEmail}</TableCell>
                                                        <TableCell className="text-right">${inv.amount.toFixed(2)}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    )}
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                ) : (
                     <p className="text-center text-muted-foreground p-8">No upcoming pools found.</p>
                )}
            </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}

  