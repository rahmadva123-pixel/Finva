
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { AdminLayout } from '@/components/layout/admin-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowUp, ArrowDown, Plus, Trash2, GripVertical } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { invalidateCachedDoc } from '@/lib/clientCache';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import Image from 'next/image';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";


// New interface for Icon Box
interface IconBoxSetting {
    id: string;
    iconUrl: string;
    iconWidth: number;
    iconHeight: number;
    title: string;
    subtitle?: string;
    link: string;
    overlayColor: string;
    // New fields for the updated design
    boxMinWidth?: number;
    boxBackgroundColor?: string;
    iconBackgroundColor?: string;
    iconColor?: string;
}

interface IconBoxSection {
    id: string;
    title: string;
    subtitle?: string;
    boxes: IconBoxSetting[];
}

interface DashboardSectionSetting {
    key: 'welcome' | 'chart' | `stats_${string}` | `icon_boxes_${string}` | 'recentTransactions' | 'announcement' | 'staking' | 'investment';
    visible: boolean;
}

interface StatCardSetting {
    id: string;
    key: 'totalDeposits' | 'totalWithdrawals' | 'pendingDeposits' | 'pendingWithdrawals' | 'totalInvestments' | 'activeInvestments' | 'totalReturnsFromInvests' | 'totalStakes' | 'totalReturnFromStakes' | 'totalActiveStakes' | 'totalPoolInvestments' | 'totalActivePool' | 'totalReturnFromPool' | 'totalReferrals' | 'totalRefCommissions';
    title: string;
    subtitle?: string;
    icon?: string;
    imageUrl?: string;
    bgColor?: string;
    bgUrl?: string;
}

interface StatCardSection {
    id: string; // Will be the same as the key in DashboardSectionSetting, e.g., 'stats_1625...
    title: string;
    subtitle?: string;
    cards: StatCardSetting[];
}

interface DashboardSettings {
    welcomeMessage?: string;
    welcomeBgUrl?: string;
    welcomeOverlayColor?: string;
    chartType: 'bar' | 'line';
    barChartColors: {
        investment: string;
        staking: string;
        pool: string;
        deposit: string;
        referral: string;
    };
    lineChartColors: {
        investment: string;
        staking: string;
        pool: string;
        deposit: string;
        referral: string;
    };
    chartSeriesVisibility: {
        investment: boolean;
        staking: boolean;
        pool: boolean;
        deposit: boolean;
        referral: boolean;
    };
    balanceBarBackgroundUrl: string;
    balanceBarOverlayColor: string;
    chartBackgroundUrl: string;
    chartOverlayColor: string;
    dashboardBackgroundUrl?: string;
    dashboardOverlayColor?: string;
    sections: DashboardSectionSetting[];
    statCardSections: StatCardSection[];
    iconBoxSections: IconBoxSection[];
    recentTransactionsBgUrl?: string;
    recentTransactionsOverlayColor?: string;
    announcementText?: string;
    announcementIconUrl?: string;
    announcementBgUrl?: string;
    announcementOverlayColor?: string;
    announcementSpeed?: number;
    announcementAnimationEnabled?: boolean;
    // New Staking Section fields
    stakingSectionTitle?: string;
    stakingSectionSubtitle?: string;
    stakingSectionBgUrl?: string;
    stakingSectionOverlayColor?: string;
    stakingSectionAvailableTabText?: string;
    stakingSectionMyStakesTabText?: string;
    stakingSectionCardWidth?: number;
    // New Investment Section fields
    investmentSectionTitle?: string;
    investmentSectionSubtitle?: string;
    investmentSectionBgUrl?: string;
    investmentSectionOverlayColor?: string;
    investmentSectionAvailableTabText?: string;
    investmentSectionMyInvestmentsTabText?: string;
}

