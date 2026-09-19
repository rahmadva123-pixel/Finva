
"use client";

import React, { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/layout/admin-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Trash2, Plus, ArrowUp, ArrowDown } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import Image from 'next/image';
import { Switch } from '@/components/ui/switch';

interface LinkItem {
    id: string;
    label: string;
    href: string;
}

interface MenuList {
    id: string;
    title: string;
    links: LinkItem[];
}

interface MobileFooterMenuItem {
    label: string;
    icon: string;
    href: string;
}

interface FooterSettings {
    brandDescription: string;
    logoUrl: string;
    menuLists: MenuList[];
    copyrightText: string;
    showOnAllPages: boolean;
    downloadAppTitle?: string;
    downloadAppSubtitle?: string;
    googlePlayImageUrl?: string;
    googlePlayLink?: string;
    appStoreImageUrl?: string;
    appStoreLink?: string;
    mobileFooterNav?: {
      enabled: boolean;
      items: MobileFooterMenuItem[];
    };
}

const initialSettings: FooterSettings = {
    brandDescription: "A modern trading platform to grow your wealth securely and confidently.",
    logoUrl: '',
    menuLists: [
        {
            id: '1',
            title: "Quick Links",
            links: [
                { id: 'l1', label: 'Home', href: '/' },
                { id: 'l2', label: 'About Us', href: '/about' },
                { id: 'l3', label: 'Contact', href: '/support' },
            ]
        }
    ],
    copyrightText: "© {year} All Rights Reserved.",
    showOnAllPages: true,
    downloadAppTitle: 'Download Our App',
    downloadAppSubtitle: 'Get the full experience on your mobile device.',
    googlePlayImageUrl: '',
    googlePlayLink: '#',
    appStoreImageUrl: '',
    appStoreLink: '#',
    mobileFooterNav: {
        enabled: true,
        items: [
            { label: 'Home', icon: 'Home', href: '/dashboard' },
            { label: 'Invest', icon: 'TrendingUp', href: '/dashboard/investment' },
            { label: 'Wallet', icon: 'Wallet', href: '/dashboard/finance/wallet' },
            { label: 'Team', icon: 'Users', href: '/dashboard/referral' },
            { label: 'Profile', icon: 'User', href: '/dashboard/profile' },
        ],
    },
};

