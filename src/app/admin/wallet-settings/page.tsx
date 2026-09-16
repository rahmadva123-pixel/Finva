
'use client';

import { AdminLayout } from '@/components/layout/admin-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import React, { useEffect, useState } from 'react';
import { Loader2, ArrowRight } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Link from 'next/link';

export default function WalletSettingsPage() {
  const { toast } = useToast();
  const [currencySymbol, setCurrencySymbol] = useState('');
  const [currencyPosition, setCurrencyPosition] = useState('left');
  const [usdtRate, setUsdtRate] = useState('');
  const [whatsappUrl, setWhatsappUrl] = useState('https://wa.me/94773543361');
  const [telegramUrl, setTelegramUrl] = useState('');
  
  const [mainWalletName, setMainWalletName] = useState('Main Wallet');
  const [mainWalletIcon, setMainWalletIcon] = useState('Wallet');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      if (!db) {
        setLoading(false);
        return;
      }
      try {
        const docRef = doc(db, 'settings', 'currency');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setCurrencySymbol(data.symbol || '');
          setCurrencyPosition(data.position || 'left');
          setUsdtRate(data.usdtRate || '');
          setWhatsappUrl(data.whatsappUrl || 'https://wa.me/94773543361');
          setTelegramUrl(data.telegramUrl || '');
          setMainWalletName(data.mainWalletName || 'Main Wallet');
          setMainWalletIcon(data.mainWalletIcon || 'Wallet');
        } else {
          // If no settings exist, set the default whatsappUrl
          await setDoc(docRef, { whatsappUrl: 'https://wa.me/94773543361' });
        }
      } catch (error) {
        console.error('Error fetching currency settings:', error);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Could not fetch currency settings.',
        });
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, [toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Firestore is not initialized.',
      });
      return;
    }
    setSaving(true);
    try {
      const settingsData = {
        symbol: currencySymbol,
        position: currencyPosition,
        usdtRate: parseFloat(usdtRate),
        whatsappUrl: whatsappUrl,
        telegramUrl: telegramUrl,
        mainWalletName,
        mainWalletIcon,
      };
      await setDoc(doc(db, 'settings', 'currency'), settingsData, { merge: true });
      toast({
        title: 'Success',
        description: 'Wallet settings have been saved.',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error saving settings',
        description: error.message,
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
       <form onSubmit={handleSubmit} className="flex flex-col gap-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold font-headline tracking-tight">Wallet Settings</h1>
            <p className="text-muted-foreground">Manage your application's wallet, currency, and contact settings.</p>
          </div>
           <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save Settings
            </Button>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
             <Card>
                <CardHeader>
                    <CardTitle>Digital Currencies & Swap</CardTitle>
                    <CardDescription>Manage custom currencies and the exchange settings between them.</CardDescription>
                </CardHeader>
                <CardFooter className="flex flex-col items-start gap-4">
                     <Button asChild>
                        <Link href="/admin/wallet-settings/digital-currencies">Manage Currencies <ArrowRight className="ml-2 h-4 w-4" /></Link>
                    </Button>
                </CardFooter>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>Deposit & Withdrawal</CardTitle>
                    <CardDescription>Configure the methods users can use to deposit and withdraw funds.</CardDescription>
                </CardHeader>
                <CardFooter className="flex flex-col items-start gap-4">
                     <Button asChild>
                        <Link href="/admin/wallet-settings/deposit-methods">Manage Deposit Methods <ArrowRight className="ml-2 h-4 w-4" /></Link>
                    </Button>
                    <Button asChild>
                        <Link href="/admin/wallet-settings/withdraw-methods">Manage Withdrawal Methods <ArrowRight className="ml-2 h-4 w-4" /></Link>
                    </Button>
                </CardFooter>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>P2P Transfers</CardTitle>
                    <CardDescription>Set minimum amounts for peer-to-peer (user-to-user) transfers.</CardDescription>
                </CardHeader>
                <CardFooter>
                    <Button asChild>
                        <Link href="/admin/wallet-settings/p2p-settings">P2P Settings <ArrowRight className="ml-2 h-4 w-4" /></Link>
                    </Button>
                </CardFooter>
            </Card>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Global Settings</CardTitle>
            <CardDescription>Set the main currency, exchange rates, and support contact links for the entire application.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="currencySymbol">Currency Symbol</Label>
                      <Input
                        id="currencySymbol"
                        placeholder="e.g., $"
                        value={currencySymbol}
                        onChange={(e) => setCurrencySymbol(e.target.value)}
                        required
                      />
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="currencyPosition">Symbol Position</Label>
                        <Select value={currencyPosition} onValueChange={setCurrencyPosition}>
                            <SelectTrigger id="currencyPosition">
                                <SelectValue placeholder="Select position" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="left">Left</SelectItem>
                                <SelectItem value="right">Right</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="usdtRate">Rate to USDT</Label>
                  <Input
                    id="usdtRate"
                    type="number"
                    placeholder="e.g., 1.0"
                    value={usdtRate}
                    onChange={(e) => setUsdtRate(e.target.value)}
                    required
                    step="any"
                  />
                </div>
              </div>
              <div className="space-y-4 pt-4 border-t">
                 <div className="space-y-2">
                    <Label htmlFor="whatsappUrl">Global WhatsApp URL</Label>
                    <Input id="whatsappUrl" value={whatsappUrl} onChange={(e) => setWhatsappUrl(e.target.value)} placeholder="https://wa.me/..." />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="telegramUrl">Global Telegram URL</Label>
                    <Input id="telegramUrl" value={telegramUrl} onChange={(e) => setTelegramUrl(e.target.value)} placeholder="https://t.me/..." />
                </div>
              </div>
          </CardContent>
        </Card>
        
         <Card>
            <CardHeader>
                <CardTitle>Wallet Name & Icon</CardTitle>
                <CardDescription>Customize the appearance of the wallet in the header dropdown.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-4 p-4 border rounded-lg">
                    <h4 className="font-semibold">Main Wallet</h4>
                    <div className="space-y-2">
                        <Label htmlFor="mainWalletName">Wallet Name</Label>
                        <Input id="mainWalletName" value={mainWalletName} onChange={(e) => setMainWalletName(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="mainWalletIcon">Wallet Icon</Label>
                        <Input id="mainWalletIcon" value={mainWalletIcon} onChange={(e) => setMainWalletIcon(e.target.value)} />
                        <p className="text-xs text-muted-foreground">Enter an icon name from <a href="https://lucide.dev/icons/" target="_blank" rel="noopener noreferrer" className="underline">lucide.dev</a></p>
                    </div>
                </div>
            </CardContent>
        </Card>
        </form>
    </AdminLayout>
  );
}