const initialSettings: DashboardSettings = {
    welcomeMessage: 'Welcome back, {firstName} {lastName}!',
    welcomeBgUrl: '',
    welcomeOverlayColor: 'rgba(0,0,0,0.4)',
    chartType: 'bar',
    barChartColors: {
        investment: '#8884d8',
        staking: '#82ca9d',
        pool: '#ffc658',
        deposit: '#ff7300',
        referral: '#00C49F',
    },
    lineChartColors: {
        investment: '#8884d8',
        staking: '#82ca9d',
        pool: '#ffc658',
        deposit: '#ff7300',
        referral: '#00C49F',
    },
    chartSeriesVisibility: {
        investment: true,
        staking: true,
        pool: true,
        deposit: true,
        referral: true,
    },
    balanceBarBackgroundUrl: '',
    balanceBarOverlayColor: 'rgba(0,0,0,0.3)',
    chartBackgroundUrl: '',
    chartOverlayColor: 'rgba(0,0,0,0.1)',
    dashboardBackgroundUrl: '',
    dashboardOverlayColor: 'rgba(0,0,0,0.5)',
    sections: [
        { key: 'announcement', visible: true },
        { key: 'welcome', visible: true },
        { key: 'investment', visible: true },
        { key: 'staking', visible: true },
        { key: 'chart', visible: true },
        { key: 'recentTransactions', visible: true }
    ],
    statCardSections: [],
    iconBoxSections: [],
    recentTransactionsBgUrl: '',
    recentTransactionsOverlayColor: 'rgba(0,0,0,0.3)',
    announcementText: 'Welcome to our platform! All systems are operational.',
    announcementIconUrl: 'https://i.postimg.cc/jd89rfnx/OZ6z-HXvn7-E1e-ADi0-PU1-Lp-WQe-JDA.avif',
    announcementBgUrl: '',
    announcementOverlayColor: 'rgba(0,0,0,0.5)',
    announcementSpeed: 25,
    announcementAnimationEnabled: true,
    stakingSectionTitle: 'Staking Opportunities',
    stakingSectionSubtitle: 'Stake your assets to earn rewards.',
    stakingSectionBgUrl: '',
    stakingSectionOverlayColor: 'rgba(0,0,0,0.3)',
    stakingSectionAvailableTabText: 'Available Stakes',
    stakingSectionMyStakesTabText: 'My Stakes',
    stakingSectionCardWidth: 350,
    investmentSectionTitle: 'Investment Opportunities',
    investmentSectionSubtitle: 'Grow your capital with our investment plans.',
    investmentSectionBgUrl: '',
    investmentSectionOverlayColor: 'rgba(0,0,0,0.3)',
    investmentSectionAvailableTabText: 'Available Plans',
    investmentSectionMyInvestmentsTabText: 'My Investments',
}

const statCardOptions = [
    { value: 'totalDeposits', label: 'Total Deposits' },
    { value: 'totalWithdrawals', label: 'Total Withdrawals' },
    { value: 'pendingDeposits', label: 'Pending Deposits' },
    { value: 'pendingWithdrawals', label: 'Pending Withdrawals' },
    { value: 'totalInvestments', label: 'Total Investments' },
    { value: 'activeInvestments', label: 'Active Investments' },
    { value: 'totalReturnsFromInvests', label: 'Total Returns from Investments' },
    { value: 'totalStakes', label: 'Total Stakes' },
    { value: 'totalReturnFromStakes', label: 'Total Return from Stakes' },
    { value: 'totalActiveStakes', label: 'Total Active Stakes' },
    { value: 'totalPoolInvestments', label: 'Total Pool Investments' },
    { value: 'totalActivePool', label: 'Total Active Pool' },
    { value: 'totalReturnFromPool', label: 'Total Return from Pool' },
    { value: 'totalReferrals', label: 'Total Referrals' },
    { value: 'totalRefCommissions', label: 'Total Referral Commissions' },
];

