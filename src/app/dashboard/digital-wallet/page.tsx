
"use client";

import React, { Suspense } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogClose, DialogFooter } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { db, auth } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, getDoc, addDoc, serverTimestamp, writeBatch, setDoc, onSnapshot } from "firebase/firestore";
import { useEffect, useState, useCallback, useMemo } from "react";
import { Loader2, Plus, ArrowRight, Wallet, History, ArrowLeftRight, Search, Eye, BarChart2, Repeat, ArrowDown, ArrowUp, Send as SendIcon, ChevronRight } from "lucide-react";
import Image from 'next/image';
import Link from "next/link";
import { getAuth, reauthenticateWithCredential, EmailAuthProvider, onAuthStateChanged, User } from "firebase/auth";
import { useRouter, useSearchParams } from "next/navigation";
import { addDays, format, startOfDay } from 'date-fns';
import * as LucideIcons from 'lucide-react';
import { cn } from "@/lib/utils";

interface DigitalCurrency {
  id: string;
  name: string;
  symbol: string;
  iconUrl: string;
  rate?: number;
  status?: 'active' | 'inactive'; // Added status
}

interface UserWallet {
  id: string;
  currencyId: string;
  currencySymbol: string;
  currencyIconUrl?: string;
  iconName?: string; // For Lucide icons
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


const ActionDialog = ({ title, wallets, onSelect, open, onOpenChange }: { title: string, wallets: UserWallet[], onSelect: (walletId: string, isMain: boolean) => void, open: boolean, onOpenChange: (open: boolean) => void }) => {
    const [searchTerm, setSearchTerm] = useState("");

    const filteredWallets = wallets.filter(w =>
        w.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        w.currencySymbol.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Select a currency to {title.toLowerCase()}</DialogTitle>
                </DialogHeader>
                <div className="py-4">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search by name or symbol..."
                            className="pl-8"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="mt-4 space-y-2 max-h-60 overflow-y-auto">
                        {filteredWallets.map(wallet => {
                            const Icon = (LucideIcons as any)[wallet.iconName || 'Wallet'];
                            return (
                            <button key={wallet.id} onClick={() => { onSelect(wallet.id, wallet.currencyId === 'main'); onOpenChange(false); }} className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-muted">
                                {wallet.iconName ? <Icon className="h-8 w-8" /> : <Image src={wallet.currencyIconUrl!} alt={wallet.name} width={32} height={32} />}
                                <div>
                                    <p className="font-semibold text-left">{wallet.name}</p>
                                    <p className="text-xs text-muted-foreground text-left">{wallet.currencySymbol}</p>
                                </div>
                            </button>
                        )})}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}

function DigitalWalletPageContents() {
    const { user } = useAuth();
    const { toast } = useToast();
    const router = useRouter();
    const searchParams = useSearchParams();

    const [mainWalletData, setMainWalletData] = useState<{balance: number; name: string; symbol: string; icon: string;}>({balance: 0, name: 'Main Wallet', symbol: '$', icon: 'Wallet'});
    const [digitalWallets, setDigitalWallets] = useState<UserWallet[]>([]);
    const [allDigitalCurrencies, setAllDigitalCurrencies] = useState<DigitalCurrency[]>([]);
    const [swapSettings, setSwapSettings] = useState<SwapSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [canDeposit, setCanDeposit] = useState(false);
    
    // Dialog states
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [isDepositDialogOpen, setIsDepositDialogOpen] = useState(false);
    const [isSendDialogOpen, setIsSendDialogOpen] = useState(false);

    const [selectedCurrency, setSelectedCurrency] = useState<DigitalCurrency | null>(null);
    const [walletName, setWalletName] = useState("");
    const [password, setPassword] = useState("");
    const [isCreating, setIsCreating] = useState(false);
    
    const [pnlData, setPnlData] = useState({ pnl24h: 0, percentageChange: 0, isLoading: true });

    // Fetch static or infrequently changing data
    useEffect(() => {
        if (!user || !db) return;

        const fetchStaticData = async () => {
            try {
                const [currenciesSnap, swapSnap, currencySnap] = await Promise.all([
                    getDocs(query(collection(db, 'digitalCurrencies'), where('status', '==', 'active'))),
                    getDoc(doc(db, 'settings', 'swap')),
                    getDoc(doc(db, 'settings', 'currency'))
                ]);

                setAllDigitalCurrencies(currenciesSnap.docs.map(d => ({ id: d.id, ...d.data() } as DigitalCurrency)));
                if (swapSnap.exists()) setSwapSettings(swapSnap.data() as SwapSettings);
                if (currencySnap.exists()) {
                    const data = currencySnap.data();
                    setMainWalletData(prev => ({
                        ...prev,
                        name: data.mainWalletName || 'Main Wallet',
                        symbol: data.symbol || '$',
                        icon: data.mainWalletIcon || 'Wallet'
                    }));
                }
            } catch (error) {
                 toast({ variant: 'destructive', title: 'Error', description: 'Failed to load page settings.' });
            }
        };

        const calculatePNL = async () => {
            // PNL Calculation
            const now = new Date();
            const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            const prev48h = new Date(now.getTime() - 48 * 60 * 60 * 1000);
            let earningsLast24h = 0;
            let earningsPrev24h = 0;
            
            const queries = [
                query(collection(db, "investmentTransactions"), where("userId", "==", user.uid), where("type", "in", ["Profit Return (Auto)", "Profit Return (Manual)"])),
                query(collection(db, "userStakes"), where("userId", "==", user.uid), where("status", "==", "completed")),
                query(collection(db, "userPoolInvestments"), where("userId", "==", user.uid), where("status", "==", "completed")),
                query(collection(db, "bonusTransactions"), where("userId", "==", user.uid)),
                query(collection(db, "referralCommissions"), where("referrerId", "==", user.uid)),
            ];

            const results = await Promise.all(queries.map(q => getDocs(q)));
            
            results[0].forEach(doc => {
                const data = doc.data();
                if(!data.date) return;
                const date = data.date.toDate();
                if (date >= last24h) earningsLast24h += data.amount;
                else if (date >= prev48h) earningsPrev24h += data.amount;
            });
            results[1].forEach(doc => {
                const data = doc.data();
                 if(!data.endDate) return;
                const date = data.endDate.toDate();
                const profit = data.amount * data.returnPercentage / 100;
                if (date >= last24h) earningsLast24h += profit;
                else if (date >= prev48h) earningsPrev24h += profit;
            });
            results[2].forEach(doc => {
                const data = doc.data();
                if(!data.returnDate) return;
                const date = new Date(data.returnDate);
                const profit = (data.returnAmount || 0) - (data.amount || 0);
                if (profit > 0) {
                    if (date >= last24h) earningsLast24h += profit;
                    else if (date >= prev48h) earningsPrev24h += profit;
                }
            });
            results[3].forEach(doc => {
                const data = doc.data();
                 if(!data.date) return;
                const date = data.date.toDate();
                if (date >= last24h) earningsLast24h += data.amount;
                else if (date >= prev48h) earningsPrev24h += data.amount;
            });
            results[4].forEach(doc => {
                const data = doc.data();
                 if(!data.date) return;
                const date = data.date.toDate();
                if (date >= last24h) earningsLast24h += data.amount;
                else if (date >= prev48h) earningsPrev24h += data.amount;
            });
            
            const percentageChange = earningsPrev24h > 0 ? ((earningsLast24h - earningsPrev24h) / earningsPrev24h) * 100 : (earningsLast24h > 0 ? 100 : 0);
            setPnlData({ pnl24h: earningsLast24h, percentageChange, isLoading: false });
        }

        fetchStaticData();
        calculatePNL();

    }, [user, toast]);

    // Set up real-time listeners for dynamic data
    useEffect(() => {
        if (!user || !db) {
            setLoading(false);
            return;
        }
        
        setLoading(true);

        const unsubUser = onSnapshot(doc(db, "users", user.uid), (doc) => {
            const userData = doc.data();
            setMainWalletData(prev => ({ ...prev, balance: userData?.balance || 0 }));
            setCanDeposit(userData?.verificationStatus === 'verified');
            setLoading(false);
        }, (error) => {
            console.error("Error listening to user document: ", error);
            setLoading(false);
        });

        const q = query(collection(db, 'digitalWallets'), where('userId', '==', user.uid));
        const unsubWallets = onSnapshot(q, (snapshot) => {
            setDigitalWallets(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as UserWallet)));
        }, (error) => {
            console.error("Error listening to digital wallets: ", error);
        });

        return () => {
            unsubUser();
            unsubWallets();
        };
    }, [user]);

