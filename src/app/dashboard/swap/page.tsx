
"use client";

import React, { Suspense } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { doc, getDoc, runTransaction, collection, addDoc, serverTimestamp, query, where, getDocs } from "firebase/firestore";
import { ArrowLeft, Loader2, Repeat } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import Image from 'next/image';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface DigitalCurrency {
  id: string;
  name: string;
  symbol: string;
  iconUrl: string;
}

interface UserWallet {
  id: string;
  currencyId: string;
  currencySymbol: string;
  name: string;
  balance: number;
}

interface SwapPairSettings {
  rate: number;
  mainToDigitalFeePercent: number;
  digitalToMainFeePercent: number;
  enabled: boolean;
}

interface SwapSettings {
    isEnabled: boolean;
    mainCurrencySymbol: string;
    pairs: Record<string, Partial<SwapPairSettings>>;
}

function SwapPageContents() {
    const { user } = useAuth();
    const { toast } = useToast();
    const router = useRouter();
    const searchParams = useSearchParams();

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    
    const [swapSettings, setSwapSettings] = useState<SwapSettings | null>(null);
    const [mainBalance, setMainBalance] = useState(0);
    const [digitalWallets, setDigitalWallets] = useState<UserWallet[]>([]);
    const [allDigitalCurrencies, setAllDigitalCurrencies] = useState<DigitalCurrency[]>([]);
    
    const [fromCurrency, setFromCurrency] = useState('main'); // 'main' or currencyId
    const [toCurrency, setToCurrency] = useState(''); // currencyId or 'main'
    const [fromAmount, setFromAmount] = useState('');
    
    const [showConfirm, setShowConfirm] = useState(false);

    useEffect(() => {
        if (!db || !user) return;
        const fetchData = async () => {
            setLoading(true);
            try {
                const swapDoc = getDoc(doc(db, 'settings', 'swap'));
                const userDoc = getDoc(doc(db, 'users', user.uid));
                const walletsQuery = query(collection(db, 'digitalWallets'), where('userId', '==', user.uid));
                const walletsSnap = getDocs(walletsQuery);
                const digitalCurrenciesSnap = getDocs(query(collection(db, 'digitalCurrencies'), where('status', '==', 'active')));
                
                const [swapSnap, userSnap, walletsSnapshot, allCurrenciesSnap] = await Promise.all([swapDoc, userDoc, walletsSnap, digitalCurrenciesSnap]);

                if (swapSnap.exists()) {
                    setSwapSettings(swapSnap.data() as SwapSettings);
                }
                if (userSnap.exists()) {
                    setMainBalance(userSnap.data().balance || 0);
                }
                setDigitalWallets(walletsSnapshot.docs.map(d => ({id: d.id, ...d.data()} as UserWallet)));
                setAllDigitalCurrencies(allCurrenciesSnap.docs.map(d => ({id:d.id, ...d.data()} as DigitalCurrency)));
                
                const fromParam = searchParams.get('from');
                if (fromParam) {
                    setFromCurrency(fromParam);
                }

            } catch (error: any) {
                toast({ variant: 'destructive', title: 'Error', description: `Failed to load data: ${error.message}` });
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [user, toast, searchParams]);

    const fromOptions = useMemo(() => {
        const activeCurrencyIds = new Set(allDigitalCurrencies.map(c => c.id));
        const options = [{ value: 'main', label: `Main Wallet (${swapSettings?.mainCurrencySymbol})` }];
        digitalWallets
            .filter(wallet => activeCurrencyIds.has(wallet.currencyId))
            .forEach(wallet => {
                options.push({ value: wallet.currencyId, label: `${wallet.name} (${wallet.currencySymbol})` });
        });
        return options;
    }, [swapSettings, digitalWallets, allDigitalCurrencies]);

    const toOptions = useMemo(() => {
        if (!swapSettings || !swapSettings.pairs) return [];
        const activeCurrencyIds = new Set(allDigitalCurrencies.map(c => c.id));
        if (fromCurrency === 'main') {
            return digitalWallets
                .filter(wallet => activeCurrencyIds.has(wallet.currencyId) && swapSettings.pairs[wallet.currencyId]?.enabled)
                .map(wallet => ({ value: wallet.currencyId, label: `${wallet.name} (${wallet.currencySymbol})`}));
        } else {
             const pair = swapSettings.pairs[fromCurrency];
             if(pair?.enabled) {
                 return [{ value: 'main', label: `Main Wallet (${swapSettings.mainCurrencySymbol})` }];
             }
        }
        return [];
    }, [fromCurrency, swapSettings, digitalWallets, allDigitalCurrencies]);

    const handleFromCurrencyChange = (value: string) => {
        setFromCurrency(value);
        setToCurrency('');
        setFromAmount('');
    }
    
    const calculation = useMemo(() => {
        if (!fromAmount || !fromCurrency || !toCurrency || !swapSettings || !swapSettings.pairs) return null;

        const amount = parseFloat(fromAmount);
        if (isNaN(amount) || amount <= 0) return null;
        
        let rate = 1, feePercent = 0, toAmount = 0;
        
        if(fromCurrency === 'main') { // Main -> Digital
            const pair = swapSettings.pairs[toCurrency];
            if (!pair || !pair.rate) return null;
            rate = pair.rate;
            feePercent = pair.mainToDigitalFeePercent || 0;
            const fee = amount * (feePercent / 100);
            toAmount = (amount - fee) * rate;
        } else { // Digital -> Main
            const pair = swapSettings.pairs[fromCurrency];
            if (!pair || !pair.rate) return null;
            rate = 1 / pair.rate;
            feePercent = pair.digitalToMainFeePercent || 0;
            const fee = amount * (feePercent / 100);
            toAmount = (amount - fee) * rate;
        }
        
        const feeAmount = amount * (feePercent / 100);

        return {
            rate,
            feePercent,
            feeAmount,
            toAmount
        };

    }, [fromAmount, fromCurrency, toCurrency, swapSettings]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!calculation || !fromAmount) return;

        const amountNum = parseFloat(fromAmount);

        if(fromCurrency === 'main') {
            if (amountNum > mainBalance) {
                toast({ variant: 'destructive', title: 'Insufficient Balance' });
                return;
            }
        } else {
            const fromWallet = digitalWallets.find(w => w.currencyId === fromCurrency);
            if (!fromWallet || amountNum > fromWallet.balance) {
                toast({ variant: 'destructive', title: 'Insufficient Balance' });
                return;
            }
        }
        setShowConfirm(true);
    };
    
    const confirmSwap = async () => {
        if (!user || !db || !calculation || !fromAmount) return;
        setSubmitting(true);
        
        try {
            await runTransaction(db, async (transaction) => {
                const amountNum = parseFloat(fromAmount);
                const userRef = doc(db, 'users', user.uid);
                
                if (fromCurrency === 'main') {
                    // Main -> Digital
                    const toWalletRef = doc(db, 'digitalWallets', digitalWallets.find(w => w.currencyId === toCurrency)!.id);
                    
                    const userDoc = await transaction.get(userRef);
                    const toWalletDoc = await transaction.get(toWalletRef);

                    if (!userDoc.exists() || !toWalletDoc.exists()) throw new Error("Wallet not found");

                    const mainBal = userDoc.data().balance || 0;
                    if(amountNum > mainBal) throw new Error("Insufficient main balance");

                    transaction.update(userRef, { balance: mainBal - amountNum });
                    transaction.update(toWalletRef, { balance: (toWalletDoc.data().balance || 0) + calculation.toAmount });

                } else {
                    // Digital -> Main
                    const fromWalletRef = doc(db, 'digitalWallets', digitalWallets.find(w => w.currencyId === fromCurrency)!.id);
                     const userDoc = await transaction.get(userRef);
                    const fromWalletDoc = await transaction.get(fromWalletRef);

                    if (!userDoc.exists() || !fromWalletDoc.exists()) throw new Error("Wallet not found");
                    
                    const digitalBal = fromWalletDoc.data().balance || 0;
                    if(amountNum > digitalBal) throw new Error("Insufficient digital wallet balance");

                    transaction.update(userRef, { balance: (userDoc.data().balance || 0) + calculation.toAmount });
                    transaction.update(fromWalletRef, { balance: digitalBal - amountNum });
                }
                
                const swapHistoryRef = doc(collection(db, 'swapTransactions'));
                transaction.set(swapHistoryRef, {
                    userId: user.uid,
                    fromCurrency: fromCurrency === 'main' ? swapSettings?.mainCurrencySymbol : digitalWallets.find(w=>w.currencyId === fromCurrency)?.currencySymbol,
                    toCurrency: toCurrency === 'main' ? swapSettings?.mainCurrencySymbol : digitalWallets.find(w=>w.currencyId === toCurrency)?.currencySymbol,
                    fromAmount: amountNum,
                    toAmount: calculation.toAmount,
                    fee: calculation.feeAmount,
                    rate: calculation.rate,
                    date: serverTimestamp(),
                });
            });
            
            toast({title: "Swap Successful!", description: "Your balances have been updated."});
            router.push('/dashboard/swap/history');

        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Swap Failed', description: error.message });
        } finally {
            setSubmitting(false);
            setShowConfirm(false);
        }
    }
    
     const availablePairs = useMemo(() => {
        if (!swapSettings || !swapSettings.pairs || !allDigitalCurrencies.length) return [];
        return allDigitalCurrencies
            .filter(currency => swapSettings.pairs[currency.id]?.enabled)
            .map(currency => {
                const pair = swapSettings.pairs[currency.id];
                return {
                    ...currency,
                    rate: pair?.rate || 0
                }
            })
    }, [swapSettings, allDigitalCurrencies]);


    if (loading) {
        return (
            <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin"/></div>
        );
    }
    
    if (!swapSettings || !swapSettings.isEnabled) {
        return (
              <Card>
                <CardHeader>
                  <CardTitle>Feature Disabled</CardTitle>
                </CardHeader>
                <CardContent>
                  <p>The currency exchange is currently disabled.</p>
                </CardContent>
              </Card>
        );
    }

    return (
        <>
            <div className="max-w-md mx-auto space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Available Exchange Pairs</CardTitle>
                        <CardDescription>Current exchange rates for enabled pairs.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {availablePairs.length > 0 ? (
                            availablePairs.map(pair => (
                                <div key={pair.id} className="flex items-center justify-between p-3 border rounded-lg bg-muted/50">
                                    <div className="flex items-center gap-3 font-semibold">
                                        <Image src={pair.iconUrl} alt={pair.name} width={24} height={24} />
                                        <span>{swapSettings?.mainCurrencySymbol} / {pair.symbol}</span>
                                    </div>
                                    <div className="font-mono text-sm">
                                        1 {swapSettings?.mainCurrencySymbol} = {pair.rate} {pair.symbol}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-sm text-muted-foreground text-center">No exchange pairs are currently enabled.</p>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Swap Currency</CardTitle>
                        <CardDescription>Exchange between your main balance and digital currencies.</CardDescription>
                    </CardHeader>
                    <form onSubmit={handleSubmit}>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label>From</Label>
                            <Select value={fromCurrency} onValueChange={handleFromCurrencyChange}>
                                <SelectTrigger><SelectValue/></SelectTrigger>
                                <SelectContent>
                                    {fromOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                                </SelectContent>
                            </Select>
                             <p className="text-xs text-muted-foreground">Balance: {fromCurrency === 'main' ? mainBalance.toFixed(2) : (digitalWallets.find(w=>w.currencyId === fromCurrency)?.balance || 0).toFixed(2)}</p>
                        </div>

                         <div className="space-y-2">
                            <Label>To</Label>
                            <Select value={toCurrency} onValueChange={setToCurrency}>
                                <SelectTrigger><SelectValue placeholder="Select destination..."/></SelectTrigger>
                                <SelectContent>
                                    {toOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        
                        <div className="space-y-2">
                            <Label>Amount to Swap</Label>
                            <Input type="number" value={fromAmount} onChange={e => setFromAmount(e.target.value)} placeholder="0.00" />
                        </div>
                        
                        {calculation && (
                            <Card className="bg-muted/50 p-4 space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Fee ({calculation.feePercent}%)</span>
                                    <span>- {calculation.feeAmount.toFixed(4)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">You will receive approx.</span>
                                    <span className="font-bold text-primary">{calculation.toAmount.toFixed(4)}</span>
                                </div>
                            </Card>
                        )}
                        
                    </CardContent>
                    <CardFooter>
                        <Button className="w-full" type="submit" disabled={!calculation || submitting}>
                            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                            Swap Now
                        </Button>
                    </CardFooter>
                    </form>
                </Card>
            </div>
             <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Confirm Swap</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to proceed with this exchange? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmSwap} disabled={submitting}>
                            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                            Confirm & Swap
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}

export default function SwapPage() {
    return (
        <DashboardLayout>
            <Suspense fallback={
                <div className="flex items-center justify-center h-full">
                    <Loader2 className="h-8 w-8 animate-spin"/>
                </div>
            }>
                <SwapPageContents />
            </Suspense>
        </DashboardLayout>
    )
}
