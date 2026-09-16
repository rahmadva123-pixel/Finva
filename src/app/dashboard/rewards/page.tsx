
"use client";

import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, getDoc, orderBy } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { Loader2, Coins, Star } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface ShareTransaction {
    id: string;
    amount: number;
    date: any;
    description: string;
    source: 'investment' | 'staking' | 'pool';
}

interface EarningPowerLedgerEntry {
    id: string;
    amount: number;
    used: number;
    status: 'active' | 'expired';
    source: string;
    date: any;
}

interface TokenTransaction {
    id: string;
    amount: number;
    date: any;
    description: string;
    source: 'investment' | 'staking' | 'pool';
    expirationDate?: any;
    status?: 'active' | 'expired';
    earningPower?: {
        used: number;
        amount: number;
    };
}

interface UserData {
    shareBalance?: number;
    tokenBalance?: number;
}

interface EarningRules {
    tokenName?: string;
    expireTokensOnPowerUsed?: boolean;
}

const Countdown = ({ expirationDate }: { expirationDate: any }) => {
    const [timeLeft, setTimeLeft] = useState("");

    useEffect(() => {
        const interval = setInterval(() => {
            const now = new Date();
            const expiry = expirationDate.toDate();
            if (now > expiry) {
                setTimeLeft("Expired");
                clearInterval(interval);
                return;
            }
            setTimeLeft(formatDistanceToNow(expiry, { addSuffix: true }));
        }, 1000);
        return () => clearInterval(interval);
    }, [expirationDate]);

    return <span className="text-xs text-muted-foreground">{timeLeft}</span>;
}

