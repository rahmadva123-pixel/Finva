

"use client";

import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { doc, getDoc, writeBatch, serverTimestamp, collection, addDoc, runTransaction, DocumentReference, getDocs, setDoc, DocumentSnapshot, query, where } from "firebase/firestore";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { addDays } from 'date-fns';
import { addEarning } from "@/lib/earnings";

interface StakingPlan {
  id: string;
  planName: string;
  minAmount: number;
  maxAmount: number;
  returnPercentage: number;
  durationDays: number;
  capitalBack: boolean;
  payoutType: 'auto' | 'manual';
  stakingFeePercent: number;
  earlyUnstakeEnabled: boolean;
  unstakeFeePercent: number;
}

interface UserData {
    balance?: number;
    referredBy?: string;
    shareBalance?: number;
    tokenBalance?: number;
    totalEarning?: number;
}

interface CurrencySettings {
  symbol: string;
  position: 'left' | 'right';
}

interface CommissionLevel {
  id: string;
  value: number;
  type: 'fixed' | 'percentage';
}

interface EarningRules {
    sharesEnabled: boolean;
    shareRatio: number;
    tokensEnabled: boolean;
    tokenName: string;
    tokenRatio: number;
    tokenExpirationDays?: number;
    expireTokensOnPowerUsed?: boolean;
    isEnabled?: boolean;
    multiplier?: number;
}

