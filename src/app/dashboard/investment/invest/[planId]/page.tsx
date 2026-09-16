
"use client";

import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { doc, getDoc, writeBatch, serverTimestamp, collection, runTransaction, DocumentReference, getDocs, DocumentSnapshot, setDoc, addDoc } from "firebase/firestore";
import { ArrowLeft, Loader2, Info } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { addHours, addDays, addWeeks, addMonths, addYears } from 'date-fns';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import Link from "next/link";
import { addEarning } from "@/lib/earnings";

interface InvestmentPlan {
  id: string;
  planName: string;
  minAmount: number;
  maxAmount: number;
  investmentType: 'fixed' | 'range';
  interestRate: number;
  returnPeriod: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'lifetime';
  termDuration: number;
  capitalBack: boolean;
  featured: boolean;
  returnPayout: boolean;
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

interface ConfirmationSettings {
    showTermsCheckbox: boolean;
    infoBoxEnabled: boolean;
    infoBoxText: string;
    infoBoxBackgroundColor: string;
    infoBoxTextColor: string;
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

export default function InvestPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const params = useParams();
  const planId = params.planId as string;

  const [plan, setPlan] = useState<InvestmentPlan | null>(null);
  const [balance, setBalance] = useState(0);
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [currency, setCurrency] = useState<CurrencySettings>({ symbol: '$', position: 'left' });
  const [currentUserData, setCurrentUserData] = useState<UserData | null>(null);
  const [confirmationSettings, setConfirmationSettings] = useState<ConfirmationSettings | null>(null);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [earningRules, setEarningRules] = useState<EarningRules | null>(null);
  const [notificationSettings, setNotificationSettings] = useState<any>(null);

