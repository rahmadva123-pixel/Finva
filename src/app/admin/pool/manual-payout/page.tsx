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
import { collection, getDocs, query, where, doc, getDoc, writeBatch, updateDoc, orderBy } from 'firebase/firestore';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

interface PoolPlan {
  id: string;
  poolName: string;
  totalAmount: number;
  returnDate: string;
  status: 'active' | 'inactive' | 'completed';
  payoutType: 'auto' | 'manual';
}

interface PoolInvestment {
    id: string;
    userId: string;
    userEmail?: string;
    amount: number;
}

export default function AdminManualPayoutPage() {
    const { toast } = useToast();
    const [isProcessing, setIsProcessing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [manualPools, setManualPools] = useState<PoolPlan[]>([]);
    const [poolInvestors, setPoolInvestors] = useState<Record<string, PoolInvestment[]>>({});
    const [returnAmounts, setReturnAmounts] = useState<Record<string, string>>({}); // { [investmentId]: amount }

    useEffect(() => {
        const fetchManualPools = async () => {
            if (!db) return;
            setLoading(true);
            try {
                const today = new Date().toISOString().split('T')[0];
                const q = query(
                    collection(db, 'poolPlans'),
                    where('payoutType', '==', 'manual')
                );
                const querySnapshot = await getDocs(q);
                const poolsData = querySnapshot.docs
                    .map(doc => ({ id: doc.id, ...doc.data() } as PoolPlan))
                    .filter(plan => plan.status === 'active' && plan.returnDate <= today) // Client-side filtering
                    .sort((a,b) => new Date(b.returnDate).getTime() - new Date(a.returnDate).getTime()); // Client-side sorting

                setManualPools(poolsData);
            } catch (error: any) {
                toast({ variant: 'destructive', title: 'Error', description: `Failed to fetch manual pools: ${error.message}` });
            } finally {
                setLoading(false);
            }
        };
        fetchManualPools();
    }, [toast]);
    
    const fetchInvestorsForPool = async (poolId: string) => {
        if (!db || poolInvestors[poolId]) return; // Don't refetch
        
        try {
            const q = query(collection(db, 'userPoolInvestments'), where('poolId', '==', poolId));
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
            
            setPoolInvestors(prev => ({ ...prev, [poolId]: investorsData }));
        } catch(error: any) {
            toast({ variant: 'destructive', title: 'Error', description: `Failed to fetch investors: ${error.message}`});
        }
    };

    const handleReturnAmountChange = (investmentId: string, amount: string) => {
        setReturnAmounts(prev => ({...prev, [investmentId]: amount}));
    }

    const handleProcessPayouts = async (poolId: string) => {
        if(!db || !poolInvestors[poolId]) return;
        setIsProcessing(true);
        const batch = writeBatch(db);

        try {
            for (const investment of poolInvestors[poolId]) {
                const returnAmount = parseFloat(returnAmounts[investment.id] || '0');
                if (returnAmount > 0) {
                    const userRef = doc(db, 'users', investment.userId);
                    const userDoc = await getDoc(userRef);
                    if (userDoc.exists()) {
                        const currentBalance = userDoc.data().balance || 0;
                        batch.update(userRef, { balance: currentBalance + returnAmount });

                        const investmentRef = doc(db, 'userPoolInvestments', investment.id);
                        batch.update(investmentRef, { status: 'completed', returnAmount: returnAmount });
                    }
                }
            }
            
            const poolRef = doc(db, 'poolPlans', poolId);
            batch.update(poolRef, { status: 'completed' });

            await batch.commit();
            toast({ title: 'Success', description: 'Payouts processed successfully.' });
            
            // Refresh data
            setManualPools(prev => prev.filter(p => p.id !== poolId));
            setPoolInvestors(prev => {
                const newInvestors = {...prev};
                delete newInvestors[poolId];
                return newInvestors;
            });

        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: `Failed to process payouts: ${error.message}` });
        } finally {
            setIsProcessing(false);
        }
    }

  return (
    <AdminLayout>
      <div className="space-y-8">
         <div>
          <h1 className="text-3xl font-bold font-headline tracking-tight">Manual Pool Payouts</h1>
          <p className="text-muted-foreground">Process returns for matured pools with manual payout.</p>
        </div>
        <Card>
            <CardHeader>
                <CardTitle>Matured Manual Pools</CardTitle>
                <CardDescription>Review and process payouts for the pools listed below.</CardDescription>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="flex justify-center items-center h-48"><Loader2 className="h-8 w-8 animate-spin" /></div>
                ) : manualPools.length > 0 ? (
                    <Accordion type="single" collapsible className="w-full space-y-4">
                        {manualPools.map(pool => (
                            <AccordionItem value={pool.id} key={pool.id} className="border rounded-lg" onClick={() => fetchInvestorsForPool(pool.id)}>
                                <AccordionTrigger className="px-4 py-3 text-lg font-semibold hover:no-underline">
                                    {pool.poolName} (Return Date: {pool.returnDate})
                                </AccordionTrigger>
                                <AccordionContent className="p-4 border-t">
                                    {!poolInvestors[pool.id] ? (
                                        <div className="flex justify-center items-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
                                    ) : (
                                        <div className="space-y-4">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>User Email</TableHead>
                                                        <TableHead>Invested Amount</TableHead>
                                                        <TableHead>Return Amount</TableHead>
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
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                            <Button 
                                                onClick={() => handleProcessPayouts(pool.id)} 
                                                disabled={isProcessing}
                                                className="w-full"
                                            >
                                                {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                                                Process All Payouts for this Pool
                                            </Button>
                                        </div>
                                    )}
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                ) : (
                    <p className="text-center text-muted-foreground p-8">No manual pools are ready for payout.</p>
                )}
            </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
