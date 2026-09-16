
      

"use client";

import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, getDoc, writeBatch, serverTimestamp, updateDoc, addDoc, deleteDoc, runTransaction, DocumentSnapshot } from "firebase/firestore";
import React, { useEffect, useState, useCallback } from "react";
import { Loader2, CheckCircle, Ban } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, differenceInSeconds, isAfter } from 'date-fns';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { addEarning } from "@/lib/earnings";

interface UserStake {
    id: string;
    planName: string;
    amount: number;
    status: 'active' | 'completed' | 'cancelled';
    startDate: any;
    endDate: any;
    returnPercentage: number;
    capitalBack: boolean;
    payoutType: 'auto' | 'manual';
    stakeCurrency: 'main_balance' | 'ico_token';
    earlyUnstakeEnabled: boolean;
    unstakeFeePercent: number;
}

interface CurrencySettings {
  symbol: string;
  position: 'left' | 'right';
}

interface TokenData {
    symbol: string;
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
        <div className="w-full space-y-1">
             <div className="text-xs font-mono tracking-wider">{timeLeft}</div>
             <Progress value={progress} className="h-2" />
        </div>
    );
}

export default function MyStakingPage() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [stakes, setStakes] = useState<UserStake[]>([]);
    const [loading, setLoading] = useState(true);
    const [isClaiming, setIsClaiming] = useState<string | null>(null);
    const [isUnstaking, setIsUnstaking] = useState<string | null>(null);
    const [currency, setCurrency] = useState<CurrencySettings>({ symbol: '$', position: 'left' });
    const [tokenData, setTokenData] = useState<TokenData | null>(null);

    const fetchStakes = useCallback(async () => {
        if (!user || !db) {
          setLoading(false);
          return;
        }
        setLoading(true);
        try {
          const currencyDoc = await getDoc(doc(db, "settings", "currency"));
          if (currencyDoc.exists()) setCurrency(currencyDoc.data() as CurrencySettings);

          const tokenDoc = await getDoc(doc(db, "settings", "token"));
          if (tokenDoc.exists()) setTokenData(tokenDoc.data() as TokenData);
    
          const q = query(collection(db, "userStakes"), where("userId", "==", user.uid));
          const querySnapshot = await getDocs(q);
          const stakesData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserStake))
              .sort((a,b) => b.startDate.seconds - a.startDate.seconds);
          
          setStakes(stakesData);
    
        } catch (error) {
          console.error("Error fetching stakes: ", error);
        } finally {
          setLoading(false);
        }
    }, [user]);

    const processCompletedStakes = useCallback(async () => {
        if (!user || !db || stakes.length === 0) return;

        const now = new Date();
        const completedAutoStakes = stakes.filter(stake => stake.status === 'active' && stake.payoutType === 'auto' && now >= new Date(stake.endDate.seconds * 1000));
        
        if(completedAutoStakes.length === 0) return;

        let payoutsProcessed = false;
        
        try {
            await runTransaction(db, async (transaction) => {
                for (const stake of completedAutoStakes) {
                    const userRef = doc(db, 'users', user.uid);
                    const earningRulesDocRef = doc(db, "settings", "earningRules");
                    
                    const [userDoc, earningRulesDoc] = await Promise.all([
                        transaction.get(userRef),
                        transaction.get(earningRulesDocRef),
                    ]);

                    if (!userDoc.exists()) throw new Error(`User not found for stake ${stake.id}`);

                    const profit = stake.amount * stake.returnPercentage / 100;
                    const capitalToReturn = stake.capitalBack ? stake.amount : 0;
                    
                    if (stake.stakeCurrency !== 'ico_token') {
                        await addEarning(transaction, user.uid, profit, userDoc, earningRulesDoc, capitalToReturn);
                    } else {
                        const currentTokenBalance = userDoc.data()?.tokenBalance || 0;
                        transaction.update(userRef, { tokenBalance: currentTokenBalance + profit + capitalToReturn });
                    }

                    transaction.set(doc(collection(db, "investmentTransactions")), {
                        userId: user.uid, planName: stake.planName, amount: profit, type: 'Staking Return', date: serverTimestamp(),
                    });

                    if(stake.capitalBack) {
                        transaction.set(doc(collection(db, "investmentTransactions")), {
                            userId: user.uid, planName: stake.planName, amount: stake.amount, type: 'Staking Capital Back', date: serverTimestamp(),
                        });
                    }
                    
                    const stakeRef = doc(db, "userStakes", stake.id);
                    transaction.update(stakeRef, { status: 'completed' });
                    payoutsProcessed = true;
                }
            });

            if (payoutsProcessed) {
                toast({ title: "Staking Completed!", description: `${completedAutoStakes.length} staking plan(s) have matured and funds have been processed.` });
                fetchStakes();
            }

        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error processing stakes', description: error.message });
        }
    }, [user, db, stakes, toast, fetchStakes]);

    useEffect(() => {
        fetchStakes();
    }, [fetchStakes]);

    useEffect(() => {
        const interval = setInterval(() => {
            processCompletedStakes();
        }, 10000); // Check every 10 seconds
        return () => clearInterval(interval);
    }, [processCompletedStakes]);
    
    const handleManualClaim = async (stake: UserStake) => {
        if (!user || !db) return;
        setIsClaiming(stake.id);
        
        try {
             await runTransaction(db, async (transaction) => {
                const userRef = doc(db, "users", user.uid);
                const earningRulesDocRef = doc(db, "settings", "earningRules");

                const [userDoc, earningRulesDoc] = await Promise.all([
                    transaction.get(userRef),
                    transaction.get(earningRulesDocRef),
                ]);

                if (!userDoc.exists()) throw new Error("User not found.");

                const profit = stake.amount * stake.returnPercentage / 100;
                const capitalToReturn = stake.capitalBack ? stake.amount : 0;
                
                if(stake.stakeCurrency === 'ico_token') {
                    const currentTokenBalance = userDoc.data()?.tokenBalance || 0;
                    transaction.update(userRef, { tokenBalance: currentTokenBalance + profit + capitalToReturn });
                } else {
                    await addEarning(transaction, user.uid, profit, userDoc, earningRulesDoc, capitalToReturn);
                }

                transaction.set(doc(collection(db, "investmentTransactions")), {
                    userId: user.uid, planName: stake.planName, amount: profit, type: 'Staking Return (Manual)', date: serverTimestamp(),
                });
                
                if (stake.capitalBack) {
                    transaction.set(doc(collection(db, "investmentTransactions")), {
                        userId: user.uid, planName: stake.planName, amount: stake.amount, type: 'Staking Capital Back (Manual)', date: serverTimestamp(),
                    });
                }
                
                const stakeRef = doc(db, "userStakes", stake.id);
                transaction.update(stakeRef, { status: 'completed' });
            });
            
            toast({ title: 'Claim Successful!', description: `You have successfully claimed your stake return.` });
            fetchStakes();

        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Claim Failed', description: error.message });
        } finally {
            setIsClaiming(null);
        }
    };
    
    const handleEarlyUnstake = async (stake: UserStake) => {
        if (!user || !db) return;
        setIsUnstaking(stake.id);
        const userRef = doc(db, 'users', user.uid);
        try {
            const batch = writeBatch(db);
            const userDoc = await getDoc(userRef);
            let currentBalance = userDoc.data()?.balance || 0;
            let currentTokenBalance = userDoc.data()?.tokenBalance || 0;

            const feeAmount = (stake.amount * (stake.unstakeFeePercent || 0)) / 100;
            const returnAmount = stake.amount - feeAmount;

            if (stake.stakeCurrency === 'ico_token') {
                currentTokenBalance += returnAmount;
            } else {
                currentBalance += returnAmount;
            }
            
            batch.update(userRef, { balance: currentBalance, tokenBalance: currentTokenBalance });
            
            const stakeRef = doc(db, 'userStakes', stake.id);
            batch.update(stakeRef, { status: 'cancelled' });
            
            await batch.commit();
            toast({ title: 'Unstake Successful', description: `You have unstaked from ${stake.planName}.` });
            fetchStakes();
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Unstake Failed', description: error.message });
        } finally {
            setIsUnstaking(null);
        }
    };

    const formatAmount = (amount: number, currencyType: 'main' | 'token') => {
        const symbol = currencyType === 'main' ? currency.symbol : tokenData?.symbol || '';
        const position = currencyType === 'main' ? currency.position : 'right';
        const formattedValue = amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        return position === 'left' ? `${symbol}${formattedValue}` : `${formattedValue} ${symbol}`;
    }

    return (
        <DashboardLayout>
            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold font-headline tracking-tight">My Stakes</h1>
                    <p className="text-muted-foreground">An overview of all your ongoing and past staking plans.</p>
                </div>
                <Card>
                    <CardContent className="p-0">
                         {loading ? (
                            <div className="flex justify-center items-center p-16"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>
                        ) : stakes.length === 0 ? (
                            <div className="p-8 text-center text-muted-foreground">You have no active stakes.</div>
                        ) : (
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Plan</TableHead>
                                            <TableHead>Staked Amount</TableHead>
                                            <TableHead>Total Return</TableHead>
                                            <TableHead>End Date</TableHead>
                                            <TableHead>Status / Action</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {stakes.map(stake => {
                                            const profit = stake.amount * stake.returnPercentage / 100;
                                            const totalReturn = stake.capitalBack ? stake.amount + profit : profit;
                                            const endDate = new Date(stake.endDate.seconds * 1000);
                                            const isMatured = new Date() > endDate;
                                            const currencyType = stake.stakeCurrency === 'ico_token' ? 'token' : 'main';
                                            const feeAmount = (stake.amount * (stake.unstakeFeePercent || 0)) / 100;
                                            const returnOnUnstake = stake.amount - feeAmount;

                                            return (
                                                <TableRow key={stake.id}>
                                                    <TableCell className="font-medium">{stake.planName}</TableCell>
                                                    <TableCell>{formatAmount(stake.amount, currencyType)}</TableCell>
                                                    <TableCell className="font-semibold text-primary">{formatAmount(totalReturn, currencyType)}</TableCell>
                                                    <TableCell>{format(endDate, "PPp")}</TableCell>
                                                    <TableCell className="min-w-[200px] space-y-2">
                                                        {stake.status === 'active' && !isMatured && <Countdown startDate={new Date(stake.startDate.seconds * 1000)} endDate={endDate} />}
                                                        {stake.status === 'active' && isMatured && (
                                                            stake.payoutType === 'manual' ? (
                                                                <Button size="sm" onClick={() => handleManualClaim(stake)} disabled={isClaiming === stake.id}>
                                                                    {isClaiming === stake.id && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} Claim Now
                                                                </Button>
                                                            ) : <Badge>Processing...</Badge>
                                                        )}
                                                        {stake.status === 'completed' && <Badge variant="default" className="bg-green-500">Completed</Badge>}
                                                        {stake.status === 'cancelled' && <Badge variant="secondary">Cancelled</Badge>}
                                                        
                                                        {stake.status === 'active' && stake.earlyUnstakeEnabled && !isMatured && (
                                                            <AlertDialog>
                                                                <AlertDialogTrigger asChild>
                                                                    <Button variant="destructive" size="sm" disabled={isUnstaking === stake.id}>
                                                                        {isUnstaking === stake.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Ban className="mr-2 h-4 w-4" />}
                                                                        Unstake
                                                                    </Button>
                                                                </AlertDialogTrigger>
                                                                <AlertDialogContent>
                                                                    <AlertDialogHeader>
                                                                        <AlertDialogTitle>Are you sure you want to unstake early?</AlertDialogTitle>
                                                                        <AlertDialogDescription>
                                                                            An early unstake fee of {stake.unstakeFeePercent}% ({formatAmount(feeAmount, currencyType)}) will be applied. You will receive {formatAmount(returnOnUnstake, currencyType)} back. You will forfeit all future profits from this stake.
                                                                        </AlertDialogDescription>
                                                                    </AlertDialogHeader>
                                                                    <AlertDialogFooter>
                                                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                        <AlertDialogAction onClick={() => handleEarlyUnstake(stake)}>Yes, Unstake Early</AlertDialogAction>
                                                                    </AlertDialogFooter>
                                                                </AlertDialogContent>
                                                            </AlertDialog>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    );
}

    