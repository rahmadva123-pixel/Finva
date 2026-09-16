
"use client";

import React, { useState, useEffect } from 'react';
import { AdminLayout } from "@/components/layout/admin-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';

interface StakingTemplate {
    id: string;
    cardBackgroundColor: string;
    cardBackgroundColor2?: string;
    cardTextColor: string;
    planNameColor: string;
    returnPercentageColor: string;
    durationColor: string;
    detailsLabelColor: string;
    detailsValueColor: string;
    buttonBackgroundColor: string;
    buttonTextColor: string;
    badgeBackgroundColor: string;
    badgeTextColor: string;
    returnPercentageBackgroundColor?: string;
    durationBackgroundColor?: string;
}

const initialTemplate: StakingTemplate = {
    id: 'default_staking',
    cardBackgroundColor: '#1a1a2e',
    cardBackgroundColor2: '#1a1a2e',
    cardTextColor: '#a0a0b0',
    planNameColor: '#ffffff',
    returnPercentageColor: '#69FAB4',
    returnPercentageBackgroundColor: 'rgba(0,0,0,0.3)',
    durationColor: '#ffffff',
    durationBackgroundColor: 'rgba(0,0,0,0.5)',
    detailsLabelColor: '#a0a0b0',
    detailsValueColor: '#ffffff',
    buttonBackgroundColor: '#69FAB4',
    buttonTextColor: '#1a1a2e',
    badgeBackgroundColor: 'rgba(105, 250, 180, 0.1)',
    badgeTextColor: '#69FAB4',
};