    // Memoize combined wallet list
    const wallets = useMemo(() => {
        const mainWallet: UserWallet = {
            id: 'main-wallet',
            currencyId: 'main',
            balance: mainWalletData.balance,
            name: mainWalletData.name,
            currencySymbol: mainWalletData.symbol,
            iconName: mainWalletData.icon
        };
        const activeCurrencyIds = new Set(allDigitalCurrencies.map(c => c.id));
        const activeDigitalWallets = digitalWallets.filter(w => activeCurrencyIds.has(w.currencyId));

        return [mainWallet, ...activeDigitalWallets];
    }, [mainWalletData, digitalWallets, allDigitalCurrencies]);

    // Memoize available currencies
    const availableCurrencies = useMemo(() => {
        const createdCurrencyIds = new Set(digitalWallets.map(w => w.currencyId));
        return allDigitalCurrencies.filter(c => !createdCurrencyIds.has(c.id));
    }, [digitalWallets, allDigitalCurrencies]);

    // Memoize total balance
    const totalBalanceUSD = useMemo(() => {
        let total = mainWalletData.balance;
        if (swapSettings) {
            digitalWallets.forEach(wallet => {
                const rate = swapSettings.pairs[wallet.currencyId]?.rate || 1;
                total += (wallet.balance / rate);
            });
        } else {
             digitalWallets.forEach(wallet => {
                 total += wallet.balance; // Fallback if no swap settings
             });
        }
        return total;
    }, [mainWalletData.balance, digitalWallets, swapSettings]);

    
    useEffect(() => {
        const fromParam = searchParams.get('from');
        if (fromParam) {
            router.replace('/dashboard/swap');
        }
    }, [searchParams, router]);

