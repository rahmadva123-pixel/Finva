
      
"use client";

import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, getDoc, writeBatch, serverTimestamp, runTransaction } from "firebase/firestore";
import React, { useEffect, useState, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { format, differenceInSeconds, isAfter, parseISO } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { addEarning } from "@/lib/earnings";

interface UserPoolInvestment {
    id: string;
    userId: string;
    poolId: string;
    poolName: string;
    amount: number;
    status: 'active' | 'completed';
    investedAt: any;
    returnAmount?: number;
}

interface PoolPlan {
    id: string;
    payoutType: 'auto' | 'manual';
    returnDate: string;
    minReturn: number;
    maxReturn: number;
    totalAmount: number;
    investedAt: any;
}

interface CurrencySettings {
  symbol: string;
  position: 'left' | 'right';
}

function Countdown({ startDate, endDate }: { startDate: Date; endDate: Date; }) {
    const [timeLeft, setTimeLeft] = useState<string>("--d --h --m --s");
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        const totalDuration = differenceInSeconds(endDate, startDate);
        if (totalDuration <= 0) {
            setTimeLeft("0d 0h 0m 0s");
            setProgress(100);
            return;
        }

        const timer = setInterval(() => {
            const now = new Date();
            const remainingSeconds = differenceInSeconds(endDate, now);
            
            if (remainingSeconds <= 0) {
                setTimeLeft("0d 0h 0m 0s");
                setProgress(100);
                clearInterval(timer);
                return;
            }
            
            const elapsedSeconds = totalDuration - remainingSeconds;
            const currentProgress = Math.min(100, (elapsedSeconds / totalDuration) * 100);
            setProgress(currentProgress);

            const days = Math.floor(remainingSeconds / (3600 * 24));
            const hours = Math.floor((remainingSeconds % (3600 * 24)) / 3600);
            const minutes = Math.floor((remainingSeconds % 3600) / 60);
            const seconds = remainingSeconds % 60;
            
            setTimeLeft(`${days}d ${hours}h ${minutes}m ${seconds}s`);

        }, 1000);

        return () => clearInterval(timer);
    }, [startDate, endDate]);

    return (
        <div className="w-full space-y-2">
             <div className="text-xs font-mono tracking-wider text-center">{timeLeft}</div>
             <Progress value={progress} className="h-2" />
        </div>
    );
}

const PoolCard = ({ investment, currency, plan }: { investment: UserPoolInvestment, currency: CurrencySettings, plan: PoolPlan | undefined }) => {
    const formatCurrency = (amount: number) => {
        const value = amount.toFixed(2);
        return currency.position === 'left' ? `${currency.symbol}${value}` : `${value}${currency.symbol}`;
    }
    
    // Safely parse the date string. This handles 'YYYY-MM-DD' and assumes UTC to prevent timezone shifts.
    const returnDate = plan?.returnDate ? parseISO(plan.returnDate + 'T00:00:00Z') : null;

    return (
        <Card>
            <CardHeader>
                <CardTitle>{investment.poolName}</CardTitle>
                <CardDescription>Invested: {formatCurrency(investment.amount)}</CardDescription>
            </CardHeader>
            <CardContent>
                {investment.status === 'active' && plan && returnDate ? (
                    <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">Pool completes on {format(returnDate, 'PPP')}</p>
                        <Countdown startDate={investment.investedAt.toDate()} endDate={returnDate} />
                    </div>
                ) : investment.status === 'completed' ? (
                     <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">Completed. You received:</p>
                        <p className="text-2xl font-bold text-primary">{formatCurrency(investment.returnAmount || 0)}</p>
                    </div>
                ) : <Badge>Status Unknown</Badge>}
            </CardContent>
        </Card>
    );
};

