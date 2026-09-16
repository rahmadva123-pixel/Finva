
"use client";

import React, { useState, useEffect } from 'react';
import { AdminLayout } from "@/components/layout/admin-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Zap, Star, Coins } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Textarea } from '@/components/ui/textarea';

export default function EarningRulesPage() {
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Earning Power State
    const [isEnabled, setIsEnabled] = useState(false);
    const [multiplier, setMultiplier] = useState('10');
    const [message, setMessage] = useState('You have used {used} of your {max} earning power.');
    const [messageColor, setMessageColor] = useState('#ffffff');
    const [progressColor, setProgressColor] = useState('#10B981');
    const [earningPowerDepletedMessage, setEarningPowerDepletedMessage] = useState('Your earning power is depleted. Invest more to increase your earning limit.');

    // Share Allocation State
    const [sharesEnabled, setSharesEnabled] = useState(false);
    const [shareRatio, setShareRatio] = useState('10');

    // Token Reward State
    const [tokensEnabled, setTokensEnabled] = useState(false);
    const [tokenName, setTokenName] = useState('TNR');
    const [tokenRatio, setTokenRatio] = useState('0.5');
    const [tokenExpirationDays, setTokenExpirationDays] = useState('');
    const [expireTokensOnPowerUsed, setExpireTokensOnPowerUsed] = useState(false);

    useEffect(() => {
        const fetchSettings = async () => {
            if (!db) {
                setLoading(false);
                return;
            }
            try {
                const docRef = doc(db, 'settings', 'earningRules');
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    // Earning Power
                    setIsEnabled(data.isEnabled ?? false);
                    setMultiplier(data.multiplier?.toString() || '10');
                    setMessage(data.message || 'You have used {used} of your {max} earning power.');
                    setMessageColor(data.messageColor || '#ffffff');
setProgressColor(data.progressColor || '#10B981');
                    setEarningPowerDepletedMessage(data.earningPowerDepletedMessage || 'Your earning power is depleted. Invest more to increase your earning limit.');
                    // Share Allocation
                    setSharesEnabled(data.sharesEnabled ?? false);
                    setShareRatio(data.shareRatio?.toString() || '10');
                    // Token Rewards
                    setTokensEnabled(data.tokensEnabled ?? false);
                    setTokenName(data.tokenName || 'TNR');
                    setTokenRatio(data.tokenRatio?.toString() || '0.5');
                    setTokenExpirationDays(data.tokenExpirationDays?.toString() || '');
                    setExpireTokensOnPowerUsed(data.expireTokensOnPowerUsed ?? false);
                }
            } catch (e) {
                toast({ variant: 'destructive', title: 'Error', description: 'Failed to load earning rules.' });
            } finally {
                setLoading(false);
            }
        };
        fetchSettings();
    }, [toast]);
    
    const handleSave = async () => {
        if (!db) return;
        setSaving(true);
        try {
            await setDoc(doc(db, 'settings', 'earningRules'), {
                isEnabled,
                multiplier: parseFloat(multiplier),
                message,
                messageColor,
                progressColor,
                earningPowerDepletedMessage,
                sharesEnabled,
                shareRatio: parseFloat(shareRatio),
                tokensEnabled,
                tokenName,
                tokenRatio: parseFloat(tokenRatio),
                tokenExpirationDays: tokenExpirationDays ? parseInt(tokenExpirationDays) : null,
                expireTokensOnPowerUsed,
            });
            toast({ title: 'Success', description: 'Earning rules saved successfully.'});
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: `Failed to save rules: ${error.message}` });
        } finally {
            setSaving(false);
        }
    }
    
    if (loading) {
        return (
            <AdminLayout>
                <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
            </AdminLayout>
        );
    }


    return (
        <AdminLayout>
            <div className="space-y-8">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold font-headline tracking-tight">Earning & Reward Rules</h1>
                        <p className="text-muted-foreground">Set earning limits and rewards for user investments.</p>
                    </div>
                    <Button onClick={handleSave} disabled={saving}>
                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                        Save Rules
                    </Button>
                </div>
                
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Zap /> Earning Power System</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex items-center justify-between p-4 border rounded-md">
                            <div>
                                <Label htmlFor="earning-enabled" className="font-semibold text-base">Enable Earning Power Limit</Label>
                                <p className="text-sm text-muted-foreground">If enabled, users' total earnings will be limited by their total investments.</p>
                            </div>
                            <Switch id="earning-enabled" checked={isEnabled} onCheckedChange={setIsEnabled} />
                        </div>
                        
                        {isEnabled && (
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="multiplier">Earning Power Multiplier</Label>
                                    <Input id="multiplier" type="number" value={multiplier} onChange={(e) => setMultiplier(e.target.value)} />
                                    <p className="text-xs text-muted-foreground">Example: A multiplier of 10 means a $100 investment grants $1000 of earning power.</p>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                 {isEnabled && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Dashboard Display</CardTitle>
                            <CardDescription>Customize the earning power status box shown to users on their dashboard.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                             <div className="space-y-2">
                                <Label htmlFor="message">Display Message</Label>
                                <Input id="message" value={message} onChange={(e) => setMessage(e.target.value)} />
                                <p className="text-xs text-muted-foreground">Use placeholders: {'`{used}`'} for current earnings, {'`{max}`'} for max earning power.</p>
                            </div>
                             <div className="space-y-2">
                                <Label htmlFor="earningPowerDepletedMessage">Depleted Power Message</Label>
                                <Textarea id="earningPowerDepletedMessage" value={earningPowerDepletedMessage} onChange={(e) => setEarningPowerDepletedMessage(e.target.value)} />
                                <p className="text-xs text-muted-foreground">This message is shown when a user's earning power is 0.</p>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                 <div className="space-y-2">
                                    <Label htmlFor="messageColor">Message Text Color</Label>
                                    <Input id="messageColor" type="color" value={messageColor} onChange={(e) => setMessageColor(e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="progressColor">Progress Bar Color</Label>
                                    <Input id="progressColor" type="color" value={progressColor} onChange={(e) => setProgressColor(e.target.value)} />
                                </div>
                            </div>
                            
                            <div className="space-y-2">
                                <Label>Preview</Label>
                                <div className="p-4 rounded-lg" style={{backgroundColor: progressColor + '20' }}>
                                    <p className="text-sm" style={{color: messageColor}}>
                                        {message.replace('{used}', '$500.00').replace('{max}', '$1,000.00')}
                                    </p>
                                    <div className="relative h-2 w-full overflow-hidden rounded-full mt-2" style={{backgroundColor: progressColor + '40'}}>
                                        <div className="h-full w-1/2 flex-1 transition-all" style={{backgroundColor: progressColor}} />
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}
                
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Star /> Share Allocation</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                         <div className="flex items-center justify-between p-4 border rounded-md">
                            <div>
                                <Label htmlFor="shares-enabled" className="font-semibold text-base">Enable Share Rewards</Label>
                                <p className="text-sm text-muted-foreground">If enabled, users will receive "shares" for their investments.</p>
                            </div>
                            <Switch id="shares-enabled" checked={sharesEnabled} onCheckedChange={setSharesEnabled} />
                        </div>
                        {sharesEnabled && (
                             <div className="space-y-2">
                                <Label htmlFor="shareRatio">Investment per Share</Label>
                                <Input id="shareRatio" type="number" value={shareRatio} onChange={(e) => setShareRatio(e.target.value)} />
                                <p className="text-xs text-muted-foreground">Example: A value of 10 means 1 share is awarded for every $10 invested.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Coins /> Token Rewards</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex items-center justify-between p-4 border rounded-md">
                            <div>
                                <Label htmlFor="tokens-enabled" className="font-semibold text-base">Enable Token Rewards</Label>
                                <p className="text-sm text-muted-foreground">If enabled, users will receive a custom token for their investments.</p>
                            </div>
                            <Switch id="tokens-enabled" checked={tokensEnabled} onCheckedChange={setTokensEnabled} />
                        </div>
                         {tokensEnabled && (
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="tokenName">Token Name/Symbol</Label>
                                        <Input id="tokenName" value={tokenName} onChange={(e) => setTokenName(e.target.value)} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="tokenRatio">Tokens per $1 Invested</Label>
                                        <Input id="tokenRatio" type="number" value={tokenRatio} onChange={(e) => setTokenRatio(e.target.value)} />
                                    </div>
                                </div>
                                 <div className="flex items-center justify-between p-4 border rounded-md mt-4">
                                    <div>
                                        <Label htmlFor="expireTokensOnPowerUsed" className="font-semibold text-base">Expire tokens when earning power is used</Label>
                                        <p className="text-sm text-muted-foreground">If enabled, tokens from an investment will expire once the earning power from that same investment is fully consumed.</p>
                                    </div>
                                    <Switch id="expireTokensOnPowerUsed" checked={expireTokensOnPowerUsed} onCheckedChange={setExpireTokensOnPowerUsed} />
                                </div>
                                {!expireTokensOnPowerUsed && (
                                    <div className="space-y-2">
                                        <Label htmlFor="tokenExpirationDays">Token Expiration (in days)</Label>
                                        <Input id="tokenExpirationDays" type="number" value={tokenExpirationDays} onChange={(e) => setTokenExpirationDays(e.target.value)} placeholder="Optional, e.g., 365" />
                                        <p className="text-xs text-muted-foreground">Leave blank for no expiration.</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>

            </div>
        </AdminLayout>
    );
}
