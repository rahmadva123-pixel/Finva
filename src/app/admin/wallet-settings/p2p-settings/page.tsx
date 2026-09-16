
"use client";

import React, { useState, useEffect } from 'react';
import { AdminLayout } from "@/components/layout/admin-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { doc, setDoc, getDoc, collection, getDocs } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import Image from 'next/image';

interface DigitalCurrency {
  id: string;
  name: string;
  symbol: string;
  iconUrl: string;
}

interface P2PSettings {
    mainWalletMinTransfer: number;
    digitalCurrencyMinTransfer: { [currencyId: string]: number };
}

export default function P2PSettingsPage() {
    const { toast } = useToast();
    const [settings, setSettings] = useState<P2PSettings>({ mainWalletMinTransfer: 1, digitalCurrencyMinTransfer: {} });
    const [digitalCurrencies, setDigitalCurrencies] = useState<DigitalCurrency[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const fetchSettings = async () => {
            if (!db) { setLoading(false); return; }
            try {
                const settingsDoc = getDoc(doc(db, 'settings', 'p2p'));
                const digitalCurrenciesSnap = getDocs(collection(db, 'digitalCurrencies'));

                const [settingsSnap, digiCurrSnap] = await Promise.all([settingsDoc, digitalCurrenciesSnap]);
                
                if (settingsSnap.exists()) {
                    setSettings(settingsSnap.data() as P2PSettings);
                }

                setDigitalCurrencies(digiCurrSnap.docs.map(d => ({ id: d.id, ...d.data() } as DigitalCurrency)));

            } catch (error) {
                toast({ variant: 'destructive', title: 'Error', description: 'Failed to fetch settings.' });
            } finally {
                setLoading(false);
            }
        };
        fetchSettings();
    }, [toast]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!db) return;
        setSaving(true);
        try {
            await setDoc(doc(db, 'settings', 'p2p'), settings, { merge: true });
            toast({ title: 'Success', description: 'P2P Transfer settings saved successfully.' });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: `Failed to save settings: ${error.message}` });
        } finally {
            setSaving(false);
        }
    };
    
    const handleMainMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSettings(prev => ({ ...prev, mainWalletMinTransfer: parseFloat(e.target.value) || 0 }));
    }

    const handleDigitalMinChange = (currencyId: string, value: string) => {
        setSettings(prev => ({
            ...prev,
            digitalCurrencyMinTransfer: {
                ...prev.digitalCurrencyMinTransfer,
                [currencyId]: parseFloat(value) || 0
            }
        }));
    }

    if (loading) {
        return (
            <AdminLayout>
                <div className="flex justify-center items-center h-full">
                    <Loader2 className="h-8 w-8 animate-spin" />
                </div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout>
            <form onSubmit={handleSave} className="space-y-8">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold font-headline tracking-tight">P2P Transfer Settings</h1>
                        <p className="text-muted-foreground">Set minimum transfer amounts for user-to-user transactions.</p>
                    </div>
                    <Button type="submit" disabled={saving}>
                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save Changes
                    </Button>
                </div>
                
                <Card>
                    <CardHeader>
                        <CardTitle>Main Wallet</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <Label htmlFor="mainWalletMin">Minimum Transfer Amount</Label>
                        <Input
                            id="mainWalletMin"
                            type="number"
                            step="any"
                            value={settings.mainWalletMinTransfer || ''}
                            onChange={handleMainMinChange}
                            placeholder="e.g. 1.00"
                        />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Digital Currencies</CardTitle>
                        <CardDescription>Set minimum transfer amounts for each digital currency.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {digitalCurrencies.map(currency => (
                            <div key={currency.id} className="flex items-center gap-4 p-4 border rounded-lg">
                                <Image src={currency.iconUrl} alt={currency.name} width={32} height={32} />
                                <div className="flex-1 space-y-2">
                                    <Label htmlFor={`min-${currency.id}`}>
                                        Min Transfer for {currency.name} ({currency.symbol})
                                    </Label>
                                    <Input
                                        id={`min-${currency.id}`}
                                        type="number"
                                        step="any"
                                        value={settings.digitalCurrencyMinTransfer[currency.id] || ''}
                                        onChange={(e) => handleDigitalMinChange(currency.id, e.target.value)}
                                        placeholder="e.g., 0.001"
                                    />
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            </form>
        </AdminLayout>
    );
}
