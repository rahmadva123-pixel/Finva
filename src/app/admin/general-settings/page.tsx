
"use client";

import React, { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/layout/admin-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { normalizeBrandText } from '@/lib/branding';
import { invalidateCachedDoc } from '@/lib/clientCache';

export interface NavItem {
  key: 'finance' | 'bonus' | 'shareAndEarn' | 'ico' | 'about' | 'rewards';
  enabled: boolean;
  label: string;
}

const initialNavItems: NavItem[] = [
  { key: 'ico', enabled: true, label: 'ICO Presale' },
  { key: 'finance', enabled: true, label: 'Finance' },
  { key: 'bonus', enabled: true, label: 'Bonus' },
  { key: 'shareAndEarn', enabled: true, label: 'Share & Earn' },
  { key: 'rewards', enabled: true, label: 'Rewards' },
  { key: 'about', enabled: true, label: 'About Us' },
];

export default function GeneralSettingsPage() {
  const { toast } = useToast();
  const [navItems, setNavItems] = useState<NavItem[]>(initialNavItems);
  const [siteTitle, setSiteTitle] = useState('');
  const [faviconUrl, setFaviconUrl] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [preloaderEnabled, setPreloaderEnabled] = useState(true);
  const [preloaderBackgroundUrl, setPreloaderBackgroundUrl] = useState('');
  const [preloaderOverlayColor, setPreloaderOverlayColor] = useState('');
  const [preloaderPoweredByText, setPreloaderPoweredByText] = useState('POWERED BY');
  const [preloaderPoweredByLogo, setPreloaderPoweredByLogo] = useState('');
  const [preloaderPoweredByLogoWidth, setPreloaderPoweredByLogoWidth] = useState<number | ''>(80);
  const [preloaderPoweredByLogoHeight, setPreloaderPoweredByLogoHeight] = useState<number | ''>(20);
  const [emailVerificationEnabled, setEmailVerificationEnabled] = useState(true);
  const [sidebarColor1, setSidebarColor1] = useState('rgba(25, 25, 41, 0.5)');
  const [sidebarColor2, setSidebarColor2] = useState('rgba(42, 42, 66, 0.5)');
  
  // New PDF Branding State
  const [companyName, setCompanyName] = useState('');
  const [companySlogan, setCompanySlogan] = useState('');
  const [pdfHeaderType, setPdfHeaderType] = useState('logo_and_text');
  const [pdfHeaderTextColor, setPdfHeaderTextColor] = useState('#000000');
  const [pdfSloganTextColor, setPdfSloganTextColor] = useState('#555555');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // Refreshment bonus settings
  const [refreshmentEnabled, setRefreshmentEnabled] = useState(true);
  const [refreshmentAmount, setRefreshmentAmount] = useState<number | ''>(50);
  const [refreshmentAutoCredit, setRefreshmentAutoCredit] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      if (!db) {
        setLoading(false);
        return;
      }
      try {
        const navRef = doc(db, 'settings', 'navigation');
        const navSnap = await getDoc(navRef);
        if (navSnap.exists() && navSnap.data().items) {
          const savedItems = navSnap.data().items as NavItem[];
          
           const savedOrder = savedItems.map(i => i.key);
           const initialMap = new Map(initialNavItems.map(i => [i.key, i]));
           const savedMap = new Map(savedItems.map(i => [i.key, i]));

           const merged = initialNavItems.map(initItem => {
             const saved = savedMap.get(initItem.key);
             return saved ? saved : initItem;
           });

          setNavItems(merged);
        } else {
            setNavItems(initialNavItems);
        }
        
        const generalRef = doc(db, 'settings', 'general');
        const generalSnap = await getDoc(generalRef);
        if (generalSnap.exists()) {
            const data = generalSnap.data();
            setSiteTitle(normalizeBrandText(data.siteTitle));
            setFaviconUrl(data.faviconUrl || 'https://i.postimg.cc/Cx56dy7N/icons8-crypto-100.png');
            setLogoUrl(data.logoUrl || '');
            setPreloaderEnabled(data.preloaderEnabled ?? true);
            setPreloaderBackgroundUrl(data.preloaderBackgroundUrl || '');
            setPreloaderOverlayColor(data.preloaderOverlayColor || 'rgba(0, 0, 0, 0.5)');
            setPreloaderPoweredByText(data.preloaderPoweredByText || 'POWERED BY');
            setPreloaderPoweredByLogo(data.preloaderPoweredByLogo || '');
            setPreloaderPoweredByLogoWidth(data.preloaderPoweredByLogoWidth || 80);
            setPreloaderPoweredByLogoHeight(data.preloaderPoweredByLogoHeight || 20);
            setEmailVerificationEnabled(data.emailVerificationEnabled ?? true);
            setSidebarColor1(data.sidebarColor1 || 'rgba(25, 25, 41, 0.5)');
            setSidebarColor2(data.sidebarColor2 || 'rgba(42, 42, 66, 0.5)');
            // PDF Branding
            setCompanyName(data.companyName || '');
            setCompanySlogan(data.companySlogan || '');
            setPdfHeaderType(data.pdfHeaderType || 'logo_and_text');
            setPdfHeaderTextColor(data.pdfHeaderTextColor || '#000000');
            setPdfSloganTextColor(data.pdfSloganTextColor || '#555555');
            // refreshment settings stored under settings/refreshment
            const refreshRef = doc(db, 'settings', 'refreshment');
            const refreshSnap = await getDoc(refreshRef);
            if (refreshSnap.exists()) {
              const rdata = refreshSnap.data();
              setRefreshmentEnabled(rdata.enabled ?? true);
              setRefreshmentAmount(rdata.amount ?? 50);
              setRefreshmentAutoCredit(rdata.autoCredit ?? false);
            }
        } else {
          setSiteTitle('Finva');
            setFaviconUrl('https://i.postimg.cc/Cx56dy7N/icons8-crypto-100.png');
            setEmailVerificationEnabled(true);
            setPreloaderEnabled(true);
            setPreloaderOverlayColor('rgba(0, 0, 0, 0.5)');
            setPreloaderPoweredByText('POWERED BY');
            setPreloaderPoweredByLogoWidth(80);
            setPreloaderPoweredByLogoHeight(20);
        }

      } catch (error) {
        console.error('Error fetching settings:', error);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Could not fetch settings.',
        });
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, [toast]);

  const handleLabelChange = (key: NavItem['key'], value: string) => {
    setNavItems(prev =>
      prev.map(item => (item.key === key ? { ...item, label: value } : item))
    );
  };

  const handleToggleChange = (key: NavItem['key'], checked: boolean) => {
    setNavItems(prev =>
      prev.map(item => (item.key === key ? { ...item, enabled: checked } : item))
    );
  };
  
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
    await setDoc(doc(db, 'settings', 'navigation'), { items: navItems }, { merge: true });
    await setDoc(doc(db, 'settings', 'general'), { 
          siteTitle, 
          faviconUrl, 
          emailVerificationEnabled, 
          sidebarColor1, 
          sidebarColor2, 
          preloaderEnabled, 
          logoUrl,
          preloaderBackgroundUrl,
          preloaderOverlayColor,
          preloaderPoweredByText,
          preloaderPoweredByLogo,
          preloaderPoweredByLogoWidth: Number(preloaderPoweredByLogoWidth) || 80,
          preloaderPoweredByLogoHeight: Number(preloaderPoweredByLogoHeight) || 20,
          companyName,
          companySlogan,
          pdfHeaderType,
          pdfHeaderTextColor,
          pdfSloganTextColor,
          }, { merge: true });
        // Save refreshment settings separately
        await setDoc(doc(db, 'settings', 'refreshment'), { enabled: refreshmentEnabled, amount: Number(refreshmentAmount) || 50, autoCredit: !!refreshmentAutoCredit }, { merge: true });
        // Invalidate client cache so changes are visible immediately
        try { invalidateCachedDoc('settings', 'navigation'); } catch (_) {}
        try { invalidateCachedDoc('settings', 'general'); } catch (_) {}
        try { invalidateCachedDoc('settings', 'refreshment'); } catch (_) {}
      toast({
        title: 'Success',
        description: 'General settings have been saved.',
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
        <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <form onSubmit={handleSubmit} className="flex flex-col gap-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold font-headline tracking-tight">General Settings</h1>
            <p className="text-muted-foreground">Control global application settings and navigation.</p>
          </div>
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>Site Identity</CardTitle>
            <CardDescription>Customize your site's title, logos, and favicon.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
             <div className="space-y-2">
                <Label htmlFor="siteTitle">Site Title</Label>
                <Input id="siteTitle" value={siteTitle} onChange={(e) => setSiteTitle(e.target.value)} />
             </div>
             <div className="space-y-2">
                <Label htmlFor="faviconUrl">Favicon URL</Label>
                <Input id="faviconUrl" value={faviconUrl} onChange={(e) => setFaviconUrl(e.target.value)} placeholder="https://example.com/favicon.ico" />
             </div>
             <div className="space-y-2">
                <Label htmlFor="logoUrl">Shared Logo URL</Label>
                <Input id="logoUrl" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="URL for preloader, PDFs, etc." />
             </div>
          </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle>PDF Branding</CardTitle>
                <CardDescription>Set up the header for all exported PDF documents.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-2">
                    <Label htmlFor="companyName">Company Name</Label>
                    <Input id="companyName" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Your Company Name" />
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="companySlogan">Company Slogan (Optional)</Label>
                    <Input id="companySlogan" value={companySlogan} onChange={(e) => setCompanySlogan(e.target.value)} placeholder="Your company's slogan or tagline" />
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="pdfHeaderType">PDF Header Type</Label>
                    <Select value={pdfHeaderType} onValueChange={(val: 'logo_only' | 'text_only' | 'logo_and_text') => setPdfHeaderType(val)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="logo_only">Logo Only</SelectItem>
                            <SelectItem value="text_only">Text Only</SelectItem>
                            <SelectItem value="logo_and_text">Logo and Text</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t">
                    <div className="space-y-2">
                        <Label htmlFor="pdfHeaderTextColor">Header Text Color</Label>
                        <Input id="pdfHeaderTextColor" type="color" value={pdfHeaderTextColor} onChange={(e) => setPdfHeaderTextColor(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="pdfSloganTextColor">Slogan Text Color</Label>
                        <Input id="pdfSloganTextColor" type="color" value={pdfSloganTextColor} onChange={(e) => setPdfSloganTextColor(e.target.value)} />
                    </div>
                </div>
            </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle>Preloader / Splash Screen</CardTitle>
                <CardDescription>Manage the initial loading screen for your application.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                 <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
                    <div>
                        <Label htmlFor="preloaderEnabled" className="text-base font-semibold">Enable Preloader</Label>
                        <p className="text-sm text-muted-foreground">Show a loading screen when users first visit the site.</p>
                    </div>
                    <Switch
                        id="preloaderEnabled"
                        checked={preloaderEnabled}
                        onCheckedChange={setPreloaderEnabled}
                    />
                </div>
                 <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="preloaderBackgroundUrl">Background Image URL</Label>
                        <Input id="preloaderBackgroundUrl" value={preloaderBackgroundUrl} onChange={(e) => setPreloaderBackgroundUrl(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="preloaderOverlayColor">Background Overlay Color</Label>
                        <Input id="preloaderOverlayColor" value={preloaderOverlayColor} onChange={(e) => setPreloaderOverlayColor(e.target.value)} placeholder="e.g., rgba(0, 0, 0, 0.5)" />
                    </div>
                 </div>
                 <div className="space-y-4 pt-4 border-t">
                     <h4 className="font-semibold">"Powered By" Section</h4>
                     <div className="space-y-2">
                        <Label htmlFor="preloaderPoweredByText">"Powered By" Text</Label>
                        <Input id="preloaderPoweredByText" value={preloaderPoweredByText} onChange={(e) => setPreloaderPoweredByText(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="preloaderPoweredByLogo">"Powered By" Logo URL</Label>
                        <Input id="preloaderPoweredByLogo" value={preloaderPoweredByLogo} onChange={(e) => setPreloaderPoweredByLogo(e.target.value)} />
                    </div>
                     <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="preloaderPoweredByLogoWidth">Logo Width (px)</Label>
                            <Input id="preloaderPoweredByLogoWidth" type="number" value={preloaderPoweredByLogoWidth} onChange={(e) => setPreloaderPoweredByLogoWidth(e.target.value === '' ? '' : Number(e.target.value))} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="preloaderPoweredByLogoHeight">Logo Height (px)</Label>
                            <Input id="preloaderPoweredByLogoHeight" type="number" value={preloaderPoweredByLogoHeight} onChange={(e) => setPreloaderPoweredByLogoHeight(e.target.value === '' ? '' : Number(e.target.value))} />
                        </div>
                     </div>
                 </div>
            </CardContent>
        </Card>
        
        <Card>
            <CardHeader>
                <CardTitle>Sidebar Style</CardTitle>
                <CardDescription>Customize the user dashboard sidebar background.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <Label htmlFor="sidebarColor1">Gradient Color 1</Label>
                    <Input id="sidebarColor1" value={sidebarColor1} onChange={(e) => setSidebarColor1(e.target.value)} placeholder="e.g., rgba(25, 25, 41, 0.5)"/>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="sidebarColor2">Gradient Color 2</Label>
                    <Input id="sidebarColor2" value={sidebarColor2} onChange={(e) => setSidebarColor2(e.target.value)} placeholder="e.g., rgba(42, 42, 66, 0.5)"/>
                </div>
                 <div className="md:col-span-2 space-y-2">
                    <Label>Live Preview</Label>
                    <div className="p-4 rounded-lg h-40" style={{background: `linear-gradient(to bottom, ${sidebarColor1}, ${sidebarColor2})`}}>
                    </div>
                </div>
            </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Refreshment Bonus</CardTitle>
            <CardDescription>Enable/disable refreshment bonuses and set the claim amount.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
              <div>
                <Label htmlFor="refreshmentEnabled" className="text-base font-semibold">Enable Refreshment Bonus</Label>
                <p className="text-sm text-muted-foreground">When enabled, referrers receive a claimable bonus when a referred user's deposit is approved.</p>
              </div>
              <Switch id="refreshmentEnabled" checked={refreshmentEnabled} onCheckedChange={setRefreshmentEnabled} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="refreshmentAmount">Refreshment Bonus Amount (USD)</Label>
              <Input id="refreshmentAmount" type="number" value={refreshmentAmount} onChange={(e) => setRefreshmentAmount(e.target.value === '' ? '' : Number(e.target.value))} />
            </div>
            <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
              <div>
                <Label htmlFor="refreshmentAutoCredit" className="text-base font-semibold">Auto-credit on approval</Label>
                <p className="text-sm text-muted-foreground">If enabled, referrers are auto-credited the refreshment bonus when a referred deposit is approved.</p>
              </div>
              <Switch id="refreshmentAutoCredit" checked={refreshmentAutoCredit} onCheckedChange={setRefreshmentAutoCredit} />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>User Authentication</CardTitle>
            <CardDescription>Manage how users sign up and log in.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
              <div>
                <Label htmlFor="email-verification" className="text-base font-semibold">Require Email Verification</Label>
                <p className="text-sm text-muted-foreground">If enabled, new users must verify their email address before they can log in.</p>
              </div>
              <Switch
                id="email-verification"
                checked={emailVerificationEnabled}
                onCheckedChange={setEmailVerificationEnabled}
              />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Navigation Menu Settings</CardTitle>
            <CardDescription>Enable, disable, and rename the main navigation items for users.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
                {navItems.map((item) => (
                    <div
                        key={item.key}
                        className="flex items-center justify-between p-4 border rounded-lg bg-muted/30"
                    >
                        <div className="flex items-center gap-4 flex-grow">
                            <Switch
                                checked={item.enabled}
                                onCheckedChange={(checked) => handleToggleChange(item.key, checked)}
                                id={`switch-${item.key}`}
                            />
                            <Label htmlFor={`switch-${item.key}`} className="text-lg font-semibold capitalize">{item.label}</Label>
                        </div>
                        <div className="w-full md:w-auto md:max-w-xs">
                            <Label htmlFor={`input-${item.key}`} className="sr-only">Label for {item.key}</Label>
                            <Input
                                id={`input-${item.key}`}
                                value={item.label}
                                onChange={(e) => handleLabelChange(item.key, e.target.value)}
                                disabled={!item.enabled}
                            />
                        </div>
                    </div>
                ))}
            </div>
          </CardContent>
        </Card>
      </form>
    </AdminLayout>
  );
}
