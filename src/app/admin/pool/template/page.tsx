
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
import { Loader2, CheckCircle, GripVertical } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import Image from 'next/image';

interface PoolTemplate {
    id: string;
    backgroundColor: string;
    backgroundColor2?: string;
    backgroundOverlayColor?: string;
    headerBackgroundColor: string;
    headerTextColor: string;
    returnRangeColor: string;
    returnRangeBackgroundColor: string;
    featureBackgroundColor: string;
    featureIconColor: string;
    featureTextColor: string;
    featureValueColor: string;
    progressBackgroundColor: string;
    progressIndicatorColor: string;
    buttonBackgroundColor: string;
    buttonTextColor: string;
    buttonText: string;
}

const initialTemplate: PoolTemplate = {
    id: 'default_pool',
    backgroundColor: '#111111',
    backgroundColor2: '#222222',
    backgroundOverlayColor: 'rgba(0,0,0,0)',
    headerBackgroundColor: '#00ff00',
    headerTextColor: '#000000',
    returnRangeColor: '#00ff00',
    returnRangeBackgroundColor: 'rgba(0, 255, 0, 0.2)',
    featureBackgroundColor: 'rgba(128, 128, 128, 0.2)',
    featureIconColor: '#00ff00',
    featureTextColor: '#a0a0b0',
    featureValueColor: '#ffffff',
    progressBackgroundColor: '#333333',
    progressIndicatorColor: '#00ff00',
    buttonBackgroundColor: '#00ff00',
    buttonTextColor: '#000000',
    buttonText: 'Invest Now',
};