export default function InvestStakingPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const params = useParams();
  const planId = params.planId as string;

  const [plan, setPlan] = useState<StakingPlan | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [currency, setCurrency] = useState<CurrencySettings>({ symbol: '$', position: 'left' });
  const [earningRules, setEarningRules] = useState<EarningRules | null>(null);

  useEffect(() => {
    if (!db || !user || !planId) {
        setLoading(false);
        return;
    };

    const fetchData = async () => {
      try {
        const planDoc = await getDoc(doc(db, "stakingPlans", planId));
        if (planDoc.exists()) {
          setPlan({ id: planDoc.id, ...planDoc.data() } as StakingPlan);
        } else {
          toast({ variant: 'destructive', title: 'Error', description: 'Staking plan not found.' });
          router.push('/dashboard/staking/plans');
        }

        const userDoc = await getDoc(doc(db, "users", user.uid));
        if(userDoc.exists()) {
            setUserData(userDoc.data() as UserData);
        }

        const currencyDoc = await getDoc(doc(db, "settings", "currency"));
        if (currencyDoc.exists()) {
          setCurrency(currencyDoc.data() as CurrencySettings);
        }
        
        const earningRulesDoc = await getDoc(doc(db, "settings", "earningRules"));
        if (earningRulesDoc.exists()) {
            setEarningRules(earningRulesDoc.data() as EarningRules);
        }
        

      } catch (error: any) {
        toast({ variant: 'destructive', title: 'Error', description: `Failed to fetch data: ${error.message}` });
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();

  }, [planId, user, router, toast]);
  
  const formatAmount = (value: number) => {
      const symbol = currency.symbol;
      const position = currency.position;
      const formattedValue = value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      return position === 'left' ? `${symbol}${formattedValue}` : `${formattedValue} ${symbol}`;
  }

  const handleInvest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !user || !plan || !userData) return;

    const stakeAmount = parseFloat(amount);
    if (isNaN(stakeAmount)) {
        toast({ variant: 'destructive', title: 'Invalid Amount' });
        return;
    }
    
    if (stakeAmount < plan.minAmount || stakeAmount > plan.maxAmount) {
         toast({ variant: 'destructive', title: 'Invalid Amount', description: `Amount must be between ${plan.minAmount} and ${plan.maxAmount}` });
        return;
    }

    const feeAmount = (stakeAmount * (plan.stakingFeePercent || 0)) / 100;
    const totalDeducted = stakeAmount + feeAmount;
    const balanceToCheck = userData.balance || 0;

    if (totalDeducted > balanceToCheck) {
        toast({ variant: 'destructive', title: 'Insufficient Funds', description: `You do not have enough balance to cover the stake amount and fee.` });
        return;
    }

    setSubmitting(true);
    try {
        const stakeRef = doc(collection(db, 'userStakes'));
        const referralSettingsDoc = await getDoc(doc(db, 'settings', 'referral'));
        const earningRulesDoc = await getDoc(doc(db, "settings", "earningRules"));

        await runTransaction(db, async (transaction) => {
            const userRef = doc(db, "users", user.uid);
            const userDoc = await transaction.get(userRef);
            if (!userDoc.exists()) throw new Error("User not found.");
            
            const currentData = userDoc.data() as UserData;
            const now = new Date();
            const endDate = addDays(now, plan.durationDays);

            transaction.set(stakeRef, {
                userId: user.uid, planId: plan.id, planName: plan.planName,
                amount: stakeAmount, stakeCurrency: 'main_balance', status: 'active',
                startDate: serverTimestamp(), endDate: endDate, durationDays: plan.durationDays,
                returnPercentage: plan.returnPercentage, capitalBack: plan.capitalBack,
                payoutType: plan.payoutType, earlyUnstakeEnabled: plan.earlyUnstakeEnabled,
                unstakeFeePercent: plan.unstakeFeePercent,
            });
            
            let newShareBalance = currentData.shareBalance || 0;
            let newTokenBalance = currentData.tokenBalance || 0;

            if (earningRules?.sharesEnabled && earningRules.shareRatio > 0) {
                const sharesAwarded = Math.floor(stakeAmount / earningRules.shareRatio);
                if(sharesAwarded > 0) {
                    newShareBalance += sharesAwarded;
                    const shareTxRef = doc(collection(db, 'shareTransactions'));
                    transaction.set(shareTxRef, {
                        userId: user.uid, amount: sharesAwarded, source: 'staking',
                        description: `Awarded for staking in ${plan.planName}`, date: serverTimestamp(),
                    });
                }
            }
            
            if (earningRules?.tokensEnabled && earningRules.tokenRatio > 0) {
                const tokensAwarded = stakeAmount * earningRules.tokenRatio;
                if(tokensAwarded > 0) {
                    newTokenBalance += tokensAwarded;
                    const tokenTxRef = doc(collection(db, 'tokenTransactions'));
                    let expirationDate = null;
                     if (earningRules.tokenExpirationDays && !earningRules.expireTokensOnPowerUsed) {
                        expirationDate = addDays(new Date(), earningRules.tokenExpirationDays);
                    }
                    transaction.set(tokenTxRef, {
                        userId: user.uid, amount: tokensAwarded, source: stakeRef.id,
                        description: `Awarded for staking in ${plan.planName}`, date: serverTimestamp(), expirationDate: expirationDate,
                    });
                }
            }
            
            if (earningRules?.isEnabled && earningRules.multiplier) {
                const powerGenerated = stakeAmount * earningRules.multiplier;
                if (powerGenerated > 0) {
                    const ledgerRef = doc(collection(db, 'earningPowerLedger'));
                    transaction.set(ledgerRef, {
                        userId: user.uid, amount: powerGenerated, used: 0, status: 'active',
                        source: stakeRef.id, date: serverTimestamp(),
                    });
                }
            }

            transaction.update(userRef, {
                balance: (currentData.balance || 0) - totalDeducted,
                shareBalance: newShareBalance,
                tokenBalance: newTokenBalance,
            });

            // Legacy multi-level staking commission removed.
        });

        toast({ title: 'Stake Successful!', description: `You have successfully staked in the ${plan.planName} plan.` });
        router.push('/dashboard/staking/my-staking');

    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Staking Failed', description: error.message });
    } finally {
        setSubmitting(false);
    }
  };
  
  if (loading || !plan) {
    return (
        <DashboardLayout>
            <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        </DashboardLayout>
    )
  }
  
  const stakeAmountNum = parseFloat(amount);
  const feeAmount = !isNaN(stakeAmountNum) ? (stakeAmountNum * (plan.stakingFeePercent || 0)) / 100 : 0;
  const netStakeAmount = stakeAmountNum - feeAmount;
  const profit = !isNaN(stakeAmountNum) ? (netStakeAmount * plan.returnPercentage) / 100 : 0;
  const totalReturn = plan?.capitalBack && !isNaN(stakeAmountNum) ? profit + netStakeAmount : profit;
  const balance = userData?.balance || 0;


  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="mr-2" /> Back to Plans
        </Button>
        <form onSubmit={handleInvest}>
            <Card>
                <CardHeader>
                    <CardTitle>Stake in {plan.planName}</CardTitle>
                    <CardDescription>Confirm your staking details below.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="p-4 rounded-lg bg-muted flex justify-between items-center">
                        <span className="text-muted-foreground">Your Main Wallet Balance</span>
                        <span className="font-bold text-lg">{formatAmount(balance)}</span>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="amount">Staking Amount</Label>
                        <Input 
                            id="amount" 
                            type="number" 
                            value={amount} 
                            onChange={e => setAmount(e.target.value)} 
                            placeholder={`e.g., ${plan.minAmount}`}
                            required 
                        />
                        <p className="text-xs text-muted-foreground">
                            Min: {plan.minAmount} / Max: {plan.maxAmount}
                        </p>
                    </div>

                     {amount && !isNaN(stakeAmountNum) && stakeAmountNum > 0 && (
                        <Card className="bg-muted/50">
                            <CardContent className="pt-6 text-sm space-y-2">
                                 <div className="flex justify-between">
                                    <span className="text-muted-foreground">Staking Fee ({plan.stakingFeePercent}%)</span>
                                    <span>- {formatAmount(feeAmount)}</span>
                                 </div>
                                  <div className="flex justify-between font-semibold">
                                    <span className="text-muted-foreground">Net Stake Amount</span>
                                    <span>{formatAmount(netStakeAmount)}</span>
                                 </div>
                                <hr className="my-2" />
                                 <div className="flex justify-between">
                                    <span className="text-muted-foreground">Staking Period</span>
                                    <span>{plan.durationDays} Days</span>
                                 </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Profit ({plan.returnPercentage}%)</span>
                                    <span>+ {formatAmount(profit)}</span>
                                 </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Capital Back</span>
                                    <span>{plan.capitalBack ? `+ ${formatAmount(netStakeAmount)}` : 'No'}</span>
                                 </div>
                                 <hr className="my-2" />
                                 <div className="flex justify-between font-bold text-lg">
                                    <span>Total Return</span>
                                    <span className="text-primary">{formatAmount(totalReturn)}</span>
                                 </div>
                            </CardContent>
                        </Card>
                    )}

                </CardContent>
                <CardFooter>
                    <Button type="submit" className="w-full" size="lg" disabled={submitting}>
                        {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Confirm & Stake Now
                    </Button>
                </CardFooter>
            </Card>
        </form>
      </div>
    </DashboardLayout>
  );
}