export default function ExtraEarningsPage() {
    const { user } = useAuth();
    const [shareHistory, setShareHistory] = useState<ShareTransaction[]>([]);
    const [tokenHistory, setTokenHistory] = useState<TokenTransaction[]>([]);
    const [userData, setUserData] = useState<UserData | null>(null);
    const [earningRules, setEarningRules] = useState<EarningRules | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!db || !user) {
            setLoading(false);
            return;
        }

        const fetchData = async () => {
            setLoading(true);
            try {
                const userDocRef = doc(db, 'users', user.uid);
                const userDocSnap = await getDoc(userDocRef);
                if (userDocSnap.exists()) {
                    setUserData(userDocSnap.data() as UserData);
                }
                
                const earningRulesDoc = await getDoc(doc(db, "settings", "earningRules"));
                if (earningRulesDoc.exists()) {
                    setEarningRules(earningRulesDoc.data() as EarningRules);
                }

                const sharesQuery = query(collection(db, "shareTransactions"), where("userId", "==", user.uid), orderBy("date", "desc"));
                const sharesSnapshot = await getDocs(sharesQuery);
                setShareHistory(sharesSnapshot.docs.map(d => ({id: d.id, ...d.data()} as ShareTransaction)));

                const tokensQuery = query(collection(db, "tokenTransactions"), where("userId", "==", user.uid), orderBy("date", "desc"));
                const tokensSnapshot = await getDocs(tokensQuery);
                
                const powerLedgerQuery = query(collection(db, "earningPowerLedger"), where("userId", "==", user.uid));
                const powerLedgerSnapshot = await getDocs(powerLedgerQuery);
                const powerLedgerMap = new Map<string, EarningPowerLedgerEntry>();
                powerLedgerSnapshot.forEach(doc => {
                    const data = doc.data() as EarningPowerLedgerEntry;
                    powerLedgerMap.set(data.source, data);
                });

                const tokensData = tokensSnapshot.docs.map(d => {
                    const data = d.data() as TokenTransaction;
                    const powerLedgerEntry = powerLedgerMap.get(d.id);
                    return {
                        ...data,
                        id: d.id,
                        earningPower: powerLedgerEntry ? { used: powerLedgerEntry.used, amount: powerLedgerEntry.amount } : undefined
                    } as TokenTransaction;
                });

                setTokenHistory(tokensData);

            } catch (error) {
                console.error("Error fetching extra earnings data: ", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [user]);
    
    if (loading) {
        return (
            <DashboardLayout>
                <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin"/></div>
            </DashboardLayout>
        )
    }

    return (
        <DashboardLayout>
            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold font-headline tracking-tight">Extra Earnings</h1>
                    <p className="text-muted-foreground">An overview of your shares and tokens.</p>
                </div>
                
                 <Tabs defaultValue="shares">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="shares">Shares</TabsTrigger>
                        <TabsTrigger value="tokens">{earningRules?.tokenName || 'Tokens'}</TabsTrigger>
                    </TabsList>
                    <TabsContent value="shares">
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle>My Shares</CardTitle>
                                        <CardDescription>Shares earned from your investments.</CardDescription>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm text-muted-foreground">Total Shares</p>
                                        <p className="text-3xl font-bold flex items-center gap-2 justify-end"><Star className="h-7 w-7 text-primary"/> {(userData?.shareBalance || 0).toLocaleString()}</p>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <h4 className="font-semibold mb-4">Share History</h4>
                                <Table>
                                    <TableHeader><TableRow><TableHead>Description</TableHead><TableHead>Amount</TableHead><TableHead>Date</TableHead></TableRow></TableHeader>
                                    <TableBody>
                                        {shareHistory.map(tx => (
                                            <TableRow key={tx.id}>
                                                <TableCell>{tx.description}</TableCell>
                                                <TableCell>{tx.amount.toLocaleString()}</TableCell>
                                                <TableCell>{format(tx.date.toDate(), 'PPp')}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                                {shareHistory.length === 0 && <p className="text-sm text-center py-8 text-muted-foreground">No share transactions yet.</p>}
                            </CardContent>
                        </Card>
                    </TabsContent>
                    <TabsContent value="tokens">
                         <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle>My {earningRules?.tokenName || 'Tokens'}</CardTitle>
                                        <CardDescription>Tokens earned from your investments.</CardDescription>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm text-muted-foreground">Total {earningRules?.tokenName || 'Tokens'}</p>
                                        <p className="text-3xl font-bold flex items-center gap-2 justify-end"><Coins className="h-7 w-7 text-primary"/> {(userData?.tokenBalance || 0).toLocaleString(undefined, {maximumFractionDigits: 2})}</p>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <h4 className="font-semibold mb-4">Token History</h4>
                                 <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Description</TableHead>
                                            <TableHead>Amount</TableHead>
                                            <TableHead>Date</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>{earningRules?.expireTokensOnPowerUsed ? 'Earning Power Used' : 'Expires'}</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {tokenHistory.map(tx => (
                                            <TableRow key={tx.id} className={tx.status === 'expired' ? 'text-muted-foreground' : ''}>
                                                <TableCell>{tx.description}</TableCell>
                                                <TableCell>{tx.amount.toLocaleString(undefined, {maximumFractionDigits: 2})}</TableCell>
                                                <TableCell>{format(tx.date.toDate(), 'PPp')}</TableCell>
                                                <TableCell>
                                                    <Badge variant={tx.status === 'expired' ? 'secondary' : 'default'} className="capitalize">{tx.status || 'active'}</Badge>
                                                </TableCell>
                                                <TableCell>
                                                {earningRules?.expireTokensOnPowerUsed && tx.earningPower ? (
                                                    <div className="w-24">
                                                        <Progress value={(tx.earningPower.used / tx.earningPower.amount) * 100} className="h-2" />
                                                        <p className="text-xs text-muted-foreground text-center mt-1">
                                                          {((tx.earningPower.used / tx.earningPower.amount) * 100).toFixed(0)}%
                                                        </p>
                                                    </div>
                                                ) : tx.expirationDate && tx.status !== 'expired' ? (
                                                    <Countdown expirationDate={tx.expirationDate} />
                                                ) : tx.status === 'expired' ? (
                                                    'Expired'
                                                ) : (
                                                    'Never'
                                                )}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                                {tokenHistory.length === 0 && <p className="text-sm text-center py-8 text-muted-foreground">No token transactions yet.</p>}
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>
        </DashboardLayout>
    );
}