export default function MyPoolsPage() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [investments, setInvestments] = useState<UserPoolInvestment[]>([]);
    const [poolPlans, setPoolPlans] = useState<Map<string, PoolPlan>>(new Map());
    const [loading, setLoading] = useState(true);
    const [currency, setCurrency] = useState<CurrencySettings>({ symbol: '$', position: 'left' });

    const fetchPoolData = useCallback(async (showLoading = true) => {
        if (!user || !db) {
          if(showLoading) setLoading(false);
          return;
        }
        if(showLoading) setLoading(true);

        try {
            const currencyDoc = await getDoc(doc(db, "settings", "currency"));
            if (currencyDoc.exists()) {
                setCurrency(currencyDoc.data() as CurrencySettings);
            }

            // Fetch all pool plans first
            const plansSnapshot = await getDocs(collection(db, 'poolPlans'));
            const plansMap = new Map<string, PoolPlan>();
            plansSnapshot.forEach(doc => {
                plansMap.set(doc.id, { id: doc.id, ...doc.data()} as PoolPlan);
            });
            setPoolPlans(plansMap);

            // Fetch user's investments
            const q = query(collection(db, "userPoolInvestments"), where("userId", "==", user.uid));
            const querySnapshot = await getDocs(q);
            const investmentsData = querySnapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() } as UserPoolInvestment))
                .sort((a,b) => b.investedAt.seconds - a.investedAt.seconds);
            
            setInvestments(investmentsData);

        } catch (error) {
          console.error("Error fetching pool investments: ", error);
        } finally {
          if(showLoading) setLoading(false);
        }
    }, [user]);

    const processAutoPoolPayouts = useCallback(async () => {
        if (!user || !db || investments.length === 0 || poolPlans.size === 0) return;
        
        const dueInvestments = investments.filter(inv => {
            const plan = poolPlans.get(inv.poolId);
            const returnDate = plan?.returnDate ? parseISO(plan.returnDate + 'T00:00:00Z') : null;
            return inv.status === 'active' && plan?.payoutType === 'auto' && returnDate && isAfter(new Date(), returnDate);
        });

        if (dueInvestments.length === 0) return;

        let payoutsProcessed = false;
        
        try {
             await runTransaction(db, async (transaction) => {
                for (const investment of dueInvestments) {
                    const plan = poolPlans.get(investment.poolId);
                    if (!plan) continue;

                    const userRef = doc(db, 'users', user.uid);
                    const earningRulesDocRef = doc(db, "settings", "earningRules");

                    const [userDoc, earningRulesDoc] = await Promise.all([
                        transaction.get(userRef),
                        transaction.get(earningRulesDocRef),
                    ]);
                    
                    if (!userDoc.exists()) continue;

                    const min = plan.minReturn / 100;
                    const max = plan.maxReturn / 100;
                    const randomReturnPercentage = Math.random() * (max - min) + min;
                    const profit = investment.amount * randomReturnPercentage;

                    await addEarning(transaction, user.uid, profit, userDoc, earningRulesDoc, investment.amount);
                    
                    const investmentRef = doc(db, 'userPoolInvestments', investment.id);
                    transaction.update(investmentRef, { status: 'completed', returnAmount: investment.amount + profit });

                    transaction.set(doc(collection(db, "investmentTransactions")), {
                        userId: user.uid, planName: investment.poolName, amount: profit, type: 'Pool Return', date: serverTimestamp(),
                    });
                     transaction.set(doc(collection(db, "investmentTransactions")), {
                        userId: user.uid, planName: investment.poolName, amount: investment.amount, type: 'Pool Capital Back', date: serverTimestamp(),
                    });

                    payoutsProcessed = true;
                }
            });

            if (payoutsProcessed) {
                toast({ title: "Pool Payout Processed", description: "Your completed pool investment returns have been added to your wallet." });
                fetchPoolData(false);
            }

        } catch (error: any) {
             console.error("Error processing auto pool payouts:", error);
             toast({ variant: "destructive", title: "Error processing payouts", description: error.message });
        }
    }, [user, db, investments, poolPlans, toast, fetchPoolData]);

    useEffect(() => {
        fetchPoolData();
    }, [fetchPoolData]);

    useEffect(() => {
        const interval = setInterval(() => {
            processAutoPoolPayouts();
        }, 30000); // Check every 30 seconds
        return () => clearInterval(interval);
    }, [processAutoPoolPayouts]);

    const activeInvestments = investments.filter(inv => inv.status === 'active');
    const completedInvestments = investments.filter(inv => inv.status === 'completed');

    if(loading) {
        return (
            <DashboardLayout>
                <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin" /></div>
            </DashboardLayout>
        )
    }

    return (
        <DashboardLayout>
            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold font-headline tracking-tight">My Pools</h1>
                    <p className="text-muted-foreground">An overview of your active and completed pool investments.</p>
                </div>
                 <Tabs defaultValue="active">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="active">Active Pools</TabsTrigger>
                        <TabsTrigger value="completed">Completed Pools</TabsTrigger>
                    </TabsList>
                    <TabsContent value="active" className="pt-4">
                        {activeInvestments.length > 0 ? (
                             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {activeInvestments.map(inv => <PoolCard key={inv.id} investment={inv} currency={currency} plan={poolPlans.get(inv.poolId)} />)}
                            </div>
                        ) : (
                            <Card><CardContent className="p-8 text-center text-muted-foreground">You have no active pool investments.</CardContent></Card>
                        )}
                    </TabsContent>
                    <TabsContent value="completed" className="pt-4">
                        {completedInvestments.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {completedInvestments.map(inv => <PoolCard key={inv.id} investment={inv} currency={currency} plan={poolPlans.get(inv.poolId)} />)}
                            </div>
                        ) : (
                            <Card><CardContent className="p-8 text-center text-muted-foreground">You have no completed pool investments.</CardContent></Card>
                        )}
                    </TabsContent>
                </Tabs>
            </div>
        </DashboardLayout>
    );
}

    