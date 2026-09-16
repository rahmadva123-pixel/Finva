
"use client";

import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { doc, getDoc, runTransaction, collection, serverTimestamp } from "firebase/firestore";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Image from 'next/image';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface UserWallet {
  id: string;
  currencyId: string;
  currencySymbol: string;
  currencyIconUrl: string;
  name: string;
  balance: number;
}

interface P2PSettings {
    digitalCurrencyMinTransfer: { [currencyId: string]: number };
}

export default function SendDigitalCurrencyPage() {
    const { user } = useAuth();
    const { toast } = useToast();
    const router = useRouter();
    const params = useParams();
    const walletId = params.walletId as string;

    const [wallet, setWallet] = useState<UserWallet | null>(null);
    const [loading, setLoading] = useState(true);
    const [recipientAddress, setRecipientAddress] = useState("");
    const [amount, setAmount] = useState("");
    const [showConfirm, setShowConfirm] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [p2pSettings, setP2pSettings] = useState<P2PSettings>({ digitalCurrencyMinTransfer: {} });

    useEffect(() => {
        if (!db || !user || !walletId) return;
        const fetchData = async () => {
            try {
                const walletDoc = await getDoc(doc(db, 'digitalWallets', walletId));
                if (walletDoc.exists() && walletDoc.data().userId === user.uid) {
                    setWallet({ id: walletDoc.id, ...walletDoc.data() } as UserWallet);
                } else {
                    router.push('/dashboard/digital-wallet');
                }

                const p2pSettingsDoc = await getDoc(doc(db, 'settings', 'p2p'));
                if (p2pSettingsDoc.exists()) {
                    setP2pSettings(p2pSettingsDoc.data() as P2PSettings);
                }

            } catch (e) {
                router.push('/dashboard/digital-wallet');
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [walletId, user, router]);

    const handleSend = async () => {
        if (!db || !wallet) return;

        const sendAmount = parseFloat(amount);
        const minTransfer = p2pSettings.digitalCurrencyMinTransfer[wallet.currencyId] || 0;

        if (isNaN(sendAmount) || sendAmount <= 0) {
            toast({ variant: 'destructive', title: 'Invalid Amount' });
            return;
        }
        if (minTransfer > 0 && sendAmount < minTransfer) {
            toast({ variant: 'destructive', title: 'Amount Too Low', description: `Minimum transfer amount is ${minTransfer} ${wallet.currencySymbol}.` });
            return;
        }
        if (sendAmount > wallet.balance) {
            toast({ variant: 'destructive', title: 'Insufficient Funds' });
            return;
        }
        if (!recipientAddress) {
            toast({ variant: 'destructive', title: 'Recipient Required' });
            return;
        }
        if (recipientAddress === walletId) {
             toast({ variant: 'destructive', title: 'Invalid Recipient', description: "You cannot send funds to the same wallet." });
            return;
        }
        setShowConfirm(true);
    }
    
    const confirmSend = async () => {
        setSubmitting(true);
        try {
            await runTransaction(db, async (transaction) => {
                const senderWalletRef = doc(db, 'digitalWallets', walletId);
                const recipientWalletRef = doc(db, 'digitalWallets', recipientAddress);

                const [senderDoc, recipientDoc] = await Promise.all([
                    transaction.get(senderWalletRef),
                    transaction.get(recipientWalletRef)
                ]);

                if (!senderDoc.exists()) throw new Error("Sender wallet not found.");
                if (!recipientDoc.exists()) throw new Error("Recipient wallet not found.");

                const senderData = senderDoc.data();
                const recipientData = recipientDoc.data();

                if(senderData.currencyId !== recipientData.currencyId) {
                    throw new Error("Wallets must be for the same currency.");
                }

                const sendAmount = parseFloat(amount);
                if (senderData.balance < sendAmount) throw new Error("Insufficient funds.");

                transaction.update(senderWalletRef, { balance: senderData.balance - sendAmount });
                transaction.update(recipientWalletRef, { balance: (recipientData.balance || 0) + sendAmount });

                const txRef = doc(collection(db, 'digitalWalletTransactions'));
                transaction.set(txRef, {
                    fromWalletId: walletId,
                    toWalletId: recipientAddress,
                    fromUserId: senderData.userId,
                    toUserId: recipientData.userId,
                    amount: sendAmount,
                    currencySymbol: senderData.currencySymbol,
                    date: serverTimestamp(),
                });
            });

            toast({ title: 'Success', description: 'Transfer completed successfully!' });
            router.push('/dashboard/digital-wallet/history');

        } catch(error: any) {
             toast({ variant: 'destructive', title: 'Transfer Failed', description: error.message });
        } finally {
            setSubmitting(false);
            setShowConfirm(false);
        }
    }


    if (loading || !wallet) {
        return (
            <DashboardLayout>
                <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin"/></div>
            </DashboardLayout>
        );
    }
    
    const minTransferAmount = p2pSettings.digitalCurrencyMinTransfer[wallet.currencyId] || 0;

    return (
        <DashboardLayout>
            <div className="max-w-md mx-auto space-y-6">
                <Button variant="ghost" onClick={() => router.back()}><ArrowLeft className="mr-2"/> Back to Wallets</Button>
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-3">
                             <Image src={wallet.currencyIconUrl} alt={wallet.name} width={40} height={40} />
                            <div>
                                <CardTitle>Send {wallet.currencySymbol}</CardTitle>
                                <CardDescription>From: {wallet.name}</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="p-4 rounded-lg bg-muted flex justify-between items-center">
                            <span className="text-muted-foreground">Available Balance</span>
                            <span className="font-bold text-lg">{wallet.balance.toLocaleString()} {wallet.currencySymbol}</span>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="recipientAddress">Recipient Address</Label>
                            <Input id="recipientAddress" value={recipientAddress} onChange={e => setRecipientAddress(e.target.value)} placeholder="Paste wallet address" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="amount">Amount</Label>
                            <Input id="amount" type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" />
                             {minTransferAmount > 0 && <p className="text-xs text-muted-foreground">Minimum transfer: {minTransferAmount} {wallet.currencySymbol}</p>}
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button className="w-full" onClick={handleSend} disabled={submitting}>
                           {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                            Send
                        </Button>
                    </CardFooter>
                </Card>
            </div>

            <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Confirm Transfer</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to send {amount} {wallet.currencySymbol} to the address {recipientAddress.slice(0,10)}...? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmSend} disabled={submitting}>
                            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                            Confirm & Send
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </DashboardLayout>
    )
}