  useEffect(() => {
    if (!db || !user || !planId) {
        setLoading(false);
        return;
    };

    const fetchData = async () => {
      try {
        const planDoc = await getDoc(doc(db, "investmentPlans", planId));
        if (planDoc.exists()) {
          const planData = { id: planDoc.id, ...planDoc.data() } as InvestmentPlan;
          setPlan(planData);
          if (planData.investmentType === 'fixed') {
              setAmount(planData.minAmount.toString());
          }
        } else {
          toast({ variant: 'destructive', title: 'Error', description: 'Investment plan not found.' });
          router.push('/dashboard/investment');
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

        const settingsDoc = await getDoc(doc(db, 'settings', 'investment'));
        if (settingsDoc.exists()) {
            setConfirmationSettings(settingsDoc.data() as ConfirmationSettings);
        }

        const notificationSettingsDoc = await getDoc(doc(db, 'settings', 'notifications'));
        if (notificationSettingsDoc.exists()) {
            setNotificationSettings(notificationSettingsDoc.data());
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
  
  const getNextReturnDate = (startDate: Date, returnPeriod: InvestmentPlan['returnPeriod']): Date => {
      switch(returnPeriod) {
          case 'hourly': return addHours(startDate, 1);
          case 'daily': return addDays(startDate, 1);
          case 'weekly': return addWeeks(startDate, 1);
          case 'monthly': return addMonths(startDate, 1);
          case 'yearly': return addYears(startDate, 1);
          default: return startDate;
      }
  }

  const handleInvest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !user || !plan || !currentUserData) return;

    if (confirmationSettings?.showTermsCheckbox && !agreedToTerms) {
        toast({ variant: 'destructive', title: 'Agreement Required', description: 'You must agree to the terms and conditions.' });
        return;
    }

    const investAmount = parseFloat(amount);
    if (isNaN(investAmount)) {
        toast({ variant: 'destructive', title: 'Invalid Amount' });
        return;
    }
    
    if (plan.investmentType === 'fixed' && investAmount !== plan.minAmount) {
         toast({ variant: 'destructive', title: 'Invalid Amount', description: `This is a fixed plan. You must invest exactly ${formatCurrency(plan.minAmount)}` });
        return;
    }
    
    if (plan.investmentType === 'range' && (investAmount < plan.minAmount || investAmount > plan.maxAmount)) {
         toast({ variant: 'destructive', title: 'Invalid Amount', description: `Amount must be between ${formatCurrency(plan.minAmount)} and ${formatCurrency(plan.maxAmount)}` });
        return;
    }

    if (investAmount > balance) {
        toast({ variant: 'destructive', title: 'Insufficient Funds', description: `You do not have enough balance to make this investment.` });
        return;
    }

    setSubmitting(true);
    try {
        const investmentRef = doc(collection(db, 'userInvestments'));
        const referralSettingsDoc = await getDoc(doc(db, 'settings', 'referral'));
        const earningRulesDoc = await getDoc(doc(db, "settings", "earningRules"));

        await runTransaction(db, async (transaction) => {
            const userRef = doc(db, "users", user.uid);
            
            const userDoc = await transaction.get(userRef);
            if (!userDoc.exists()) throw new Error("User not found.");
            
            const refSettings = referralSettingsDoc.exists() ? referralSettingsDoc.data() : null;
            const directReferralProgramEnabled = refSettings?.directReferralProgramEnabled ?? true;
            
            const userData = userDoc.data() as UserData;
            const now = new Date();
            const nextReturnDate = plan.returnPeriod === 'lifetime' ? null : getNextReturnDate(now, plan.returnPeriod);

            transaction.set(investmentRef, {
                userId: user.uid,
                planId: plan.id,
                planName: plan.planName,
                amount: investAmount,
                status: 'active',
                startDate: serverTimestamp(),
                returnsCalculated: 0,
                termDuration: plan.termDuration,
                returnPeriod: plan.returnPeriod,
                interestRate: plan.interestRate,
                capitalBack: plan.capitalBack,
                returnPayout: plan.returnPayout,
                lastReturnDate: now,
                nextReturnDate: nextReturnDate,
            });

            let newShareBalance = userData.shareBalance || 0;
            let newTokenBalance = userData.tokenBalance || 0;
            
            const earningRulesData = earningRulesDoc.exists() ? earningRulesDoc.data() as EarningRules : null;

            if (earningRulesData?.sharesEnabled && earningRulesData.shareRatio > 0) {
                const sharesAwarded = Math.floor(investAmount / earningRulesData.shareRatio);
                if(sharesAwarded > 0) {
                    newShareBalance += sharesAwarded;
                    const shareTxRef = doc(collection(db, 'shareTransactions'));
                    transaction.set(shareTxRef, {
                        userId: user.uid, amount: sharesAwarded, source: 'investment',
                        description: `Awarded for investing in ${plan.planName}`, date: serverTimestamp(),
                    });
                }
            }
            
            if (earningRulesData?.tokensEnabled && earningRulesData.tokenRatio > 0) {
                const tokensAwarded = investAmount * earningRulesData.tokenRatio;
                if(tokensAwarded > 0) {
                    newTokenBalance += tokensAwarded;
                    const tokenTxRef = doc(collection(db, 'tokenTransactions'));
                    let expirationDate = null;
                    if (earningRulesData.tokenExpirationDays && !earningRulesData.expireTokensOnPowerUsed) {
                        expirationDate = addDays(new Date(), earningRulesData.tokenExpirationDays);
                    }
                    transaction.set(tokenTxRef, {
                        userId: user.uid, amount: tokensAwarded, source: investmentRef.id,
                        description: `Awarded for investing in ${plan.planName}`, date: serverTimestamp(), expirationDate: expirationDate,
                    });
                }
            }
            
            if (earningRulesData?.isEnabled && earningRulesData.multiplier) {
                const powerGenerated = investAmount * earningRulesData.multiplier;
                if (powerGenerated > 0) {
                    const ledgerRef = doc(collection(db, 'earningPowerLedger'));
                    transaction.set(ledgerRef, {
                        userId: user.uid, amount: powerGenerated, used: 0, status: 'active',
                        source: investmentRef.id, date: serverTimestamp(),
                    });
                }
            }

            transaction.update(userRef, {
                balance: (userData.balance || 0) - investAmount,
                shareBalance: newShareBalance,
                tokenBalance: newTokenBalance,
            });
            
            // Investment multi-level commission disabled — only deposit approval grants referral bonuses.
        });
        
        if (notificationSettings?.newInvestment) {
            await addDoc(collection(db, "notifications"), {
                userId: user.uid,
                title: "New Investment Started",
                description: `You successfully invested ${formatCurrency(investAmount)} in the ${plan.planName} plan.`,
                isRead: false,
                createdAt: serverTimestamp(),
                link: '/dashboard/investment/my-investment',
                type: 'newInvestment'
            });
        }


        toast({ title: 'Investment Successful!', description: `You have successfully invested in the ${plan.planName} plan.` });
        router.push('/dashboard/investment/my-investment');

    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Investment Failed', description: error.message });
    } finally {
        setSubmitting(false);
    }
  };

  const isLifetime = plan?.returnPeriod === 'lifetime' || plan?.termDuration === -1;
  const investAmount = parseFloat(amount);
  const profitPerReturn = investAmount && plan ? (investAmount * plan.interestRate) / 100 : 0;
  const totalProfit = profitPerReturn && plan ? profitPerReturn * (isLifetime ? 1 : plan.termDuration) : 0;
  const isButtonDisabled = submitting || (confirmationSettings?.showTermsCheckbox && !agreedToTerms);

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
                    <CardTitle>Invest in {plan.planName}</CardTitle>
                    <CardDescription>Confirm your investment details below.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="p-4 rounded-lg bg-muted flex justify-between items-center">
                        <span className="text-muted-foreground">Your Wallet Balance</span>
                        <span className="font-bold text-lg">{formatCurrency(balance)}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="space-y-1">
                            <p className="text-muted-foreground">Interest Rate</p>
                            <p className="font-semibold">{plan.interestRate}%</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-muted-foreground">Return Period</p>
                            <p className="font-semibold capitalize">{plan.returnPeriod}</p>
                        </div>
                         <div className="space-y-1">
                            <p className="text-muted-foreground">Term Duration</p>
                            <p className="font-semibold">{isLifetime ? 'Lifetime' : `${plan.termDuration} times`}</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-muted-foreground">Capital Back</p>
                            <p className="font-semibold">{plan.capitalBack ? 'Yes' : 'No'}</p>
                        </div>
                    </div>
                     <Separator />
                    <div className="space-y-2">
                        <Label htmlFor="amount">Investment Amount</Label>
                        {plan.investmentType === 'fixed' ? (
                            <Input id="amount" value={formatCurrency(plan.minAmount)} readOnly />
                        ) : (
                             <div className="relative">
                                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">{currency.position === 'left' ? currency.symbol : ''}</span>
                                <Input 
                                    id="amount" 
                                    type="number" 
                                    value={amount} 
                                    onChange={e => setAmount(e.target.value)} 
                                    placeholder={`e.g., ${plan.minAmount}`}
                                    className={currency.position === 'left' ? 'pl-8' : 'pr-8'}
                                    required 
                                />
                                <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground">{currency.position === 'right' ? currency.symbol : ''}</span>
                           </div>
                        )}
                        <p className="text-xs text-muted-foreground">
                            {plan.investmentType === 'fixed' 
                                ? `This is a fixed investment plan.`
                                : `Min: ${formatCurrency(plan.minAmount)} / Max: ${formatCurrency(plan.maxAmount)}`
                            }
                        </p>
                    </div>

                     {amount && !isNaN(investAmount) && investAmount > 0 && (
                        <Card className="bg-muted/50">
                            <CardContent className="pt-6 text-sm space-y-2">
                                 <div className="flex justify-between">
                                    <span className="text-muted-foreground">Profit per Return</span>
                                    <span>{formatCurrency(profitPerReturn)}</span>
                                 </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Number of Payments</span>
                                    <span>{isLifetime ? 'For a lifetime' : `${plan.termDuration} times`}</span>
                                 </div>
                                 <div className="flex justify-between font-bold">
                                    <span>Total Profit</span>
                                    <span>{isLifetime ? `${formatCurrency(profitPerReturn)} / per return` : formatCurrency(totalProfit)}</span>
                                 </div>
                            </CardContent>
                        </Card>
                    )}

                    {confirmationSettings?.infoBoxEnabled && (
                         <Alert style={{backgroundColor: confirmationSettings.infoBoxBackgroundColor, color: confirmationSettings.infoBoxTextColor, borderColor: confirmationSettings.infoBoxTextColor}}>
                            <Info className="h-4 w-4" style={{color: confirmationSettings.infoBoxTextColor}} />
                            <AlertTitle>Heads Up!</AlertTitle>
                            <AlertDescription>
                                {confirmationSettings.infoBoxText}
                            </AlertDescription>
                        </Alert>
                    )}

                    {confirmationSettings?.showTermsCheckbox && (
                        <div className="flex items-center space-x-2">
                            <Checkbox id="terms" checked={agreedToTerms} onCheckedChange={(checked) => setAgreedToTerms(checked as boolean)} />
                            <label
                                htmlFor="terms"
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                                I agree to the <Link href="/dashboard/terms" className="underline hover:text-primary">terms and conditions</Link>.
                            </label>
                        </div>
                    )}


                </CardContent>
                <CardFooter>
                    <Button type="submit" className="w-full" size="lg" disabled={isButtonDisabled}>
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