export default function AdminPoolTemplatePage() {
    const { toast } = useToast();
    const [template, setTemplate] = useState<PoolTemplate>(initialTemplate);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const fetchTemplate = async () => {
            if (!db) { setLoading(false); return; }
            try {
                const docRef = doc(db, 'settings', 'poolTemplate');
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setTemplate({ ...initialTemplate, ...docSnap.data() } as PoolTemplate);
                } else {
                    await setDoc(docRef, initialTemplate);
                }
            } catch (error) {
                console.error("Error fetching pool template: ", error);
                toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch template.' });
            } finally {
                setLoading(false);
            }
        };
        fetchTemplate();
    }, [toast]);

    const handleColorChange = (field: keyof PoolTemplate, value: string) => {
        setTemplate(prev => ({ ...prev, [field]: value }));
    };

    const handleSaveChanges = async () => {
        setSaving(true);
        if(!db) return;
        try {
            await setDoc(doc(db, 'settings', 'poolTemplate'), template);
            toast({ title: 'Success', description: 'Pool template saved successfully.' });
        } catch(error: any) {
            toast({ variant: 'destructive', title: 'Error', description: `Failed to save template: ${error.message}`});
        } finally {
            setSaving(false);
        }
    }
    
    if (loading) {
        return <AdminLayout><div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div></AdminLayout>;
    }

    const backgroundStyle = template.backgroundColor2 
        ? { background: `linear-gradient(to bottom right, ${template.backgroundColor}, ${template.backgroundColor2})` }
        : { backgroundColor: template.backgroundColor };

    return (
        <AdminLayout>
            <div className="flex flex-col gap-8">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold font-headline tracking-tight">Pool Card Template</h1>
                        <p className="text-muted-foreground">Customize the appearance of the pool plan cards.</p>
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
                                <div className="space-y-2">
                                   <Label className="capitalize text-sm">BG Overlay Color</Label>
                                   <div className="flex items-center gap-2">
                                        <Input type="text" value={template.backgroundOverlayColor || ''} onChange={(e) => handleColorChange('backgroundOverlayColor', e.target.value)} placeholder="rgba(0,0,0,0.5)"/>
                                   </div>
                                   <p className="text-xs text-muted-foreground">Use RGBA: rgba(0,0,0,0.5)</p>
                                </div>
                                {Object.entries(template).filter(([key]) => (key.endsWith('Color') || key.endsWith('Color2')) && !key.includes('Overlay')).map(([key, value]) => (
                                    <div key={key} className="space-y-2">
                                        <Label className="capitalize text-sm">{key.replace(/([A-Z])/g, ' $1').replace('Color', ' Color')}</Label>
                                        <div className="flex items-center gap-2">
                                            <Input type="color" value={value as string} onChange={(e) => handleColorChange(key as any, e.target.value)} className="w-12 h-10 p-1" />
                                            <Input value={value as string} onChange={(e) => handleColorChange(key as any, e.target.value)} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                            
                            <h3 className="font-semibold text-lg mt-8">Content Settings</h3>
                            <div className="space-y-2">
                                <Label>Button Text</Label>
                                <Input value={template.buttonText} onChange={e => setTemplate(p => ({...p, buttonText: e.target.value}))} />
                            </div>
                        </div>

                        {/* Live Preview */}
                        <div>
                            <h3 className="font-semibold text-lg mb-4">Live Preview</h3>
                            <div style={{...backgroundStyle, position: 'relative'}} className="border border-green-500/20 rounded-2xl p-4 flex flex-col space-y-4">
                                <div style={{position: 'absolute', inset: 0, backgroundColor: template.backgroundOverlayColor || 'transparent', borderRadius: 'inherit' }}></div>
                                <div className="relative z-10 flex flex-col space-y-4 h-full">
                                    <div style={{ backgroundColor: template.headerBackgroundColor, color: template.headerTextColor }} className="text-center font-bold py-2 rounded-lg -mt-8 mx-8">
                                        Example Pool
                                    </div>
                                    <div className="relative h-40 w-full rounded-lg overflow-hidden">
                                        <Image src="https://picsum.photos/seed/pool/400/200" alt="Example Pool" layout="fill" objectFit="cover" />
                                    </div>
                                    <div style={{ backgroundColor: template.returnRangeBackgroundColor, color: template.returnRangeColor }} className="text-center font-bold text-3xl py-3 rounded-lg">
                                        5% - 15%
                                    </div>
                                    <div className="space-y-3 text-sm flex-grow">
                                        <div style={{ backgroundColor: template.featureBackgroundColor }} className="flex items-center justify-between p-3 rounded-lg">
                                        <span style={{ color: template.featureTextColor }} className="flex items-center gap-2"><CheckCircle style={{ color: template.featureIconColor }} className="h-4 w-4"/> Total Amount</span>
                                        <span style={{ color: template.featureValueColor }} className="font-semibold">$100,000</span>
                                        </div>
                                        <div style={{ backgroundColor: template.featureBackgroundColor }} className="flex items-center justify-between p-3 rounded-lg">
                                        <span style={{ color: template.featureTextColor }} className="flex items-center gap-2"><CheckCircle style={{ color: template.featureIconColor }} className="h-4 w-4"/> Invest till</span>
                                        <span style={{ color: template.featureValueColor }} className="font-semibold">2025-12-10</span>
                                        </div>
                                        <div style={{ backgroundColor: template.featureBackgroundColor }} className="flex items-center justify-between p-3 rounded-lg">
                                        <span style={{ color: template.featureTextColor }} className="flex items-center gap-2"><CheckCircle style={{ color: template.featureIconColor }} className="h-4 w-4"/> Return Date</span>
                                        <span style={{ color: template.featureValueColor }} className="font-semibold">2026-01-15</span>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <p className="text-sm text-center" style={{ color: template.featureTextColor }}>Invested Amount</p>
                                        <p className="text-center font-semibold" style={{ color: template.featureValueColor }}>
                                        $75,000 / $100,000
                                        </p>
                                        <Progress value={75} className="h-2" style={{ backgroundColor: template.progressBackgroundColor }} />
                                    </div>
                                    <Button className="w-full font-bold mt-auto" style={{ backgroundColor: template.buttonBackgroundColor, color: template.buttonTextColor }}>
                                        {template.buttonText}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </AdminLayout>
    );
}