export default function AdminStakingTemplatePage() {
    const { toast } = useToast();
    const [template, setTemplate] = useState<StakingTemplate>(initialTemplate);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const fetchTemplate = async () => {
            if (!db) { setLoading(false); return; }
            try {
                const docRef = doc(db, 'settings', 'stakingTemplate');
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setTemplate({ ...initialTemplate, ...docSnap.data() } as StakingTemplate);
                } else {
                    await setDoc(docRef, initialTemplate);
                }
            } catch (error) {
                console.error("Error fetching staking template: ", error);
                toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch template.' });
            } finally {
                setLoading(false);
            }
        };
        fetchTemplate();
    }, [toast]);

    const handleColorChange = (field: keyof StakingTemplate, value: string) => {
        setTemplate(prev => ({ ...prev, [field]: value }));
    };

    const handleSaveChanges = async () => {
        setSaving(true);
        if(!db) return;
        try {
            await setDoc(doc(db, 'settings', 'stakingTemplate'), template);
            toast({ title: 'Success', description: 'Staking template saved successfully.' });
        } catch(error: any) {
            toast({ variant: 'destructive', title: 'Error', description: `Failed to save template: ${error.message}`});
        } finally {
            setSaving(false);
        }
    }
    
    if (loading) {
        return <AdminLayout><div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div></AdminLayout>;
    }

    const backgroundStyle = template.cardBackgroundColor2 
        ? { background: `linear-gradient(to bottom right, ${template.cardBackgroundColor}, ${template.cardBackgroundColor2})` }
        : { backgroundColor: template.cardBackgroundColor };

    return (
        <AdminLayout>
            <div className="flex flex-col gap-8">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold font-headline tracking-tight">Staking Card Template</h1>
                        <p className="text-muted-foreground">Customize the appearance of the staking plan cards.</p>
                    </div>
                </div>
                 <Card>
                    <CardHeader className="flex flex-row justify-between items-center">
                        <CardTitle>Template Editor</CardTitle>
                        <Button onClick={handleSaveChanges} disabled={saving}>
                            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save Changes
                        </Button>
                    </CardHeader>
                    <CardContent className="grid md:grid-cols-2 gap-8">
                        {/* Style Editor */}
                        <div className="space-y-6">
                            <h3 className="font-semibold text-lg">Color Settings</h3>
                            <div className="grid grid-cols-2 gap-4">
                                {Object.entries(template).filter(([key]) => key.includes('Color')).map(([key, value]) => (
                                    <div key={key} className="space-y-2">
                                        <Label className="capitalize text-sm">{key.replace(/([A-Z])/g, ' $1').replace('Color', ' Color')}</Label>
                                        <div className="flex items-center gap-2">
                                            <Input type="color" value={value as string} onChange={(e) => handleColorChange(key as any, e.target.value)} className="w-12 h-10 p-1" />
                                            <Input value={value as string} onChange={(e) => handleColorChange(key as any, e.target.value)} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Live Preview */}
                        <div>
                            <h3 className="font-semibold text-lg mb-4">Live Preview</h3>
                            <div style={backgroundStyle} className="rounded-lg flex flex-col overflow-hidden border">
                                <div className="relative h-40 w-full">
                                    <Image src="https://picsum.photos/seed/stake/400/200" alt="30 Day Stake" layout="fill" objectFit="cover" />
                                    <div 
                                        className="absolute top-4 right-4 px-3 py-1 rounded-md" 
                                        style={{backgroundColor: template.durationBackgroundColor || 'rgba(0,0,0,0.5)'}}
                                    >
                                        <p className="text-sm font-semibold" style={{color: template.durationColor}}>30 Days</p>
                                    </div>
                                </div>
                                <div className="p-6 flex-grow flex flex-col" style={{color: template.cardTextColor}}>
                                    <div className="text-center -mt-16 mb-4">
                                        <div 
                                            className="mx-auto h-24 w-24 rounded-full flex items-center justify-center border-4 border-background"
                                            style={{backgroundColor: template.returnPercentageBackgroundColor || 'rgba(0,0,0,0.3)'}}
                                        >
                                            <p className="text-4xl font-bold" style={{color: template.returnPercentageColor}}>
                                                5<span className="text-2xl">%</span>
                                            </p>
                                        </div>
                                        <h3 className="text-2xl font-bold font-headline mt-4" style={{color: template.planNameColor}}>30 Day Stake</h3>
                                        <p style={{color: template.durationColor}} className="text-sm mt-1">Total Return in 30 Days</p>
                                    </div>
                                    
                                    <div className="space-y-4 flex-grow mb-6">
                                        <div className="flex justify-between items-center text-sm py-3 border-y" style={{borderColor: 'rgba(255,255,255,0.1)'}}>
                                            <span style={{color: template.detailsLabelColor}}>Staking Period</span>
                                            <span className="font-semibold" style={{color: template.detailsValueColor}}>30 Days</span>
                                        </div>
                                        <div className="flex justify-between items-center text-sm pb-3 border-b" style={{borderColor: 'rgba(255,255,255,0.1)'}}>
                                            <span style={{color: template.detailsLabelColor}}>Capital Back</span>
                                            <Badge style={{backgroundColor: template.badgeBackgroundColor, color: template.badgeTextColor}}>Yes</Badge>
                                        </div>
                                        <div className="flex justify-between items-center text-sm pb-3 border-b" style={{borderColor: 'rgba(255,255,255,0.1)'}}>
                                            <span style={{color: template.detailsLabelColor}}>Min Stake</span>
                                            <span className="font-semibold" style={{color: template.detailsValueColor}}>$100</span>
                                        </div>
                                        <div className="flex justify-between items-center text-sm pb-3 border-b" style={{borderColor: 'rgba(255,255,255,0.1)'}}>
                                            <span style={{color: template.detailsLabelColor}}>Max Stake</span>
                                            <span className="font-semibold" style={{color: template.detailsValueColor}}>$1,000</span>
                                        </div>
                                    </div>

                                    <Button className="w-full mt-auto" style={{backgroundColor: template.buttonBackgroundColor, color: template.buttonTextColor}}>Stake Now</Button>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </AdminLayout>
    );
}
