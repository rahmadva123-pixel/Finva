
"use client";

import React, { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/layout/admin-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import { Preloader } from '@/components/ui/preloader';

interface ThemeColors {
    primary: string;
    background: string;
    accent: string;
}

export default function ThemeSettingsPage() {
    const { toast } = useToast();
    const [colors, setColors] = useState<ThemeColors>({
        primary: '142 76% 56%',
        background: '222 47% 11%',
        accent: '142 76% 56%',
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const fetchSettings = async () => {
            if(!db) { setLoading(false); return; }
            try {
                const docRef = doc(db, 'template', 'landingPage');
                const docSnap = await getDoc(docRef);
                if (docSnap.exists() && docSnap.data().themeColors) {
                    setColors(docSnap.data().themeColors);
                }
            } catch (error: any) {
                toast({ variant: 'destructive', title: 'Error', description: 'Failed to load theme settings.' });
            } finally {
                setLoading(false);
            }
        };
        fetchSettings();
    }, [toast]);
    
    const handleColorChange = (key: keyof ThemeColors, value: string) => {
        setColors(prev => ({...prev, [key]: value}));
        document.documentElement.style.setProperty(`--${key}`, value);
    }
    
    const handleSave = async () => {
        if(!db) return;
        setSaving(true);
        try {
            await setDoc(doc(db, 'template', 'landingPage'), { themeColors: colors }, { merge: true });
            toast({ title: 'Success!', description: 'Theme colors have been updated successfully.' });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: `Failed to save theme: ${error.message}` });
        } finally {
            setSaving(false);
        }
    };
    
    if (loading) {
        return (
            <AdminLayout>
                <div className="flex items-center justify-center h-full"><Preloader /></div>
            </AdminLayout>
        )
    }

    return (
        <AdminLayout>
            <div className="space-y-8">
                 <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold font-headline tracking-tight">Theme Settings</h1>
                        <p className="text-muted-foreground">Customize the main colors of your website.</p>
                    </div>
                     <Button onClick={handleSave} disabled={saving}>
                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                        Save Theme
                    </Button>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Global Colors</CardTitle>
                        <CardDescription>
                            Enter HSL values without 'hsl()' for the main theme colors. For example: `222 47% 11%`.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="grid md:grid-cols-2 gap-8">
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <Label htmlFor="primaryColor">Primary Color</Label>
                                <Input id="primaryColor" value={colors.primary} onChange={(e) => handleColorChange('primary', e.target.value)} />
                                <p className="text-xs text-muted-foreground">Used for main buttons, links, and important accents.</p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="backgroundColor">Background Color</Label>
                                <Input id="backgroundColor" value={colors.background} onChange={(e) => handleColorChange('background', e.target.value)} />
                                <p className="text-xs text-muted-foreground">The main background color of the site.</p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="accentColor">Accent Color</Label>
                                <Input id="accentColor" value={colors.accent} onChange={(e) => handleColorChange('accent', e.target.value)} />
                                 <p className="text-xs text-muted-foreground">Used for hover states and secondary highlights.</p>
                            </div>
                        </div>
                        <div className="space-y-6">
                            <h4 className="font-semibold text-center mb-4">Live Preview</h4>
                            <div className="p-8 rounded-lg" style={{ backgroundColor: `hsl(${colors.background})` }}>
                                <div className="space-y-4">
                                     <h3 className="text-xl font-bold" style={{ color: `hsl(${colors.primary})`}}>This is a Primary Header</h3>
                                     <p style={{ color: `hsl(var(--foreground))` }}>This is regular body text on the new background. It contrasts with the primary color.</p>
                                     <Button style={{ backgroundColor: `hsl(${colors.primary})`, color: `hsl(var(--primary-foreground))` }}>Primary Button</Button>
                                     <Button variant="outline" style={{ borderColor: `hsl(${colors.accent})`, color: `hsl(${colors.accent})` }}>Accent Button</Button>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </AdminLayout>
    )
}
