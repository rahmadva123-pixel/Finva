
"use client";

import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { doc, getDoc, writeBatch, serverTimestamp, collection, query, where, getDocs, runTransaction, setDoc, DocumentSnapshot } from "firebase/firestore";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Progress } from "@/components/ui/progress";
import { addDays } from "date-fns";
import { addEarning } from "@/lib/earnings";

interface PoolPlan {
  id: string;
  poolName: string;
  totalAmount: number;
  minReturn: number;
  maxReturn: number;
  investedAmount?: number;
}

interface UserData {
    balance?: number;
    shareBalance?: number;
    tokenBalance?: number;
    totalEarning?: number;
    referredBy?: string;
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

export default function InvestPoolPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const params = useParams();
  const planId = params.planId as string;

  const [plan, setPlan] = useState<PoolPlan | null>(null);
  const [balance, setBalance] = useState(0);
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [currency, setCurrency] = useState<CurrencySettings>({ symbol: '$', position: 'left' });
  const [currentUserData, setCurrentUserData] = useState<UserData | null>(null);
  const [earningRules, setEarningRules] = useState<EarningRules | null>(null);

  useEffect(() => {
    if (!db || !user || !planId) {
        setLoading(false);
        return;
    };

    const fetchData = async () => {
      try {
        const planDoc = await getDoc(doc(db, "poolPlans", planId));
        if (planDoc.exists()) {
          const planData = { id: planDoc.id, ...planDoc.data() } as PoolPlan;
          
          const investmentsQuery = query(collection(db, 'userPoolInvestments'), where('poolId', '==', planId));
          const investmentsSnapshot = await getDocs(investmentsQuery);
          const totalInvested = investmentsSnapshot.docs.reduce((sum, doc) => sum + doc.data().amount, 0);
          planData.investedAmount = totalInvested;

          setPlan(planData);
        } else {
          toast({ variant: 'destructive', title: 'Error', description: 'Pool plan not found.' });
          router.push('/dashboard/pool/plans');
        }

        const userDoc = await getDoc(doc(db, "users", user.uid));
        if(userDoc.exists()) {
            const userData = userDoc.data() as UserData;
            setBalance(userData.balance || 0);
            setCurrentUserData(userData);
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
  
  const formatCurrency = (value: number) => {
    const amount = value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return currency.position === 'left' ? `${currency.symbol}${amount}` : `${amount}${currency.symbol}`;
  }

  const handleInvest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !user || !plan || !currentUserData) return;

    const investAmount = parseFloat(amount);
    if (isNaN(investAmount) || investAmount <= 0) {
        toast({ variant: 'destructive', title: 'Invalid Amount' });
        return;
    }
    
    const remainingToInvest = plan.totalAmount - (plan.investedAmount || 0);
    if (investAmount > remainingToInvest) {
        toast({ variant: 'destructive', title: 'Investment Too High', description: `You can invest a maximum of ${formatCurrency(remainingToInvest)} in this pool.` });
        return;
    }

    if (investAmount > balance) {
        toast({ variant: 'destructive', title: 'Insufficient Funds', description: `You do not have enough balance to make this investment.` });
        return;
    }

    setSubmitting(true);
    try {
        const investmentRef = doc(collection(db, 'userPoolInvestments'));
        
        await runTransaction(db, async (transaction) => {
            const userRef = doc(db, "users", user.uid);
            const userDoc = await transaction.get(userRef);
            if (!userDoc.exists()) throw new Error("User not found.");

            const currentData = userDoc.data() as UserData;
            
            transaction.set(investmentRef, {
                userId: user.uid,
                poolId: plan.id,
                poolName: plan.poolName,
                amount: investAmount,
                status: 'active',
                investedAt: serverTimestamp(),
            });

            let newShareBalance = currentData.shareBalance || 0;
            let newTokenBalance = currentData.tokenBalance || 0;

            if (earningRules?.sharesEnabled && earningRules.shareRatio > 0) {
                const sharesAwarded = Math.floor(investAmount / earningRules.shareRatio);
                if(sharesAwarded > 0) {
                    newShareBalance += sharesAwarded;
                    const shareTxRef = doc(collection(db, 'shareTransactions'));
                    transaction.set(shareTxRef, {
                        userId: user.uid,
                        amount: sharesAwarded,
                        source: 'pool',
                        description: `Awarded for investing in ${plan.poolName}`,
                        date: serverTimestamp(),
                    });
                }
            }
            
            if (earningRules?.tokensEnabled && earningRules.tokenRatio > 0) {
                const tokensAwarded = investAmount * earningRules.tokenRatio;
                if(tokensAwarded > 0) {
                    newTokenBalance += tokensAwarded;
                    const tokenTxRef = doc(collection(db, 'tokenTransactions'));
                    let expirationDate = null;
                     if (earningRules.tokenExpirationDays && !earningRules.expireTokensOnPowerUsed) {
                        expirationDate = addDays(new Date(), earningRules.tokenExpirationDays);
                    }
                    transaction.set(tokenTxRef, {
                        userId: user.uid,
                        amount: tokensAwarded,
                        source: investmentRef.id,
                        description: `Awarded for investing in ${plan.poolName}`,
                        date: serverTimestamp(),
                        expirationDate: expirationDate,
                    });
                }
            }
            
            if (earningRules?.isEnabled && earningRules.multiplier) {
                const powerGenerated = investAmount * earningRules.multiplier;
                if (powerGenerated > 0) {
                    const ledgerRef = doc(collection(db, 'earningPowerLedger'));
                    transaction.set(ledgerRef, {
                        userId: user.uid,
                        amount: powerGenerated,
                        used: 0,
                        status: 'active',
                        source: investmentRef.id,
                        date: serverTimestamp(),
                    });
                }
            }

            transaction.update(userRef, {
                balance: (currentData.balance || 0) - investAmount,
                shareBalance: newShareBalance,
                tokenBalance: newTokenBalance,
            });
        });

        toast({ title: 'Investment Successful!', description: `You have successfully invested in the ${plan.poolName} pool.` });
        router.push('/dashboard/pool/my-pools');

    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Investment Failed', description: error.message });
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

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="mr-2" /> Back to Plans
        </Button>
        <form onSubmit={handleInvest}>
            <Card>
                <CardHeader>
                    <CardTitle>Invest in {plan.poolName}</CardTitle>
                    <CardDescription>Confirm your investment details below.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="p-4 rounded-lg bg-muted flex justify-between items-center">
                        <span className="text-muted-foreground">Your Wallet Balance</span>
                        <span className="font-bold text-lg">{formatCurrency(balance)}</span>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="amount">Investment Amount ({currency.symbol})</Label>
                        <Input 
                            id="amount" 
                            type="number" 
                            value={amount} 
                            onChange={e => setAmount(e.target.value)} 
                            placeholder="0.00"
                            required 
                        />
                    </div>

                    <Card className="bg-muted/50">
                        <CardContent className="pt-6 text-sm space-y-2">
                            <div className="flex justify-between font-bold">
                                <span>Expected Return</span>
                                <span>{plan.minReturn}% - {plan.maxReturn}%</span>
                            </div>
                            <div className="space-y-2 pt-4">
                                <div className="flex justify-between text-xs">
                                  <span>Invested</span>
                                  <span>{formatCurrency(plan.investedAmount || 0)} / {formatCurrency(plan.totalAmount)}</span>
                                </div>
                                <Progress value={((plan.investedAmount || 0) / plan.totalAmount) * 100} />
                            </div>
                        </CardContent>
                    </Card>

                </CardContent>
                <CardFooter>
                    <Button type="submit" className="w-full" size="lg" disabled={submitting}>
                        {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Confirm & Invest Now
                    </Button>
                </CardFooter>
            </Card>
        </form>
      </div>
    </DashboardLayout>
  );
}