    const openCreateDialog = (currency: DigitalCurrency) => {
        setSelectedCurrency(currency);
        setWalletName('');
        setPassword('');
        setIsCreateDialogOpen(true);
    }

    const handleCreateWallet = async () => {
        if (!selectedCurrency || !walletName || !password || !user) return;
        setIsCreating(true);
        try {
            const authInstance = getAuth();
            const currentUser = authInstance.currentUser;
            if (!currentUser || !currentUser.email) throw new Error("Please log in again.");

            const credential = EmailAuthProvider.credential(currentUser.email, password);
            await reauthenticateWithCredential(currentUser, credential);

            const walletRef = doc(collection(db, 'digitalWallets'));
            await setDoc(walletRef, {
                userId: currentUser.uid,
                currencyId: selectedCurrency.id,
                currencySymbol: selectedCurrency.symbol,
                currencyIconUrl: selectedCurrency.iconUrl,
                name: walletName,
                balance: 0,
                createdAt: serverTimestamp()
            });

            toast({ title: 'Success!', description: `${selectedCurrency.name} wallet created.` });
            setIsCreateDialogOpen(false);

        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Creation Failed', description: e.message });
        } finally {
            setIsCreating(false);
        }
    }

    const handleActionSelect = (walletId: string, isMain: boolean) => {
        const action = isDepositDialogOpen ? 'deposit' : 'send';
        
        if (isMain) {
            const path = action === 'deposit' ? '/dashboard/finance/deposit' : '/dashboard/finance/send';
            router.push(path);
        } else {
            const path = action === 'deposit' ? `/dashboard/digital-wallet/deposit/${walletId}` : `/dashboard/digital-wallet/send/${walletId}`;
            router.push(path);
        }
    };

