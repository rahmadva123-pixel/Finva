
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { AdminLayout } from "@/components/layout/admin-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { doc, setDoc, getDoc, collection, getDocs } from 'firebase/firestore';
import { Loader2, Repeat, Settings, ArrowRight } from 'lucide-react';
import Image from 'next/image';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';

interface DigitalCurrency {
  id: string;
  name: string;
  symbol: string;
  iconUrl: string;
}

interface SwapPairSettings {
  rate: number; // 1 Main Currency = X Digital Currency
  mainToDigitalFeePercent: number;
  digitalToMainFeePercent: number;
  enabled: boolean;
}

interface SwapSettings {
    isEnabled: boolean; // Global switch
    mainCurrencySymbol: string;
    pairs: Record<string, Partial<SwapPairSettings>>; // Key is digital currency ID
}

export default function SwapSettingsPage() {
    const { toast } = useToast();
    const [settings, setSettings] = useState<SwapSettings>({
        isEnabled: false,
        mainCurrencySymbol: 'USD',
        pairs: {},
    });
    const [digitalCurrencies, setDigitalCurrencies] = useState<DigitalCurrency[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const fetchSettings = async () => {
            if (!db) { setLoading(false); return; }
            try {
                const swapDoc = getDoc(doc(db, 'settings', 'swap'));
                const currencyDoc = getDoc(doc(db, 'settings', 'currency'));
                const digitalCurrenciesSnap = getDocs(collection(db, 'digitalCurrencies'));

                const [swapSnap, currencySnap, digiCurrSnap] = await Promise.all([swapDoc, currencyDoc, digitalCurrenciesSnap]);
                
                if (swapSnap.exists()) {
                    const data = swapSnap.data() as SwapSettings;
                    setSettings(prev => ({
                        ...prev,
                        ...data,
                        pairs: data.pairs || {},
                    }));
                }

                if (currencySnap.exists()) {
                    setSettings(prev => ({...prev, mainCurrencySymbol: currencySnap.data().symbol || 'USD'}));
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
            await setDoc(doc(db, 'settings', 'swap'), settings, { merge: true });
            toast({ title: 'Success', description: 'Swap settings saved successfully.' });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: `Failed to save settings: ${error.message}` });
        } finally {
            setSaving(false);
        }
    };
    
    const handlePairChange = (id: string, field: keyof SwapPairSettings, value: string | number | boolean) => {
        setSettings(prev => ({
            ...prev,
            pairs: {
                ...prev.pairs,
                [id]: {
                    ...prev.pairs[id],
                    [field]: typeof value === 'number' ? Number(value) : value
                }
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
                        <h1 className="text-3xl font-bold font-headline tracking-tight">Exchange Settings</h1>
                        <p className="text-muted-foreground">Configure currency exchange pairs and fees.</p>
                    </div>
                    <Button type="submit" disabled={saving}>
                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save Changes
                    </Button>
                </div>
                
                <Card>
                    <CardHeader>
                        <CardTitle>Global Swap Settings</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex items-center justify-between p-4 border rounded-md">
                            <div>
                                <Label htmlFor="swap-enabled" className="font-semibold text-base">Enable Exchange Feature</Label>
                                <p className="text-sm text-muted-foreground">Turn the entire currency exchange system on or off.</p>
                            </div>
                            <Switch
                                id="swap-enabled"
                                checked={settings.isEnabled}
                                onCheckedChange={(checked) => setSettings(prev => ({ ...prev, isEnabled: checked }))}
                            />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Exchange Pairs</CardTitle>
                        <CardDescription>Configure swap settings for each digital currency against the main currency ({settings.mainCurrencySymbol}).</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Accordion type="multiple" className="w-full space-y-4">
                            {digitalCurrencies.map(currency => {
                                const pairSettings = settings.pairs[currency.id] || {};
                                return (
                                <AccordionItem key={currency.id} value={currency.id} className="border rounded-lg">
                                    <AccordionTrigger className="p-4 font-semibold text-lg hover:no-underline">
                                        <div className="flex items-center justify-between w-full pr-4">
                                            <div className="flex items-center gap-3">
                                                <Image src={currency.iconUrl} alt={currency.name} width={24} height={24} />
                                                <span>{settings.mainCurrencySymbol} <Repeat className="inline h-4 w-4 mx-1"/> {currency.symbol}</span>
                                            </div>
                                            <Badge variant={pairSettings.enabled ? 'default' : 'secondary'}>{pairSettings.enabled ? 'Enabled' : 'Disabled'}</Badge>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="p-4 border-t space-y-4">
                                        <div className="flex items-center justify-between p-3 border rounded-md">
                                            <Label>Enable this Pair</Label>
                                            <Switch checked={pairSettings.enabled || false} onCheckedChange={checked => handlePairChange(currency.id, 'enabled', checked)} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Exchange Rate</Label>
                                            <div className="flex items-center gap-2">
                                                <span>1 {settings.mainCurrencySymbol} =</span>
                                                <Input 
                                                    type="number" 
                                                    value={pairSettings.rate || ''}
                                                    onChange={e => handlePairChange(currency.id, 'rate', e.target.value)}
                                                    className="w-auto flex-grow"
                                                    step="any"
                                                />
                                                <span>{currency.symbol}</span>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label>{settings.mainCurrencySymbol} <ArrowRight className="inline h-4"/> {currency.symbol} Fee (%)</Label>
                                                <Input 
                                                    type="number"
                                                    value={pairSettings.mainToDigitalFeePercent || ''}
                                                    onChange={e => handlePairChange(currency.id, 'mainToDigitalFeePercent', e.target.value)}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>{currency.symbol} <ArrowRight className="inline h-4"/> {settings.mainCurrencySymbol} Fee (%)</Label>
                                                <Input 
                                                    type="number"
                                                    value={pairSettings.digitalToMainFeePercent || ''}
                                                    onChange={e => handlePairChange(currency.id, 'digitalToMainFeePercent', e.target.value)}
                                                />
                                            </div>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                                )
                            })}
                        </Accordion>
                    </CardContent>
                </Card>

            </form>
        </AdminLayout>
    );
}
