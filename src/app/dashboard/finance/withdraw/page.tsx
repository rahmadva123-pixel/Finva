
"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, Upload, FileImage, ArrowLeft, CheckCircle, XCircle, ChevronRight } from 'lucide-react';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, getDocs, addDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
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


    useEffect(() => {
        if (!user || !db) {
            setLoading(false);
            return;
        }

        const fetchInitialData = async () => {
            setLoading(true);
            try {
                 const firestore = db!;
                 const userDocRef = doc(firestore, 'users', user.uid);
                 const userDocSnap = await getDoc(userDocRef);
                 if (userDocSnap.exists()) {
                     setBalance(userDocSnap.data().balance || 0);
                     // ignore any stored per-user fee; platform default applies
                 }

                const cutoffMs = Date.now() - EARLY_WITHDRAWAL_DAYS * 24 * 60 * 60 * 1000;
                const depositsQuery = query(collection(firestore, "deposits"), where("userId", "==", user.uid));
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

                const methodsQuery = query(collection(firestore, 'withdrawMethods'), where('status', '==', 'active'));
                const methodsSnapshot = await getDocs(methodsQuery);
                setAllMethods(methodsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WithdrawMethod)));

                 const currencyDoc = await getDoc(doc(firestore, "settings", "currency"));
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

    const handleAmountSubmit = (e: React.FormEvent) => {
        e.preventDefault();
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
        setStep(1);
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

    const handleSinglePageSubmit = (e: React.FormEvent) => {
        e.preventDefault();
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
        const available = allMethods.filter(method => withdrawAmount >= method.minAmount && (method.unlimited || withdrawAmount <= method.maxAmount));
        if (available.length === 0) {
            toast({ variant: "destructive", title: "No Method Available", description: "No withdrawal method is available for this amount." });
            return;
        }
        setAvailableMethods(available);
        if (!selectedMethod || !available.some(method => method.id === selectedMethod.id)) {
            toast({ variant: "destructive", title: "Select a payout method", description: "Choose an available method before continuing." });
            return;
        }
        handleSubmit(e);
    }
    
    const handleConfirmRequest = async () => {
        if (!user || !db || !selectedMethod) return;
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

    if (loading) {
        return (
            <DashboardLayout>
                <div className="flex justify-center items-center p-8">
                    <Loader2 className="h-8 w-8 animate-spin" />
                </div>
            </DashboardLayout>
        )
    }

     const renderStep = () => {
                const withdrawAmountNum = parseFloat(amount) || 0;
                const earlyPrincipalAmount = Math.min(withdrawAmountNum, recentPrincipalAmount);
                const regularWithdrawalAmount = Math.max(0, withdrawAmountNum - earlyPrincipalAmount);
                const fee = Math.round(((earlyPrincipalAmount * (EARLY_WITHDRAWAL_FEE_PERCENTAGE / 100)) + (regularWithdrawalAmount * (REGULAR_WITHDRAWAL_FEE_PERCENTAGE / 100))) * 100) / 100;
                const feePercentageLabel = earlyPrincipalAmount > 0 && regularWithdrawalAmount === 0 ? `${EARLY_WITHDRAWAL_FEE_PERCENTAGE}%` : earlyPrincipalAmount > 0 ? `${EARLY_WITHDRAWAL_FEE_PERCENTAGE}% / ${REGULAR_WITHDRAWAL_FEE_PERCENTAGE}%` : `${REGULAR_WITHDRAWAL_FEE_PERCENTAGE}%`;

                return (
                    <Card className="overflow-hidden rounded-3xl border-border/80 shadow-sm">
                        <CardHeader className="border-b bg-[var(--topbar-background)] px-5 py-6 text-white sm:px-8">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary">Complete withdrawal</p>
                            <CardTitle className="mt-2 text-2xl tracking-tight">Withdrawal details</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6 p-5 sm:p-8">
                            <div className="rounded-2xl bg-primary/10 p-5">
                                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary dark:text-secondary">Available balance</p>
                                <div className="mt-2 flex items-end justify-between gap-4">
                                    <p className="text-3xl font-bold tracking-tight text-foreground">{formatCurrency(balance)}</p>
                                    <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-medium text-primary dark:bg-primary/30 dark:text-secondary">Main wallet</span>
                                </div>
                            </div>

                            <form onSubmit={handleSinglePageSubmit} className="space-y-6">
                                <div className="space-y-2">
                                    <Label htmlFor="single-page-amount" className="text-sm font-semibold">Amount to withdraw</Label>
                                    <div className="relative">
                                        <Input id="single-page-amount" type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" className="h-14 rounded-xl border-border pr-16 text-xl font-semibold shadow-none focus-visible:ring-primary" required />
                                        <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm font-semibold text-muted-foreground">{currency.symbol}</span>
                                    </div>
                                </div>

                                <div className="space-y-3 border-t pt-5">
                                    <div>
                                        <Label className="text-sm font-semibold">Payout method</Label>
                                    </div>
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        {allMethods.map(method => (
                                            <button key={method.id} type="button" onClick={() => handleSelectMethod(method)} className={cn("group flex items-center justify-between gap-3 rounded-2xl border p-4 text-left transition-all", selectedMethod?.id === method.id ? "border-primary bg-primary/10 ring-2 ring-primary/20" : "border-border/80 hover:border-primary hover:bg-primary/5")}>
                                                <span className="flex min-w-0 items-center gap-3">
                                                    {method.iconUrl ? <Image src={method.iconUrl} alt={method.name} width={40} height={40} className="rounded-xl" /> : <span className="h-10 w-10 shrink-0 rounded-xl bg-[var(--topbar-background)]" />}
                                                    <span className="min-w-0"><span className="block truncate text-sm font-semibold">{method.name}</span><span className="mt-1 block text-xs text-muted-foreground">{method.currency || 'Payout'} · {formatCurrency(method.minAmount)} min</span></span>
                                                </span>
                                                <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {selectedMethod && (
                                    <div className="space-y-5 border-t pt-5">
                                        <div className="grid gap-3 rounded-2xl bg-[var(--topbar-background)] p-5 text-white sm:grid-cols-2">
                                              <div><p className="text-xs uppercase tracking-wide text-slate-400">Requested</p><p className="mt-1 text-xl font-semibold">{formatCurrency(withdrawAmountNum)}</p></div>
                                            <div className="sm:text-right"><p className="text-xs uppercase tracking-wide text-slate-400">Fee · {feePercentageLabel}</p><p className="mt-1 text-xl font-semibold text-amber-300">{formatCurrency(fee)}</p></div>
                                        </div>
                                        {selectedMethod.fields.map(field => {
                                            const fieldName = field.label.replace(/\s+/g, '_').toLowerCase();
                                            return <div key={field.id} className="space-y-2">
                                                <Label htmlFor={`single-${fieldName}`}>{field.label} {field.required && <span className="text-destructive">*</span>}</Label>
                                                {field.type === 'textarea' ? <Textarea id={`single-${fieldName}`} value={formValues[fieldName] || ''} onChange={e => handleFormValueChange(field.label, e.target.value)} placeholder={`Enter your ${field.label}`} required={field.required} /> : <Input id={`single-${fieldName}`} type={field.type} value={formValues[fieldName] || ''} onChange={e => handleFormValueChange(field.label, e.target.value)} placeholder={`Enter your ${field.label}`} required={field.required} />}
                                            </div>;
                                        })}
                                    </div>
                                )}

                                <Button type="submit" className="h-12 w-full rounded-xl bg-[var(--topbar-background)] text-white hover:bg-primary dark:bg-secondary dark:text-secondary-foreground dark:hover:bg-secondary/80" disabled={submitting}>
                                    {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Review withdrawal
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                );

        /* Legacy multi-step renderer retained temporarily for reference; the single-page form above is the only active flow.
        switch (step) {
          case 1:
            return (
                            <Card className="overflow-hidden rounded-3xl border-border/80 shadow-sm">
                                <CardHeader className="border-b bg-[var(--topbar-background)] px-5 py-6 text-white sm:px-8">
                                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary">Step 1 of 3</p>
                                    <CardTitle className="mt-2 text-2xl tracking-tight">Choose your amount</CardTitle>
                                    <CardDescription className="text-slate-300">Move funds from your wallet to an available payout method.</CardDescription>
                </CardHeader>
                                <CardContent className="space-y-6 p-5 sm:p-8">
                                     <div className="rounded-2xl bg-primary/10 p-5 dark:bg-primary/10">
                                            <div className="flex items-end justify-between gap-4">
                                                <div>
                                                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary dark:text-secondary">Available balance</p>
                                                    <p className="mt-2 text-3xl font-bold tracking-tight text-foreground">{formatCurrency(balance)}</p>
                                                </div>
                                                <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-medium text-primary dark:bg-primary/30 dark:text-secondary">Main wallet</span>
                                            </div>
                  </div>
                                    <form onSubmit={handleAmountSubmit} className="space-y-6">
                                            <div className="space-y-2">
                                                    <Label htmlFor="amount" className="text-sm font-semibold">Amount to withdraw</Label>
                                                    <div className="relative">
                                                        <Input id="amount" type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" className="h-14 rounded-xl border-border pl-4 pr-16 text-xl font-semibold shadow-none focus-visible:ring-primary" required />
                                                        <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm font-semibold text-muted-foreground">{currency.symbol}</span>
                                                    </div>
                      </div>
                       {allMethods.length > 0 && (
                                                <div className="space-y-3 border-t pt-5">
                                                        <div>
                                                            <Label className="text-sm font-semibold">Available methods</Label>
                                                            <p className="mt-1 text-xs text-muted-foreground">Limits update automatically for each payout route.</p>
                                                        </div>
                            {allMethods.map(method => (
                                 <div key={method.id} className="flex items-center gap-4 rounded-2xl border border-border/80 p-4 transition-colors hover:border-primary/70 hover:bg-primary/5 dark:hover:bg-primary/10">
                                    {method.iconUrl ? <Image src={method.iconUrl} alt={method.name} width={40} height={40} className="rounded-xl" /> : <div className="h-10 w-10 rounded-xl bg-slate-900" />}
                                    <div>
                                        <p className="text-sm font-semibold">{method.name}</p>
                                        <p className="mt-1 text-xs text-muted-foreground">{formatCurrency(method.minAmount)} minimum · {method.unlimited ? 'No maximum' : `Up to ${formatCurrency(method.maxAmount)}`}</p>
                                    </div>
                                 </div>
                            ))}
                        </div>
                    )}
                    <Button type="submit" className="h-12 w-full rounded-xl bg-[var(--topbar-background)] text-white hover:bg-primary dark:bg-secondary dark:text-secondary-foreground dark:hover:bg-secondary/80">Continue to payout method</Button>
                  </form>
                </CardContent>
              </Card>
            );
          case 2:
            return (
                            <Card className="rounded-3xl border-border/80 shadow-sm">
                                <CardHeader className="border-b px-5 py-6 sm:px-8">
                   <div className="flex items-center gap-4">
                                         <Button variant="outline" size="icon" className="rounded-xl" onClick={() => setStep(1)}><ArrowLeft /></Button>
                     <div>
                                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Step 2 of 3</p>
                                                <CardTitle className="mt-1 text-2xl tracking-tight">Select payout method</CardTitle>
                        <CardDescription>You want to withdraw {formatCurrency(parseFloat(amount))}.</CardDescription>
                     </div>
                   </div>
                </CardHeader>
                <CardContent className="p-5 sm:p-8">
                    <div className="grid gap-3">
                        {availableMethods.map(method => (
                            <button 
                                key={method.id} 
                                onClick={() => handleSelectMethod(method)} 
                                className="group flex w-full items-center justify-between gap-4 rounded-2xl border border-border/80 p-5 text-left transition-all hover:-translate-y-0.5 hover:border-primary hover:bg-primary/5 hover:shadow-sm dark:hover:bg-primary/10"
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
                               <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary"/>
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
            <Card className="rounded-3xl border-border/80 shadow-sm">
                <CardHeader className="border-b px-5 py-6 sm:px-8">
                        <div className="flex items-center gap-4">
                                     <Button variant="outline" size="icon" className="rounded-xl" onClick={() => setStep(2)}><ArrowLeft /></Button>
                            <div>
                                         <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Step 3 of 3</p>
                                         <CardTitle className="mt-1 text-2xl tracking-tight">Confirm payout details</CardTitle>
                               <CardDescription>Fill out the required information for {selectedMethod.name}.</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                          <CardContent className="space-y-6 p-5 sm:p-8">
                                 <div className="grid gap-3 rounded-2xl bg-[var(--topbar-background)] p-5 text-white sm:grid-cols-2">
                                     <div><p className="text-xs uppercase tracking-wide text-slate-400">Requested</p><p className="mt-1 text-xl font-semibold">{formatCurrency(withdrawAmountNum)}</p></div>
                                     <div className="sm:text-right"><p className="text-xs uppercase tracking-wide text-slate-400">Fee · {feePercentageLabel}</p><p className="mt-1 text-xl font-semibold text-amber-300">{formatCurrency(fee)}</p></div>
                         </div>
                                 <form onSubmit={handleSubmit} className="space-y-5">
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
                            <Button type="submit" className="h-12 w-full rounded-xl bg-[var(--topbar-background)] text-white hover:bg-primary dark:bg-secondary dark:text-secondary-foreground dark:hover:bg-secondary/80" disabled={submitting}>
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
                */
      };
    
    return (
        <DashboardLayout>
            <div className="mx-auto max-w-5xl space-y-6">
                <div className="flex flex-col gap-4 rounded-3xl border border-border/80 bg-card/80 p-5 shadow-sm sm:flex-row sm:items-end sm:justify-between sm:p-7">
                    <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Wallet</p>
                                    <h1 className="mt-2 text-3xl font-bold tracking-tight">Withdraw funds</h1>
                    </div>
                    <span className="rounded-full bg-primary/10 px-4 py-2 text-xs font-semibold text-primary">One-page form</span>
                </div>
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

    