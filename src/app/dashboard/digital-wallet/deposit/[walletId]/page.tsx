
"use client";

import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { ArrowLeft, Copy, Loader2 } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Image from 'next/image';

interface UserWallet {
  id: string; 
  currencySymbol: string;
  currencyIconUrl: string;
  name: string;
}

export default function DepositDigitalCurrencyPage() {
    const { user } = useAuth();
    const { toast } = useToast();
    const router = useRouter();
    const params = useParams();
    const walletId = params.walletId as string;

    const [wallet, setWallet] = useState<UserWallet | null>(null);
    const [loading, setLoading] = useState(true);
    const [isIdentityVerified, setIsIdentityVerified] = useState<boolean | null>(null);
    
    useEffect(() => {
        if(!db || !user || !walletId) return;

        const fetchWallet = async () => {
            try {
                const userDoc = await getDoc(doc(db, 'users', user.uid));
                const verified = userDoc.exists() && userDoc.data().verificationStatus === 'verified';
                setIsIdentityVerified(verified);

                if (!verified) {
                    setLoading(false);
                    return;
                }

                const walletDoc = await getDoc(doc(db, 'digitalWallets', walletId));
                if (walletDoc.exists() && walletDoc.data().userId === user.uid) {
                    setWallet({ id: walletDoc.id, ...walletDoc.data()} as UserWallet);
                } else {
                    toast({ variant: 'destructive', title: 'Error', description: 'Wallet not found.' });
                    router.push('/dashboard/digital-wallet');
                }
            } catch (error: any) {
                toast({ variant: 'destructive', title: 'Error', description: `Failed to fetch wallet: ${error.message}`});
            } finally {
                setLoading(false);
            }
        };
        fetchWallet();

    }, [walletId, user, router, toast]);
    
    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast({ title: 'Copied!', description: 'Address copied to clipboard.'})
    }

    if (loading || isIdentityVerified === null) {
        return (
            <DashboardLayout>
                <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin"/></div>
            </DashboardLayout>
        );
    }

    if (isIdentityVerified === false) {
        return (
            <DashboardLayout>
                <div className="max-w-xl mx-auto">
                    <Card>
                        <CardHeader className="text-center">
                            <CardTitle>Identity verification required</CardTitle>
                            <CardDescription>You must verify your identity before using deposit addresses.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button className="w-full" onClick={() => router.push('/verification')}>Verify Identity Now</Button>
                        </CardContent>
                    </Card>
                </div>
            </DashboardLayout>
        );
    }
    
    if (!wallet) return null;

    return (
        <DashboardLayout>
            <div className="max-w-md mx-auto space-y-6">
                <Button variant="ghost" onClick={() => router.back()}><ArrowLeft className="mr-2"/> Back</Button>
                <Card>
                    <CardHeader className="text-center">
                         <Image src={wallet.currencyIconUrl} alt={wallet.name} width={64} height={64} className="mx-auto rounded-full mb-4"/>
                        <CardTitle>Deposit {wallet.currencySymbol}</CardTitle>
                        <CardDescription>Share your address to receive funds.</CardDescription>
                    </CardHeader>
                    <CardContent className="text-center space-y-4">
                        <Image 
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${wallet.id}`} 
                            alt="Wallet QR Code" 
                            width={200}
                            height={200}
                            className="mx-auto rounded-md border p-1"
                        />
                        <div>
                            <p className="font-bold mb-1">Your {wallet.name} Address:</p>
                            <div className="relative">
                                <Input value={wallet.id} readOnly className="bg-muted text-center pr-10 text-xs"/>
                                <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8" onClick={() => copyToClipboard(wallet.id)}>
                                    <Copy className="h-4 w-4"/>
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    );
}

