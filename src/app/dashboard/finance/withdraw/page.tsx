
"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Info, Loader2, Share2, Upload, FileImage, ArrowLeft, CheckCircle, XCircle, ChevronRight } from 'lucide-react';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, getDocs, addDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

interface ReferralSettings {
    withdrawBlockEnabled?: boolean;
    withdrawBlockMessage?: string;
    withdrawBlockCount?: number;
}

interface FormField {
    id: string;
    label: string;
    type: 'text' | 'textarea' | 'number';
    required: boolean;
}

interface WithdrawMethod {
  id: string;
  name: string;
  minAmount: number;
  maxAmount: number;
  unlimited: boolean;
  fields: FormField[];
  iconUrl?: string;
  status: 'active' | 'inactive';
  currency?: string;
  rate?: number;
}

interface CurrencySettings {
  symbol: string;
  position: 'left' | 'right';
  usdtRate?: number;
}

const EARLY_WITHDRAWAL_DAYS = 60;
const REGULAR_WITHDRAWAL_FEE_PERCENTAGE = 20;
const EARLY_WITHDRAWAL_FEE_PERCENTAGE = 20;

export default function WithdrawPage() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [referralSettings, setReferralSettings] = useState<ReferralSettings | null>(null);
    const [referralCount, setReferralCount] = useState(0);
    const [legacyRequiresReferralToWithdraw, setLegacyRequiresReferralToWithdraw] = useState(false);
    const [legacyRequirementSetAt, setLegacyRequirementSetAt] = useState<any>(null);
    const [newReferralsSinceRequirement, setNewReferralsSinceRequirement] = useState(0);
    const [loading, setLoading] = useState(true);
    
    const [step, setStep] = useState(1);
    const [amount, setAmount] = useState("");
    const [allMethods, setAllMethods] = useState<WithdrawMethod[]>([]);
    const [availableMethods, setAvailableMethods] = useState<WithdrawMethod[]>([]);
    const [selectedMethod, setSelectedMethod] = useState<WithdrawMethod | null>(null);
    const [formValues, setFormValues] = useState<{[key: string]: string}>({});
    const [currency, setCurrency] = useState<CurrencySettings>({ symbol: '$', position: 'left' });
    const [balance, setBalance] = useState(0);
    // per-user withdrawal fee overrides disabled; platform enforces flat fee
    const [recentPrincipalAmount, setRecentPrincipalAmount] = useState(0);
    const [submitting, setSubmitting] = useState(false);
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const router = useRouter();


    useEffect(() => {
        if (!user || !db) {
            setLoading(false);
            return;
        }

        const fetchInitialData = async () => {
            setLoading(true);
            try {
                 const userDocRef = doc(db, 'users', user.uid);
                 const userDocSnap = await getDoc(userDocRef);
                 if (userDocSnap.exists()) {
                     setBalance(userDocSnap.data().balance || 0);
                     // ignore any stored per-user fee; platform default applies
                 }

                const settingsDocRef = doc(db, 'settings', 'referral');
                const settingsDocSnap = await getDoc(settingsDocRef);
                if (settingsDocSnap.exists()) {
                    setReferralSettings(settingsDocSnap.data() as ReferralSettings);
                }

                const referralsQuery = query(collection(db, "users"), where("referredBy", "==", user.uid));
                const referralsSnapshot = await getDocs(referralsQuery);
                setReferralCount(referralsSnapshot.size);

                // compute new referrals since legacy requirement (if applicable)
                const legacyReq = userDocSnap.data()?.legacyRequiresReferralToWithdraw === true;
                setLegacyRequiresReferralToWithdraw(Boolean(legacyReq));
                const setAt = userDocSnap.data()?.legacyReferralRequirementSetAt || null;
                setLegacyRequirementSetAt(setAt);
                if (legacyReq && setAt) {
                    // count referrals with referredAt >= setAt
                    let newCount = 0;
                    for (const r of referralsSnapshot.docs) {
                        const rd = r.data();
                        const referredAt = rd.referredAt || null;
                        if (!referredAt) continue;
                        const rMillis = referredAt.seconds ? referredAt.seconds * 1000 : new Date(referredAt).getTime();
                        const sMillis = setAt.seconds ? setAt.seconds * 1000 : new Date(setAt).getTime();
                        if (!isNaN(rMillis) && !isNaN(sMillis) && rMillis >= sMillis) newCount++;
                    }
                    setNewReferralsSinceRequirement(newCount);
                } else {
                    setNewReferralsSinceRequirement(0);
                }

                const cutoffMs = Date.now() - EARLY_WITHDRAWAL_DAYS * 24 * 60 * 60 * 1000;
                const depositsQuery = query(collection(db, "deposits"), where("userId", "==", user.uid));
                const depositsSnapshot = await getDocs(depositsQuery);
                const recentPrincipalTotal = depositsSnapshot.docs.reduce((sum, depositDoc) => {
                    const data = depositDoc.data();
                    const status = String(data.status || "").toLowerCase();
                    if (status !== "completed" && status !== "approved") return sum;

                    const completedAt = data.completedAt?.seconds ? new Date(data.completedAt.seconds * 1000) : null;
                    const createdAt = data.createdAt?.seconds ? new Date(data.createdAt.seconds * 1000) : null;
                    const depositDate = completedAt || createdAt;
                    if (!depositDate || depositDate.getTime() < cutoffMs) return sum;

                    return sum + Number(data.amount || 0);
                }, 0);
                setRecentPrincipalAmount(recentPrincipalTotal);

                const methodsQuery = query(collection(db, 'withdrawMethods'), where('status', '==', 'active'));
                const methodsSnapshot = await getDocs(methodsQuery);
                setAllMethods(methodsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WithdrawMethod)));

                 const currencyDoc = await getDoc(doc(db, "settings", "currency"));
                if (currencyDoc.exists()) {
                  setCurrency(currencyDoc.data() as CurrencySettings);
                }

            } catch (error) {
                console.error("Error fetching initial data:", error);
                toast({ variant: 'destructive', title: 'Error', description: 'Failed to load necessary data.'})
            } finally {
                setLoading(false);
            }
        };

        fetchInitialData();
    }, [user, toast]);

    // Referral lock removed — withdrawals are not blocked by referral status
    const [isWithdrawalBlocked, setIsWithdrawalBlocked] = useState<boolean>(true);
    const [withdrawalBlockedMessage, setWithdrawalBlockedMessage] = useState<string | undefined>(undefined);
    
    const handleAmountSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // Double-check eligibility from server before proceeding
        (async () => {
            if (!user || !db) return;
            try {
                const eligibility = await checkWithdrawalEligibility();
                if (eligibility.blocked) {
                    toast({ variant: 'destructive', title: 'Withdrawals Disabled', description: eligibility.message || 'You do not meet the withdrawal requirements.' });
                    return;
                }
            } catch (err) {
                console.error('Eligibility check failed', err);
            }
        })();
        const withdrawAmount = parseFloat(amount);
        if (isNaN(withdrawAmount) || withdrawAmount <= 0) {
            toast({ variant: "destructive", title: "Invalid Amount", description: "Please enter a valid amount > 0." });
            return;
        }
        if (withdrawAmount < 100) {
            toast({ variant: "destructive", title: "Minimum Withdrawal", description: "Minimum withdrawal amount is $100." });
            return;
        }
        if (withdrawAmount > balance) {
            toast({ variant: "destructive", title: "Insufficient Funds" });
            return;
        }
        const available = allMethods.filter(m => withdrawAmount >= m.minAmount && (m.unlimited || withdrawAmount <= m.maxAmount));
        if (available.length === 0) {
            toast({ variant: "destructive", title: "No Method Available", description: "No withdrawal method is available for this amount." });
            return;
        }
        setAvailableMethods(available);
        setStep(2);
    }
    
    const handleSelectMethod = (method: WithdrawMethod) => {
        setSelectedMethod(method);
        setStep(3);
    }

    const formatCurrency = (value: number, options: { currency?: string; position?: 'left' | 'right'; maxDecimals?: number } = {}) => {
        const { currency: symbol, position, maxDecimals } = options;
        const finalSymbol = symbol || currency.symbol;
        const finalPosition = position || currency.position;
        
        const isCrypto = ['BTC', 'ETH', 'USDT', 'LTC'].some(c => finalSymbol.toUpperCase().includes(c));
        const maximumFractionDigits = maxDecimals ?? (isCrypto ? 8 : 2);
        
        const num = value.toLocaleString(undefined, { 
            minimumFractionDigits: 2, 
            maximumFractionDigits 
        });

        return finalPosition === 'left' ? `${finalSymbol} ${num}` : `${num} ${finalSymbol}`;
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!selectedMethod) return;

        for (const field of selectedMethod.fields) {
            const fieldName = field.label.replace(/\s+/g, '_').toLowerCase();
            if (field.required && !formValues[fieldName]) {
                 toast({ variant: "destructive", title: "Details Required", description: `Please provide your ${field.label}.` });
                 return;
            }
        }

        setShowConfirmDialog(true);
    }
    
    const handleConfirmRequest = async () => {
        if (!user || !db || !selectedMethod) return;
        // Re-validate eligibility immediately before creating withdrawal
        try {
            const eligibility = await checkWithdrawalEligibility();
            if (eligibility.blocked) {
                toast({ variant: 'destructive', title: 'Withdrawals Disabled', description: eligibility.message || 'You do not meet the withdrawal requirements.' });
                return;
            }
        } catch (err) {
            console.error('Eligibility check failed', err);
        }
        setSubmitting(true);
        try {
            const withdrawAmount = parseFloat(amount);
            const idToken = await user.getIdToken();
            const res = await fetch('/api/withdrawals/request', {
                method: 'POST',
                headers: { 'content-type': 'application/json', authorization: `Bearer ${idToken}` },
                body: JSON.stringify({ amount: withdrawAmount, method: selectedMethod.name, details: formValues })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || 'Failed to submit withdrawal');

            setShowConfirmDialog(false);
            toast({ title: 'Success', description: `Your withdrawal request has been submitted. Withdrawal fee (${formatCurrency(data.fee || 0)}) will be deducted.`});
            // Reset state
            setStep(1);
            setAmount("");
            setFormValues({});
            setSelectedMethod(null);
            setAvailableMethods([]);
            setBalance(balance - withdrawAmount);
        } catch(error: any) {
            toast({ variant: 'destructive', title: 'Error', description: `Failed to submit request: ${error.message}`});
        } finally {
            setSubmitting(false);
        }
    }
    
    const handleFormValueChange = (fieldLabel: string, value: string) => {
        const fieldName = fieldLabel.replace(/\s+/g, '_').toLowerCase();
        setFormValues(prev => ({...prev, [fieldName]: value }));
    }

    // Server-checked eligibility helper
    const checkWithdrawalEligibility = async (): Promise<{ blocked: boolean; message?: string; }> => {
        if (!user) return { blocked: true, message: 'Not authenticated' };
        try {
            const idToken = await user.getIdToken();
            const res = await fetch('/api/withdrawals/eligibility', { headers: { authorization: `Bearer ${idToken}` } });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || 'Failed to check eligibility');
            return { blocked: Boolean(data.blocked), message: data.message };
        } catch (e: any) {
            console.error('Eligibility API failed', e);
            return { blocked: true, message: 'Failed to verify eligibility' };
        }
    }

    // Check eligibility on load and when user/referral data changes
    useEffect(() => {
        let mounted = true;
        (async () => {
            if (!user || !db) {
                if (mounted) setIsWithdrawalBlocked(true);
                return;
            }
            try {
                const res = await checkWithdrawalEligibility();
                if (mounted) {
                    setIsWithdrawalBlocked(Boolean(res.blocked));
                    setWithdrawalBlockedMessage(res.message);
                }
            } catch (e) {
                if (mounted) {
                    setIsWithdrawalBlocked(true);
                    setWithdrawalBlockedMessage('Failed to verify eligibility');
                }
            }
        })();
        return () => { mounted = false; };
    }, [user, referralCount, recentPrincipalAmount]);

    if (loading) {
        return (
            <DashboardLayout>
                <div className="flex justify-center items-center p-8">
                    <Loader2 className="h-8 w-8 animate-spin" />
                </div>
            </DashboardLayout>
        )
    }

     if (isWithdrawalBlocked) {
        return (
             <DashboardLayout>
                <div className="space-y-6 max-w-lg mx-auto">
                    <div>
                        <h1 className="text-3xl font-bold font-headline tracking-tight">Withdraw Funds</h1>
                        <p className="text-muted-foreground">Request a withdrawal from your wallet.</p>
                    </div>
                     <Card className="border-destructive">
                        <CardHeader>
                            <div className="flex items-center gap-4">
                               <div className="p-3 bg-destructive/10 rounded-full">
                                <Info className="h-6 w-6 text-destructive" />
                               </div>
                               <div>
                                <CardTitle className="text-destructive">Withdrawals Locked</CardTitle>
                                <CardDescription className="text-destructive/80">
                                    {withdrawalBlockedMessage || 'Withdrawals are currently locked.'}
                                 </CardDescription>
                               </div>
                            </div>
                        </CardHeader>
                        <CardContent className="text-center space-y-4">
                            <p className="text-lg">{withdrawalBlockedMessage || 'Withdrawals are locked for your account.'}</p>
                            <div className="p-4 bg-muted rounded-lg inline-block">
                                <p className="font-bold text-2xl">{referralCount} / 1</p>
                                <p className="text-sm text-muted-foreground">Your Referrals (need 1 with completed deposit)</p>
                            </div>
                            <div>
                               <Button asChild>
                                <Link href="/dashboard/referral">
                                    <Share2 className="mr-2"/>
                                    Get Referral Link
                                </Link>
                               </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </DashboardLayout>
        )
    }

     const renderStep = () => {
        switch (step) {
          case 1:
            return (
              <Card>
                <CardHeader>
                  <CardTitle>Withdraw Funds</CardTitle>
                  <CardDescription>Enter the amount you wish to withdraw.</CardDescription>
                </CardHeader>
                <CardContent>
                   <div className="p-4 rounded-lg bg-muted flex justify-between items-center mb-6">
                      <span className="text-muted-foreground">Your Wallet Balance</span>
                      <span className="font-bold text-lg">{formatCurrency(balance)}</span>
                  </div>
                  <form onSubmit={handleAmountSubmit} className="space-y-4">
                      <div className="space-y-2">
                          <Label htmlFor="amount">Amount to Withdraw</Label>
                          <Input id="amount" type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" required />
                      </div>
                       {allMethods.length > 0 && (
                        <div className="space-y-3 pt-4">
                            <Label>Available Methods & Limits</Label>
                            {allMethods.map(method => (
                                 <div key={method.id} className="flex items-center gap-4 p-3 border rounded-lg bg-muted/50">
                                    {method.iconUrl && <Image src={method.iconUrl} alt={method.name} width={40} height={40} className="rounded-md" />}
                                    <div>
                                        <p className="font-semibold text-sm">{method.name}</p>
                                        <p className="text-xs text-muted-foreground">Limit: {formatCurrency(method.minAmount)} - {method.unlimited ? 'Unlimited' : formatCurrency(method.maxAmount)}</p>
                                    </div>
                                 </div>
                            ))}
                        </div>
                    )}
                    <Button type="submit" className="w-full">Continue</Button>
                  </form>
                </CardContent>
              </Card>
            );
          case 2:
            return (
              <Card>
                <CardHeader>
                   <div className="flex items-center gap-4">
                     <Button variant="ghost" size="icon" onClick={() => setStep(1)}><ArrowLeft /></Button>
                     <div>
                        <CardTitle>Select Withdrawal Method</CardTitle>
                        <CardDescription>You want to withdraw {formatCurrency(parseFloat(amount))}.</CardDescription>
                     </div>
                   </div>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {availableMethods.map(method => (
                            <button 
                                key={method.id} 
                                onClick={() => handleSelectMethod(method)} 
                                className="w-full flex items-center justify-between gap-4 p-4 border rounded-lg hover:bg-muted transition-colors text-left"
                            >
                                <div className="flex items-center gap-4">
                                    {method.iconUrl && (
                                    <Image src={method.iconUrl} alt={method.name} width={48} height={48} className="rounded-md" />
                                    )}
                                    <div>
                                        <p className="font-semibold">{method.name}</p>
                                        <p className="text-sm text-muted-foreground">
                                            Receive in {method.currency}
                                        </p>
                                    </div>
                                </div>
                               <ChevronRight className="h-5 w-5 text-muted-foreground"/>
                            </button>
                        ))}
                    </div>
                </CardContent>
              </Card>
            );
           case 3:
            if (!selectedMethod) return null;
            const withdrawAmountNum = parseFloat(amount) || 0;
            const earlyPrincipalAmount = Math.min(withdrawAmountNum, recentPrincipalAmount);
            const regularWithdrawalAmount = Math.max(0, withdrawAmountNum - earlyPrincipalAmount);
            const fee = Math.round(((earlyPrincipalAmount * (EARLY_WITHDRAWAL_FEE_PERCENTAGE / 100)) + (regularWithdrawalAmount * (REGULAR_WITHDRAWAL_FEE_PERCENTAGE / 100))) * 100) / 100;
            const feePercentageLabel = earlyPrincipalAmount > 0 && regularWithdrawalAmount === 0 ? `${EARLY_WITHDRAWAL_FEE_PERCENTAGE}%` : earlyPrincipalAmount > 0 ? `${EARLY_WITHDRAWAL_FEE_PERCENTAGE}% / ${REGULAR_WITHDRAWAL_FEE_PERCENTAGE}%` : `${REGULAR_WITHDRAWAL_FEE_PERCENTAGE}%`;
            const amountInUSD = withdrawAmountNum / (currency.usdtRate || 1);
            const finalAmount = amountInUSD * (selectedMethod.rate || 1);

            return (
               <Card>
                    <CardHeader>
                        <div className="flex items-center gap-4">
                            <Button variant="ghost" size="icon" onClick={() => setStep(2)}><ArrowLeft /></Button>
                            <div>
                               <CardTitle>Provide Withdrawal Details</CardTitle>
                               <CardDescription>Fill out the required information for {selectedMethod.name}.</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                         <div className="p-4 rounded-lg bg-muted text-center mb-6 space-y-2">
                            <p className="text-sm text-muted-foreground">Withdrawal Amount: <span className="font-semibold">{formatCurrency(withdrawAmountNum)}</span></p>
                            <p className="text-sm text-yellow-700">Withdrawal Fee ({feePercentageLabel}): <span className="font-semibold">{formatCurrency(fee)}</span></p>
                         </div>
                         <form onSubmit={handleSubmit} className="space-y-4">
                            {selectedMethod.fields.map(field => {
                                const fieldName = field.label.replace(/\s+/g, '_').toLowerCase();
                                return (
                                <div key={field.id} className="space-y-2">
                                    <Label htmlFor={fieldName}>{field.label} {field.required && <span className="text-destructive">*</span>}</Label>
                                    {field.type === 'textarea' ? (
                                        <Textarea 
                                            id={fieldName}
                                            value={formValues[fieldName] || ''}
                                            onChange={e => handleFormValueChange(field.label, e.target.value)}
                                            placeholder={`Enter your ${field.label}`}
                                            required={field.required}
                                        />
                                    ) : (
                                        <Input
                                            id={fieldName}
                                            type={field.type}
                                            value={formValues[fieldName] || ''}
                                            onChange={e => handleFormValueChange(field.label, e.target.value)}
                                            placeholder={`Enter your ${field.label}`}
                                            required={field.required}
                                        />
                                    )}
                                </div>
                            )})}
                            <Button type="submit" className="w-full" disabled={submitting}>
                                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                                Submit Request
                            </Button>
                         </form>
                    </CardContent>
                </Card>
             );
          default:
            return null;
        }
      };
    
    return (
        <DashboardLayout>
            <div className="space-y-6 max-w-lg mx-auto">
                {renderStep()}
            </div>
             <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            You are about to request a withdrawal of {formatCurrency(parseFloat(amount) || 0)}. <br />
                            <span className="text-destructive font-semibold">A withdrawal fee will be deducted from your withdrawal.</span> <br />
                            This amount will be deducted from your balance and held until the request is processed.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmRequest} disabled={submitting}>
                            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                            Yes, Withdraw
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </DashboardLayout>
    );
}

    