    const filteredWallets = wallets.filter(w =>
        w.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        w.currencySymbol.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getUsdValue = (balance: number, currencyId: string) => {
        if (currencyId === 'main') return balance;
        const rate = swapSettings?.pairs[currencyId]?.rate || 1;
        return balance / rate;
    };
    
     const formatCurrencyDisplay = (value: number, symbol?: string, position?: 'left'|'right') => {
        const sym = symbol || swapSettings?.mainCurrencySymbol || '$';
        const pos = position || 'left';
        const formattedValue = value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        return pos === 'left' ? `${sym}${formattedValue}` : `${formattedValue}${sym}`;
    }
    
    if (loading) {
        return (
            <DashboardLayout>
                <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin"/></div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout>
            <div className="space-y-6">
                 <Card>
                    <CardHeader>
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2 text-muted-foreground">
                                <CardDescription>Est. Total Value</CardDescription>
                                <Eye className="h-4 w-4" />
                            </div>
                            <div className="flex items-center gap-2">
                                <Button variant="ghost" size="icon" asChild>
                                    <Link href="/dashboard/finance/wallet">
                                        <BarChart2 className="h-5 w-5 text-muted-foreground" />
                                    </Link>
                                </Button>
                                <Button variant="ghost" size="icon" asChild>
                                    <Link href="/dashboard/digital-wallet/history">
                                        <History className="h-5 w-5 text-muted-foreground" />
                                    </Link>
                                </Button>
                            </div>
                        </div>
                        <div>
                             <CardTitle className="text-4xl">${totalBalanceUSD.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} <span className="text-xl font-medium text-muted-foreground">USD</span></CardTitle>
                             <Button variant="ghost" className="h-auto p-1 text-right" asChild>
                                <Link href="/dashboard/finance/wallet">
                                    <p className={`text-sm flex items-center ${pnlData.pnl24h >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                        Today's PNL {pnlData.pnl24h >= 0 ? '+' : ''}{formatCurrencyDisplay(pnlData.pnl24h)} ({pnlData.percentageChange.toFixed(2)}%)
                                        <ChevronRight className="h-4 w-4 ml-1" />
                                    </p>
                                </Link>
                            </Button>
                        </div>
                    </CardHeader>
                     <CardFooter className="grid grid-cols-3 gap-2">
                        <Button className="bg-primary hover:bg-primary/90" onClick={() => canDeposit ? setIsDepositDialogOpen(true) : router.push('/verification')}>
                            {canDeposit ? 'Add Funds' : 'Verify ID'}
                        </Button>
                        <Button variant="secondary" onClick={() => setIsSendDialogOpen(true)}>Send</Button>
                        <Button variant="secondary" asChild><Link href="/dashboard/swap">Transfer</Link></Button>
                    </CardFooter>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Assets</CardTitle>
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search by name or symbol..."
                                className="pl-8"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {filteredWallets.map(wallet => {
                            const Icon = (LucideIcons as any)[wallet.iconName || 'Wallet'];
                            return (
                                <div key={wallet.id} className="p-3 border rounded-lg hover:bg-muted transition-colors">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            {wallet.iconName ? <Icon className="h-10 w-10 text-primary" /> : <Image src={wallet.currencyIconUrl!} alt={wallet.name} width={40} height={40}/>}
                                            <div>
                                                <p className="font-bold">{wallet.name}</p>
                                                <p className="text-sm text-muted-foreground">{wallet.currencySymbol}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-bold">{wallet.balance.toLocaleString(undefined, { maximumFractionDigits: wallet.currencyId === 'main' ? 2 : 8 })}</p>
                                            <p className="text-sm text-muted-foreground">${getUsdValue(wallet.balance, wallet.currencyId).toFixed(2)}</p>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2 mt-3">
                                        {canDeposit ? (
                                            <Button size="sm" variant="outline" asChild><Link href={wallet.currencyId === 'main' ? '/dashboard/finance/deposit' : `/dashboard/digital-wallet/deposit/${wallet.id}`}>Deposit</Link></Button>
                                        ) : (
                                            <Button size="sm" variant="outline" onClick={() => router.push('/verification')}>Verify ID</Button>
                                        )}
                                        <Button size="sm" variant="outline" asChild><Link href={wallet.currencyId === 'main' ? '/dashboard/finance/send' : `/dashboard/digital-wallet/send/${wallet.id}`}>Send</Link></Button>
                                        <Button size="sm" variant="outline" asChild><Link href={`/dashboard/swap`}>Swap</Link></Button>
                                    </div>
                                </div>
                            )
                        })}
                         {availableCurrencies.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()) || c.symbol.toLowerCase().includes(searchTerm.toLowerCase())).map(currency => (
                            <div key={currency.id} className="p-3 border border-dashed rounded-lg flex items-center justify-between">
                                 <div className="flex items-center gap-3">
                                    <Image src={currency.iconUrl} alt={currency.name} width={40} height={40}/>
                                    <div>
                                        <p className="font-bold">{currency.name}</p>
                                        <p className="text-sm text-muted-foreground">{currency.symbol}</p>
                                    </div>
                                </div>
                                <Button size="sm" onClick={() => openCreateDialog(currency)}><Plus className="mr-2 h-4 w-4"/> Create Wallet</Button>
                            </div>
                         ))}
                    </CardContent>
                </Card>
            </div>
            
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Create {selectedCurrency?.name} Wallet</DialogTitle>
                        <DialogDescription>Enter a name for your new wallet and confirm your password.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Wallet Name</Label>
                            <Input value={walletName} onChange={e => setWalletName(e.target.value)} placeholder="e.g., My Savings" />
                        </div>
                        <div className="space-y-2">
                            <Label>Account Password</Label>
                            <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your login password" required />
                        </div>
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button variant="secondary">Cancel</Button></DialogClose>
                        <Button onClick={handleCreateWallet} disabled={isCreating || !walletName || !password}>
                            {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                            Create Wallet
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

             <ActionDialog
                title="Deposit"
                wallets={wallets}
                onSelect={handleActionSelect}
                open={isDepositDialogOpen}
                onOpenChange={setIsDepositDialogOpen}
            />

            <ActionDialog
                title="Send"
                wallets={wallets}
                onSelect={handleActionSelect}
                open={isSendDialogOpen}
                onOpenChange={setIsSendDialogOpen}
            />
        </DashboardLayout>
    );
}


export default function DigitalWalletPage() {
    return (
        <Suspense fallback={
            <DashboardLayout>
                <div className="flex items-center justify-center h-full">
                    <Loader2 className="h-8 w-8 animate-spin"/>
                </div>
            </DashboardLayout>
        }>
            <DigitalWalletPageContents />
        </Suspense>
    )
}