export default function DashboardSettingsPage() {
    const { toast } = useToast();
    const [settings, setSettings] = useState<DashboardSettings>(initialSettings);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    
    // State for Stat Card dialog
    const [isCardDialogOpen, setIsCardDialogOpen] = useState(false);
    const [currentCard, setCurrentCard] = useState<Partial<StatCardSetting>>({});
    const [currentStatSectionId, setCurrentStatSectionId] = useState<string | null>(null);

    // State for Icon Box dialog
    const [isIconBoxDialogOpen, setIsIconBoxDialogOpen] = useState(false);
    const [currentIconBox, setCurrentIconBox] = useState<Partial<IconBoxSetting>>({});
    const [currentIconBoxSectionId, setCurrentIconBoxSectionId] = useState<string | null>(null);
    
    useEffect(() => {
        const fetchSettings = async () => {
            if(!db) return;
            try {
                const docRef = doc(db, 'settings', 'dashboard');
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const fetchedSettings = { ...initialSettings, ...docSnap.data() };
                    
                    const dynamicSectionKeys = [
                        ...(fetchedSettings.statCardSections || []).map((s: StatCardSection) => s.id),
                        ...(fetchedSettings.iconBoxSections || []).map((s: IconBoxSection) => s.id),
                    ];
                    
                    const allKeysFromData = new Set([
                        'announcement', 
                        'welcome',
                        'investment',
                        'staking',
                        'chart', 
                        'recentTransactions', 
                        ...dynamicSectionKeys
                    ]);

                    let sections = fetchedSettings.sections || [];
                    const existingKeysInSections = new Set(sections.map((s: DashboardSectionSetting) => s.key));

                    // Add any missing sections from the fetched data
                    allKeysFromData.forEach(key => {
                        if (!existingKeysInSections.has(key as DashboardSectionSetting['key'])) {
                            sections.push({ key: key as DashboardSectionSetting['key'], visible: true });
                        }
                    });
                    
                    // Filter out any sections that are no longer in the data (e.g. deleted dynamic sections)
                    sections = sections.filter((s: DashboardSectionSetting) => allKeysFromData.has(s.key as string));
                    
                    setSettings({ 
                        ...fetchedSettings,
                        sections,
                    });
                } else {
                    setSettings(initialSettings);
                }
            } catch (error: any) {
                toast({ variant: 'destructive', title: 'Error', description: `Failed to fetch settings: ${error.message}` });
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
            await setDoc(doc(db, 'settings', 'dashboard'), settings, { merge: true });
            toast({ title: 'Success', description: 'Dashboard settings updated.' });
            try { invalidateCachedDoc('settings', 'dashboard'); } catch (_) {}
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: `Failed to save settings: ${error.message}` });
        } finally {
            setSaving(false);
        }
    };
    
    const handleColorChange = (chart: 'bar' | 'line', key: string, value: string) => {
        const colorsKey = chart === 'bar' ? 'barChartColors' : 'lineChartColors';
        setSettings(prev => ({
            ...prev,
            [colorsKey]: {
                ...prev[colorsKey],
                [key]: value
            }
        }));
    };

    const handleSeriesVisibilityChange = (key: keyof DashboardSettings['chartSeriesVisibility'], value: boolean) => {
        setSettings(prev => ({
            ...prev,
            chartSeriesVisibility: {
                ...prev.chartSeriesVisibility,
                [key]: value
            }
        }));
    };
    
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        const isNumber = type === 'number';
        setSettings(prev => ({ ...prev, [name]: isNumber ? Number(value) : value }));
    };

    const handleSectionVisibility = (key: string, visible: boolean) => {
        setSettings(prev => ({
            ...prev,
            sections: prev.sections.map(s => s.key === key ? {...s, visible} : s)
        }));
    };

    const handleSectionOrder = (key: string, direction: 'up' | 'down') => {
        setSettings(prev => {
            const sections = [...prev.sections];
            const index = sections.findIndex(s => s.key === key);
            if(index === -1) return prev;

            if(direction === 'up' && index > 0) {
                [sections[index], sections[index - 1]] = [sections[index - 1], sections[index]];
            } else if (direction === 'down' && index < sections.length - 1) {
                [sections[index], sections[index + 1]] = [sections[index + 1], sections[index]];
            }
            return { ...prev, sections };
        });
    };
    
    // --- STATS CARD SECTION LOGIC ---
    const handleStatSectionInputChange = (sectionId: string, e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setSettings(prev => ({
            ...prev,
            statCardSections: prev.statCardSections.map(sec => 
                sec.id === sectionId ? { ...sec, [name]: value } : sec
            )
        }));
    }

    const handleOpenCardDialog = (sectionId: string, card: Partial<StatCardSetting> | null = null) => {
        setCurrentStatSectionId(sectionId);
        setCurrentCard(card || { key: 'totalDeposits', title: '', icon: 'Wallet', imageUrl: '', bgColor: 'rgba(0,0,0,0.3)' });
        setIsCardDialogOpen(true);
    };

    const handleSaveStatCard = () => {
        if (!currentCard || !currentCard.key || !currentStatSectionId) {
            toast({ variant: 'destructive', title: 'Error', description: 'Please select a stat type.' });
            return;
        }

        setSettings(prev => ({
            ...prev,
            statCardSections: prev.statCardSections.map(sec => {
                if (sec.id !== currentStatSectionId) return sec;

                const newCards = [...(sec.cards || [])];
                if (currentCard.id) {
                    const index = newCards.findIndex(c => c.id === currentCard.id);
                    if (index > -1) {
                        newCards[index] = currentCard as StatCardSetting;
                    }
                } else {
                    newCards.push({ ...currentCard, id: Date.now().toString() } as StatCardSetting);
                }
                return { ...sec, cards: newCards };
            })
        }));

        setIsCardDialogOpen(false);
        setCurrentCard({});
        setCurrentStatSectionId(null);
    };

    const handleDeleteStatCard = (sectionId: string, cardId: string) => {
        setSettings(prev => ({
            ...prev,
            statCardSections: prev.statCardSections.map(sec => 
                sec.id === sectionId ? { ...sec, cards: sec.cards.filter(c => c.id !== cardId) } : sec
            )
        }));
    };
    
    const handleAddStatSection = () => {
        const newId = `stats_${Date.now()}`;
        const newSection: StatCardSection = {
            id: newId,
            title: "New Stats Section",
            subtitle: "A subtitle for your new stats.",
            cards: [],
        };
        const newSectionOrder: DashboardSectionSetting = {
            key: newId as any,
            visible: true,
        };
        setSettings(prev => ({
            ...prev,
            statCardSections: [...prev.statCardSections, newSection],
            sections: [...prev.sections, newSectionOrder],
        }));
    };

    const handleDeleteStatSection = (sectionId: string) => {
        setSettings(prev => ({
            ...prev,
            statCardSections: prev.statCardSections.filter(sec => sec.id !== sectionId),
            sections: prev.sections.filter(sec => sec.key !== sectionId),
        }));
        toast({title: 'Section deleted', description: 'The stats section has been removed.'});
    };

    // --- ICON BOX SECTION LOGIC ---
    const handleAddIconBoxSection = () => {
        const newId = `icon_boxes_${Date.now()}`;
        const newSection: IconBoxSection = {
            id: newId,
            title: "New Icon Box Section",
            subtitle: "Clickable icon boxes.",
            boxes: [],
        };
        const newSectionOrder: DashboardSectionSetting = {
            key: newId as any,
            visible: true,
        };
        setSettings(prev => ({
            ...prev,
            iconBoxSections: [...(prev.iconBoxSections || []), newSection],
            sections: [...prev.sections, newSectionOrder],
        }));
    };

    const handleDeleteIconBoxSection = (sectionId: string) => {
        setSettings(prev => ({
            ...prev,
            iconBoxSections: prev.iconBoxSections.filter(sec => sec.id !== sectionId),
            sections: prev.sections.filter(sec => sec.key !== sectionId),
        }));
        toast({title: 'Section deleted', description: 'The icon box section has been removed.'});
    };

    const handleIconBoxSectionInputChange = (sectionId: string, e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setSettings(prev => ({
            ...prev,
            iconBoxSections: prev.iconBoxSections.map(sec => 
                sec.id === sectionId ? { ...sec, [name]: value } : sec
            )
        }));
    };

    const handleOpenIconBoxDialog = (sectionId: string, box: Partial<IconBoxSetting> | null = null) => {
        setCurrentIconBoxSectionId(sectionId);
        setCurrentIconBox(box || { iconUrl: '', iconWidth: 40, iconHeight: 40, title: '', link: '#', boxMinWidth: 180, boxBackgroundColor: 'hsl(var(--card))', iconBackgroundColor: 'hsla(var(--primary), 0.1)', iconColor: 'hsl(var(--primary))' });
        setIsIconBoxDialogOpen(true);
    };

    const handleSaveIconBox = () => {
        if (!currentIconBox || !currentIconBoxSectionId) return;
        setSettings(prev => ({
            ...prev,
            iconBoxSections: prev.iconBoxSections.map(sec => {
                if (sec.id !== currentIconBoxSectionId) return sec;
                const newBoxes = [...(sec.boxes || [])];
                if (currentIconBox.id) {
                    const index = newBoxes.findIndex(b => b.id === currentIconBox.id);
                    if (index > -1) newBoxes[index] = currentIconBox as IconBoxSetting;
                } else {
                    newBoxes.push({ ...currentIconBox, id: Date.now().toString() } as IconBoxSetting);
                }
                return { ...sec, boxes: newBoxes };
            })
        }));
        setIsIconBoxDialogOpen(false);
        setCurrentIconBox({});
        setCurrentIconBoxSectionId(null);
    };

    const handleDeleteIconBox = (sectionId: string, boxId: string) => {
        setSettings(prev => ({
            ...prev,
            iconBoxSections: prev.iconBoxSections.map(sec => 
                sec.id === sectionId ? { ...sec, boxes: sec.boxes.filter(b => b.id !== boxId) } : sec
            )
        }));
    };

    const sectionTitles: { [key: string]: string } = {
        welcome: "Welcome Message",
        chart: "Activity Chart",
        recentTransactions: "Recent Transactions",
        announcement: "Announcement",
        staking: "Staking Section",
        investment: "Investment Section"
    }

    const welcomeStyle: React.CSSProperties = {
        backgroundImage: settings.welcomeBgUrl ? `url(${settings.welcomeBgUrl})` : 'none',
        backgroundColor: settings.welcomeBgUrl ? 'transparent' : 'hsl(var(--card))',
        position: 'relative',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
    };
    
    const welcomeOverlayStyle: React.CSSProperties = {
        position: 'absolute',
        inset: 0,
        backgroundColor: settings.welcomeOverlayColor,
        zIndex: 0,
    };

  return (
    <AdminLayout>
      <div className="flex flex-col gap-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold font-headline tracking-tight">Dashboard Settings</h1>
            <p className="text-muted-foreground">Customize the user dashboard experience.</p>
          </div>
           <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
              Save Changes
            </Button>
        </div>
        
        <Card>
            <CardHeader>
                <CardTitle>Global Dashboard Style</CardTitle>
                <CardDescription>Apply a background image and overlay to the entire user dashboard.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-2">
                    <Label>Dashboard Background URL</Label>
                    <Input name="dashboardBackgroundUrl" value={settings.dashboardBackgroundUrl || ''} onChange={handleInputChange} />
                </div>
                <div className="space-y-2">
                    <Label>Dashboard Overlay Color</Label>
                    <Input name="dashboardOverlayColor" value={settings.dashboardOverlayColor || ''} onChange={handleInputChange} placeholder="e.g., rgba(0,0,0,0.5)" />
                </div>
            </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle>Dashboard Sections</CardTitle>
                <CardDescription>Add, remove, and reorder the sections on the user dashboard.</CardDescription>
            </CardHeader>
             <CardContent className="flex gap-4">
                <Button onClick={handleAddStatSection}><Plus className="mr-2 h-4 w-4" /> Add Stat Card Section</Button>
                <Button onClick={handleAddIconBoxSection}><Plus className="mr-2 h-4 w-4" /> Add Icon Box Section</Button>
             </CardContent>
        </Card>

        <Accordion type="multiple" className="w-full space-y-4">
            {settings.sections.map((section, index) => {
                const isStatSection = section.key.startsWith('stats_');
                const isIconBoxSection = section.key.startsWith('icon_boxes_');
                
                const statSection = isStatSection ? settings.statCardSections.find(s => s.id === section.key) : null;
                const iconBoxSection = isIconBoxSection ? settings.iconBoxSections.find(s => s.id === section.key) : null;
                
                let title = '';
                if(isStatSection && statSection) title = statSection.title;
                else if(isIconBoxSection && iconBoxSection) title = iconBoxSection.title;
                else title = sectionTitles[section.key as keyof typeof sectionTitles];
                
                if (!title) return null;

             return (
             <AccordionItem value={section.key} key={section.key} className="border-none">
                <div className="flex items-center pr-4 border rounded-lg">
                    <AccordionTrigger className="text-lg font-semibold flex-1 items-center px-4 hover:no-underline">
                        <span>{title}</span>
                    </AccordionTrigger>
                    <div className="flex items-center gap-2 ml-auto pl-4">
                        {(isStatSection || isIconBoxSection) && (
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="destructive" size="icon" className="h-8 w-8">
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This action cannot be undone. This will permanently delete this section and all of its contents.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => isStatSection ? handleDeleteStatSection(section.key) : handleDeleteIconBoxSection(section.key)}>
                                            Delete
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        )}
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleSectionOrder(section.key, 'up')} disabled={index === 0}><ArrowUp className="h-4 w-4"/></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleSectionOrder(section.key, 'down')} disabled={index === settings.sections.length - 1}><ArrowDown className="h-4 w-4"/></Button>
                         <Switch checked={section.visible} onCheckedChange={(checked) => handleSectionVisibility(section.key, checked)} />
                    </div>
                </div>
                <AccordionContent className="mt-2">
                {section.key === 'announcement' && (
                    <Card>
                        <CardHeader>
                            <CardDescription>Customize the scrolling announcement bar.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex items-center justify-between rounded-lg border p-4">
                                <Label htmlFor="announcementAnimationEnabled" className="font-medium">Enable Scrolling Animation</Label>
                                <Switch id="announcementAnimationEnabled" checked={settings.announcementAnimationEnabled} onCheckedChange={(checked) => setSettings(prev => ({...prev, announcementAnimationEnabled: checked}))} />
                            </div>
                            <div className="space-y-2">
                                <Label>Announcement Text</Label>
                                <Textarea name="announcementText" value={settings.announcementText || ''} onChange={handleInputChange} />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label>Icon URL</Label>
                                    <Input name="announcementIconUrl" value={settings.announcementIconUrl || ''} onChange={handleInputChange} />
                                </div>
                                 <div className="space-y-2">
                                    <Label>Scroll Speed (in seconds)</Label>
                                    <Input name="announcementSpeed" type="number" value={settings.announcementSpeed || 25} onChange={handleInputChange} />
                                </div>
                            </div>
                             <div className="space-y-2">
                                <Label>Background Image URL</Label>
                                <Input name="announcementBgUrl" value={settings.announcementBgUrl || ''} onChange={handleInputChange} />
                            </div>
                             <div className="space-y-2">
                                <Label>Overlay Color</Label>
                                <Input name="announcementOverlayColor" value={settings.announcementOverlayColor || ''} onChange={handleInputChange} placeholder="e.g., rgba(0,0,0,0.5)" />
                            </div>
                        </CardContent>
                    </Card>
                )}
                {section.key === 'welcome' && (
                    <Card>
                        <CardHeader>
                            <CardDescription>Customize the welcome banner on the user dashboard.</CardDescription>
                        </CardHeader>
                        <CardContent className="grid lg:grid-cols-2 gap-8">
                            <div className="space-y-6">
                                <div className="space-y-2">
                                <Label>Welcome Message</Label>
                                <Input name="welcomeMessage" value={settings.welcomeMessage || ''} onChange={handleInputChange} />
                                <p className="text-xs text-muted-foreground">Use {'{firstName}'} and {'{lastName}'} as placeholders.</p>
                                </div>
                                <div className="space-y-2">
                                <Label>Background Image URL</Label>
                                <Input name="welcomeBgUrl" value={settings.welcomeBgUrl || ''} onChange={handleInputChange} />
                                </div>
                                <div className="space-y-2">
                                <Label>Overlay Color (e.g., rgba(0,0,0,0.5))</Label>
                                <Input name="welcomeOverlayColor" value={settings.welcomeOverlayColor || ''} onChange={handleInputChange} />
                                </div>
                            </div>
                            <div className="space-y-4">
                                <h3 className="font-semibold text-lg text-center">Live Preview</h3>
                                <div style={welcomeStyle} className="p-6 rounded-lg text-white relative min-h-[100px] flex items-center justify-center text-center">
                                    <div style={welcomeOverlayStyle}></div>
                                    <div className="relative z-10">
                                        <h2 className="text-2xl font-bold font-headline">{settings.welcomeMessage?.replace('{firstName}', 'John').replace('{lastName}', 'Doe')}</h2>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}
                {statSection && (
                    <Card>
                        <CardHeader>
                            <CardDescription>Create and arrange stat cards shown in this section.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                             <div className="space-y-2">
                                <Label>Section Title</Label>
                                <Input name="title" value={statSection.title} onChange={(e) => handleStatSectionInputChange(section.key, e)} />
                            </div>
                            <div className="space-y-2">
                                <Label>Section Subtitle</Label>
                                <Input name="subtitle" value={statSection.subtitle || ''} onChange={(e) => handleStatSectionInputChange(section.key, e)} />
                            </div>
                            <Button type="button" onClick={() => handleOpenCardDialog(section.key)}>
                                <Plus className="mr-2 h-4 w-4"/> Add Stat Card
                            </Button>
                            <div className="space-y-2">
                                {statSection.cards.map(card => (
                                    <div key={card.id} className="flex items-center gap-2 p-2 border rounded-md">
                                        <GripVertical className="h-5 w-5 text-muted-foreground" />
                                        <span className="font-semibold flex-1">{card.title || statCardOptions.find(o => o.value === card.key)?.label}</span>
                                        <Button size="sm" variant="outline" onClick={() => handleOpenCardDialog(section.key, card)}>Edit</Button>
                                        <Button size="sm" variant="destructive" onClick={() => handleDeleteStatCard(section.key, card.id)}>Delete</Button>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}
                {iconBoxSection && (
                     <Card>
                        <CardHeader>
                            <CardDescription>Create and arrange icon boxes shown in this section.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                             <div className="space-y-2">
                                <Label>Section Title</Label>
                                <Input name="title" value={iconBoxSection.title} onChange={(e) => handleIconBoxSectionInputChange(section.key, e)} />
                            </div>
                            <div className="space-y-2">
                                <Label>Section Subtitle</Label>
                                <Input name="subtitle" value={iconBoxSection.subtitle || ''} onChange={(e) => handleIconBoxSectionInputChange(section.key, e)} />
                            </div>
                            <Button type="button" onClick={() => handleOpenIconBoxDialog(section.key)}>
                                <Plus className="mr-2 h-4 w-4"/> Add Icon Box
                            </Button>
                            <div className="space-y-2">
                                {iconBoxSection.boxes.map(box => (
                                    <div key={box.id} className="flex items-center gap-2 p-2 border rounded-md">
                                        <GripVertical className="h-5 w-5 text-muted-foreground" />
                                        {box.iconUrl && <Image src={box.iconUrl} alt={box.title} width={32} height={32} className="rounded-md" />}
                                        <span className="font-semibold flex-1">{box.title}</span>
                                        <Button size="sm" variant="outline" onClick={() => handleOpenIconBoxDialog(section.key, box)}>Edit</Button>
                                        <Button size="sm" variant="destructive" onClick={() => handleDeleteIconBox(section.key, box.id)}>Delete</Button>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}
                {section.key === 'chart' && (
                    <Card>
                        <CardHeader><CardTitle>Chart & Balance Bar Settings</CardTitle></CardHeader>
                        <CardContent className="space-y-6">
                             <div className="space-y-4 p-4 border rounded-md">
                                <h4 className="font-semibold">Balance Bar</h4>
                                <div className="space-y-2">
                                    <Label>Background Image URL</Label>
                                    <Input name="balanceBarBackgroundUrl" value={settings.balanceBarBackgroundUrl || ''} onChange={handleInputChange} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Overlay Color</Label>
                                    <Input name="balanceBarOverlayColor" value={settings.balanceBarOverlayColor || ''} onChange={handleInputChange} placeholder="e.g., rgba(0,0,0,0.5)" />
                                </div>
                            </div>
                            <div className="space-y-4 p-4 border rounded-md">
                                <h4 className="font-semibold">Chart Card</h4>
                                 <div className="space-y-2">
                                    <Label>Background Image URL</Label>
                                    <Input name="chartBackgroundUrl" value={settings.chartBackgroundUrl || ''} onChange={handleInputChange} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Overlay Color</Label>
                                    <Input name="chartOverlayColor" value={settings.chartOverlayColor || ''} onChange={handleInputChange} placeholder="e.g., rgba(0,0,0,0.5)" />
                                </div>
                            </div>
                             <div className="space-y-4 p-4 border rounded-md">
                                <h4 className="font-semibold">Chart Type</h4>
                                <Select value={settings.chartType} onValueChange={(val: 'bar' | 'line') => setSettings(p => ({...p, chartType: val}))}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="bar">Bar Chart</SelectItem>
                                        <SelectItem value="line">Line Chart</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                             <div className="space-y-4 p-4 border rounded-md">
                                <h4 className="font-semibold">Chart Series Visibility</h4>
                                <div className="grid grid-cols-2 gap-4">
                                {Object.keys(settings.chartSeriesVisibility).map(key => (
                                    <div key={key} className="flex items-center justify-between rounded-lg border p-3">
                                        <Label htmlFor={`vis-${key}`} className="capitalize">{key}</Label>
                                        <Switch id={`vis-${key}`} checked={settings.chartSeriesVisibility[key as keyof typeof settings.chartSeriesVisibility]} onCheckedChange={(c) => handleSeriesVisibilityChange(key as keyof typeof settings.chartSeriesVisibility, c)} />
                                    </div>
                                ))}
                                </div>
                            </div>
                             <div className="space-y-4 p-4 border rounded-md">
                                <h4 className="font-semibold">Chart Color Settings</h4>
                                <Tabs defaultValue="bar">
                                    <TabsList>
                                        <TabsTrigger value="bar">Bar Chart</TabsTrigger>
                                        <TabsTrigger value="line">Line Chart</TabsTrigger>
                                    </TabsList>
                                    <TabsContent value="bar" className="pt-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            {Object.keys(settings.barChartColors).map(key => (
                                                <div key={`bar-${key}`} className="space-y-2">
                                                    <Label className="capitalize">{key}</Label>
                                                    <Input type="color" value={settings.barChartColors[key as keyof typeof settings.barChartColors]} onChange={(e) => handleColorChange('bar', key, e.target.value)} />
                                                </div>
                                            ))}
                                        </div>
                                    </TabsContent>
                                    <TabsContent value="line" className="pt-4">
                                         <div className="grid grid-cols-2 gap-4">
                                            {Object.keys(settings.lineChartColors).map(key => (
                                                <div key={`line-${key}`} className="space-y-2">
                                                    <Label className="capitalize">{key}</Label>
                                                    <Input type="color" value={settings.lineChartColors[key as keyof typeof settings.lineChartColors]} onChange={(e) => handleColorChange('line', key, e.target.value)} />
                                                </div>
                                            ))}
                                        </div>
                                    </TabsContent>
                                </Tabs>
                            </div>
                        </CardContent>
                    </Card>
                )}
                 {section.key === 'investment' && (
                    <Card>
                        <CardHeader><CardTitle>Investment Section</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>Section Title</Label>
                                <Input name="investmentSectionTitle" value={settings.investmentSectionTitle || ''} onChange={handleInputChange} />
                            </div>
                            <div className="space-y-2">
                                <Label>Section Subtitle</Label>
                                <Input name="investmentSectionSubtitle" value={settings.investmentSectionSubtitle || ''} onChange={handleInputChange} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Tab 1 Text (Available)</Label>
                                    <Input name="investmentSectionAvailableTabText" value={settings.investmentSectionAvailableTabText || ''} onChange={handleInputChange} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Tab 2 Text (My Investments)</Label>
                                    <Input name="investmentSectionMyInvestmentsTabText" value={settings.investmentSectionMyInvestmentsTabText || ''} onChange={handleInputChange} />
                                </div>
                            </div>
                             <div className="space-y-2">
                                <Label>Background Image URL</Label>
                                <Input name="investmentSectionBgUrl" value={settings.investmentSectionBgUrl || ''} onChange={handleInputChange} />
                            </div>
                            <div className="space-y-2">
                                <Label>Overlay Color</Label>
                                <Input name="investmentSectionOverlayColor" value={settings.investmentSectionOverlayColor || ''} onChange={handleInputChange} placeholder="e.g., rgba(0,0,0,0.5)" />
                            </div>
                        </CardContent>
                    </Card>
                )}
                {section.key === 'staking' && (
                    <Card>
                        <CardHeader><CardTitle>Staking Section</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>Section Title</Label>
                                <Input name="stakingSectionTitle" value={settings.stakingSectionTitle || ''} onChange={handleInputChange} />
                            </div>
                            <div className="space-y-2">
                                <Label>Section Subtitle</Label>
                                <Input name="stakingSectionSubtitle" value={settings.stakingSectionSubtitle || ''} onChange={handleInputChange} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Tab 1 Text (Available)</Label>
                                    <Input name="stakingSectionAvailableTabText" value={settings.stakingSectionAvailableTabText || ''} onChange={handleInputChange} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Tab 2 Text (My Stakes)</Label>
                                    <Input name="stakingSectionMyStakesTabText" value={settings.stakingSectionMyStakesTabText || ''} onChange={handleInputChange} />
                                </div>
                            </div>
                             <div className="space-y-2">
                                <Label>Background Image URL</Label>
                                <Input name="stakingSectionBgUrl" value={settings.stakingSectionBgUrl || ''} onChange={handleInputChange} />
                            </div>
                            <div className="space-y-2">
                                <Label>Overlay Color</Label>
                                <Input name="stakingSectionOverlayColor" value={settings.stakingSectionOverlayColor || ''} onChange={handleInputChange} placeholder="e.g., rgba(0,0,0,0.5)" />
                            </div>
                             <div className="space-y-2">
                                <Label>Card Width (px)</Label>
                                <Input name="stakingSectionCardWidth" type="number" value={settings.stakingSectionCardWidth || 350} onChange={handleInputChange} />
                            </div>
                        </CardContent>
                    </Card>
                )}
                {section.key === 'recentTransactions' && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Recent Transactions Styling</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>Background Image URL</Label>
                                <Input name="recentTransactionsBgUrl" value={settings.recentTransactionsBgUrl || ''} onChange={handleInputChange} />
                            </div>
                            <div className="space-y-2">
                                <Label>Overlay Color</Label>
                                <Input name="recentTransactionsOverlayColor" value={settings.recentTransactionsOverlayColor || ''} onChange={handleInputChange} placeholder="e.g., rgba(0,0,0,0.5)" />
                            </div>
                        </CardContent>
                    </Card>
                )}
                </AccordionContent>
             </AccordionItem>
            )})}
        </Accordion>

      </div>
      
      <Dialog open={isCardDialogOpen} onOpenChange={setIsCardDialogOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>{currentCard?.id ? 'Edit' : 'Create'} Stat Card</DialogTitle>
                <DialogDescription>Configure the stat card for the user dashboard.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
                <div className="space-y-2">
                    <Label>Statistic Type</Label>
                    <Select value={currentCard?.key} onValueChange={(val: StatCardSetting['key']) => setCurrentCard(p => ({...p, key: val}))}>
                        <SelectTrigger><SelectValue placeholder="Select a statistic..."/></SelectTrigger>
                        <SelectContent>
                            {statCardOptions.map(opt => (
                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label>Card Title</Label>
                    <Input value={currentCard?.title || ''} onChange={e => setCurrentCard(p => ({...p, title: e.target.value}))} placeholder="e.g. Total Invested" />
                </div>
                <div className="space-y-2">
                    <Label>Card Subtitle (Optional)</Label>
                    <Input value={currentCard?.subtitle || ''} onChange={e => setCurrentCard(p => ({...p, subtitle: e.target.value}))} />
                </div>
                <div className="space-y-2">
                    <Label>Icon (Lucide name)</Label>
                    <Input value={currentCard?.icon || ''} onChange={e => setCurrentCard(p => ({...p, icon: e.target.value}))} placeholder="e.g. Wallet" />
                </div>
                <div className="space-y-2">
                    <Label>Icon Image URL (Overrides Lucide icon)</Label>
                    <Input value={currentCard?.imageUrl || ''} onChange={e => setCurrentCard(p => ({...p, imageUrl: e.target.value}))} placeholder="https://example.com/icon.png" />
                </div>
                 <div className="space-y-2">
                    <Label>Background Image URL</Label>
                    <Input value={currentCard?.bgUrl || ''} onChange={e => setCurrentCard(p => ({...p, bgUrl: e.target.value}))} />
                </div>
                 <div className="space-y-2">
                    <Label>Background Overlay Color</Label>
                    <Input value={currentCard?.bgColor || ''} onChange={e => setCurrentCard(p => ({...p, bgColor: e.target.value}))} placeholder="e.g. rgba(0,0,0,0.5)" />
                </div>
            </div>
            <DialogFooter>
                <Button variant="secondary" onClick={() => setIsCardDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleSaveStatCard}>Save Card</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isIconBoxDialogOpen} onOpenChange={setIsIconBoxDialogOpen}>
        <DialogContent className="max-w-2xl">
            <DialogHeader>
                <DialogTitle>{currentIconBox?.id ? 'Edit' : 'Create'} Icon Box</DialogTitle>
                <DialogDescription>Configure the icon box for the user dashboard.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-4">
                 <div className="space-y-2">
                    <Label>Link URL</Label>
                    <Input value={currentIconBox?.link || ''} onChange={e => setCurrentIconBox(p => ({...p, link: e.target.value}))} placeholder="/dashboard/finance/deposit" />
                </div>
                 <div className="space-y-2">
                    <Label>Title</Label>
                    <Input value={currentIconBox?.title || ''} onChange={e => setCurrentIconBox(p => ({...p, title: e.target.value}))} placeholder="e.g. Deposit" />
                </div>
                 <div className="space-y-2">
                    <Label>Subtitle (Optional)</Label>
                    <Input value={currentIconBox?.subtitle || ''} onChange={e => setCurrentIconBox(p => ({...p, subtitle: e.target.value}))} />
                </div>
                <div className="space-y-2">
                    <Label>Icon URL</Label>
                    <Input value={currentIconBox?.iconUrl || ''} onChange={e => setCurrentIconBox(p => ({...p, iconUrl: e.target.value}))} placeholder="https://example.com/icon.png" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Box Min Width (px)</Label>
                        <Input type="number" value={currentIconBox?.boxMinWidth || 180} onChange={e => setCurrentIconBox(p => ({...p, boxMinWidth: parseInt(e.target.value) || 180}))} />
                    </div>
                    <div className="space-y-2">
                        <Label>Icon Size (px)</Label>
                        <Input type="number" value={currentIconBox?.iconWidth || 40} onChange={e => setCurrentIconBox(p => ({...p, iconWidth: parseInt(e.target.value) || 40, iconHeight: parseInt(e.target.value) || 40}))} />
                    </div>
                </div>
                 <div className="space-y-2">
                    <Label>Box Background Color</Label>
                    <Input value={currentIconBox?.boxBackgroundColor || ''} onChange={e => setCurrentIconBox(p => ({...p, boxBackgroundColor: e.target.value}))} />
                </div>
                 <div className="space-y-2">
                    <Label>Icon Background Color</Label>
                    <Input value={currentIconBox?.iconBackgroundColor || ''} onChange={e => setCurrentIconBox(p => ({...p, iconBackgroundColor: e.target.value}))} />
                </div>
                 <div className="space-y-2">
                    <Label>Icon Color</Label>
                    <Input value={currentIconBox?.iconColor || ''} onChange={e => setCurrentIconBox(p => ({...p, iconColor: e.target.value}))} />
                </div>
            </div>
            <DialogFooter>
                <Button variant="secondary" onClick={() => setIsIconBoxDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleSaveIconBox}>Save Icon Box</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