export default function FooterSettingsPage() {
    const { toast } = useToast();
    const [settings, setSettings] = useState<FooterSettings>(initialSettings);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const fetchSettings = async () => {
            if (!db) { setLoading(false); return; }
            try {
                const docRef = doc(db, 'settings', 'footer');
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const data = { ...initialSettings, ...docSnap.data() };
                    data.mobileFooterNav = data.mobileFooterNav || initialSettings.mobileFooterNav;
                    // Ensure there are always 5 items for the mobile nav editor
                    if (data.mobileFooterNav) {
                        const mobileItems = data.mobileFooterNav?.items || [];
                        while(mobileItems.length < 5) {
                            mobileItems.push({ label: '', icon: '', href: '' });
                        }
                        data.mobileFooterNav.items = mobileItems.slice(0, 5);
                    }
                    setSettings(data as FooterSettings);
                } else {
                    await setDoc(docRef, initialSettings);
                    setSettings(initialSettings);
                }
            } catch (error) {
                console.error("Error fetching footer settings:", error);
                toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch footer settings.' });
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
            await setDoc(doc(db, 'settings', 'footer'), settings);
            toast({ title: "Success", description: "Footer settings saved successfully." });
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: `Failed to save settings: ${error.message}` });
        } finally {
            setSaving(false);
        }
    };

    const handleMenuListChange = (listIndex: number, field: 'title', value: string) => {
        const newMenuLists = [...settings.menuLists];
        newMenuLists[listIndex] = { ...newMenuLists[listIndex], [field]: value };
        setSettings(prev => ({ ...prev, menuLists: newMenuLists }));
    };

    const handleLinkChange = (listIndex: number, linkIndex: number, field: keyof LinkItem, value: string) => {
        const newMenuLists = [...settings.menuLists];
        const newLinks = [...newMenuLists[listIndex].links];
        newLinks[linkIndex] = { ...newLinks[linkIndex], [field]: value };
        newMenuLists[listIndex].links = newLinks;
        setSettings(prev => ({ ...prev, menuLists: newMenuLists }));
    };

    const addMenuList = () => {
        const newList: MenuList = { id: Date.now().toString(), title: "New Menu", links: [] };
        setSettings(prev => ({ ...prev, menuLists: [...prev.menuLists, newList] }));
    };

    const removeMenuList = (listIndex: number) => {
        setSettings(prev => ({ ...prev, menuLists: prev.menuLists.filter((_, i) => i !== listIndex) }));
    };

    const addLink = (listIndex: number) => {
        const newLink: LinkItem = { id: Date.now().toString(), label: "New Link", href: "#" };
        const newMenuLists = [...settings.menuLists];
        newMenuLists[listIndex].links.push(newLink);
        setSettings(prev => ({ ...prev, menuLists: newMenuLists }));
    };

    const removeLink = (listIndex: number, linkIndex: number) => {
        const newMenuLists = [...settings.menuLists];
        newMenuLists[listIndex].links = newMenuLists[listIndex].links.filter((_, i) => i !== linkIndex);
        setSettings(prev => ({ ...prev, menuLists: newMenuLists }));
    };
    
    const handleMobileNavItemChange = (index: number, field: keyof MobileFooterMenuItem, value: string) => {
        setSettings(prev => {
            if (!prev.mobileFooterNav) return prev;
            const newNav = { ...prev.mobileFooterNav };
            const newItems = [...newNav.items];
            newItems[index] = { ...newItems[index], [field]: value };
            newNav.items = newItems;
            return { ...prev, mobileFooterNav: newNav };
        });
    };

    if (loading) {
        return <AdminLayout><div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin" /></div></AdminLayout>;
    }

    return (
        <AdminLayout>
            <div className="space-y-8">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold font-headline">Footer Settings</h1>
                        <p className="text-muted-foreground">Customize the content and layout of your website's footer.</p>
                    </div>
                    <Button onClick={handleSave} disabled={saving}>
                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save Changes
                    </Button>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Global Footer Setting</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between p-4 border rounded-lg">
                            <div>
                                <Label htmlFor="showOnAllPages" className="font-semibold text-base">Show Footer on All Pages</Label>
                                <p className="text-sm text-muted-foreground">If disabled, the footer will only appear on the landing page.</p>
                            </div>
                            <Switch
                                id="showOnAllPages"
                                checked={settings.showOnAllPages}
                                onCheckedChange={(checked) => setSettings(p => ({...p, showOnAllPages: checked}))}
                            />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader><CardTitle>Brand Section</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="brandDescription">Brand Description</Label>
                            <Textarea id="brandDescription" value={settings.brandDescription} onChange={e => setSettings(p => ({...p, brandDescription: e.target.value}))} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="logoUrl">Logo Image URL</Label>
                            <Input id="logoUrl" value={settings.logoUrl} onChange={e => setSettings(p => ({...p, logoUrl: e.target.value}))} />
                        </div>
                    </CardContent>
                </Card>
                
                <Card>
                    <CardHeader><CardTitle>Download App Section</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="downloadAppTitle">Title</Label>
                            <Input id="downloadAppTitle" value={settings.downloadAppTitle || ''} onChange={e => setSettings(p => ({...p, downloadAppTitle: e.target.value}))} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="downloadAppSubtitle">Subtitle</Label>
                            <Input id="downloadAppSubtitle" value={settings.downloadAppSubtitle || ''} onChange={e => setSettings(p => ({...p, downloadAppSubtitle: e.target.value}))} />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
                            <div className="space-y-2">
                                <Label htmlFor="googlePlayImageUrl">Google Play Image URL</Label>
                                <Input id="googlePlayImageUrl" value={settings.googlePlayImageUrl || ''} onChange={e => setSettings(p => ({...p, googlePlayImageUrl: e.target.value}))} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="googlePlayLink">Google Play Link</Label>
                                <Input id="googlePlayLink" value={settings.googlePlayLink || ''} onChange={e => setSettings(p => ({...p, googlePlayLink: e.target.value}))} />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
                            <div className="space-y-2">
                                <Label htmlFor="appStoreImageUrl">App Store Image URL</Label>
                                <Input id="appStoreImageUrl" value={settings.appStoreImageUrl || ''} onChange={e => setSettings(p => ({...p, appStoreImageUrl: e.target.value}))} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="appStoreLink">App Store Link</Label>
                                <Input id="appStoreLink" value={settings.appStoreLink || ''} onChange={e => setSettings(p => ({...p, appStoreLink: e.target.value}))} />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Menu Link Lists</CardTitle>
                        <CardDescription>Add and manage columns of links in your footer.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {settings.menuLists.map((list, listIndex) => (
                            <Card key={list.id} className="bg-muted/50 p-4">
                                <div className="flex justify-between items-center mb-4">
                                    <Input value={list.title} onChange={e => handleMenuListChange(listIndex, 'title', e.target.value)} className="text-lg font-semibold flex-grow mr-4" />
                                    <Button variant="destructive" size="icon" onClick={() => removeMenuList(listIndex)}><Trash2 className="h-4 w-4" /></Button>
                                </div>
                                <div className="space-y-2">
                                    {list.links.map((link, linkIndex) => (
                                        <div key={link.id} className="flex items-center gap-2">
                                            <Input placeholder="Label" value={link.label} onChange={e => handleLinkChange(listIndex, linkIndex, 'label', e.target.value)} />
                                            <Input placeholder="URL (e.g., /about)" value={link.href} onChange={e => handleLinkChange(listIndex, linkIndex, 'href', e.target.value)} />
                                            <Button variant="ghost" size="icon" className="text-destructive" onClick={() => removeLink(listIndex, linkIndex)}><Trash2 className="h-4 w-4" /></Button>
                                        </div>
                                    ))}
                                </div>
                                <Button variant="outline" size="sm" onClick={() => addLink(listIndex)} className="mt-4"><Plus className="mr-2 h-4 w-4" />Add Link</Button>
                            </Card>
                        ))}
                        <Button onClick={addMenuList}><Plus className="mr-2 h-4 w-4" /> Add Menu List</Button>
                    </CardContent>
                </Card>

                 <Card>
                    <CardHeader><CardTitle>Mobile Footer Navigation</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between p-4 border rounded-lg">
                            <Label htmlFor="mobileNavEnabled" className="font-semibold text-base">Enable Mobile Footer Navigation</Label>
                            <Switch
                                id="mobileNavEnabled"
                                checked={settings.mobileFooterNav?.enabled}
                                onCheckedChange={(checked) => setSettings(p => ({...p, mobileFooterNav: { ...(p.mobileFooterNav!), enabled: checked }}))}
                            />
                        </div>
                        {settings.mobileFooterNav?.enabled && (
                            <div className="space-y-4">
                                <p className="text-sm text-muted-foreground">Define the 5 items for the mobile footer navigation. Use icon names from <a href="https://lucide.dev/icons/" target="_blank" rel="noopener noreferrer" className="underline">lucide.dev</a>.</p>
                                {Array.from({ length: 5 }).map((_, index) => {
                                    const item = settings.mobileFooterNav?.items[index] || { label: '', icon: '', href: '' };
                                    return (
                                        <div key={index} className="flex items-end gap-2 p-4 border rounded-md">
                                            <div className="grid grid-cols-3 gap-2 flex-grow">
                                                <div className="space-y-1">
                                                    <Label>Label</Label>
                                                    <Input value={item.label} onChange={(e) => handleMobileNavItemChange(index, 'label', e.target.value)} />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label>Icon</Label>
                                                    <Input value={item.icon} onChange={(e) => handleMobileNavItemChange(index, 'icon', e.target.value)} />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label>Link</Label>
                                                    <Input value={item.href} onChange={(e) => handleMobileNavItemChange(index, 'href', e.target.value)} />
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader><CardTitle>Copyright</CardTitle></CardHeader>
                    <CardContent>
                        <Label htmlFor="copyrightText">Copyright Text</Label>
                        <Input id="copyrightText" value={settings.copyrightText} onChange={e => setSettings(p => ({...p, copyrightText: e.target.value}))} />
                        <p className="text-xs text-muted-foreground mt-2">Use `{'{year}'}` to automatically insert the current year.</p>
                    </CardContent>
                </Card>
            </div>
        </AdminLayout>
    );
}
