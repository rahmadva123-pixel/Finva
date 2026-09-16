
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { AdminLayout } from "@/components/layout/admin-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Search } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { allLanguages } from '@/lib/languages';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';

interface LanguageSetting {
    [code: string]: boolean;
}

export default function LanguageSettingsPage() {
    const { toast } = useToast();
    const [settings, setSettings] = useState<LanguageSetting>({});
    const [translationEnabled, setTranslationEnabled] = useState(true);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const fetchSettings = useCallback(async () => {
        if (!db) { setLoading(false); return; }
        setLoading(true);
        try {
            const docRef = doc(db, 'settings', 'languages');
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                setSettings(data.languages || {});
                setTranslationEnabled(data.translationEnabled ?? true);
            } else {
                 setSettings({'en': true}); // Default to English
                 setTranslationEnabled(true);
            }
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to fetch settings.' });
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        fetchSettings();
    }, [fetchSettings]);

    const handleToggle = (code: string, checked: boolean) => {
        if (code === 'en' && !checked) {
            toast({ variant: 'destructive', title: 'Action Denied', description: 'English cannot be disabled.' });
            return;
        }
        setSettings(prev => ({ ...prev, [code]: checked }));
    };

    const handleSave = async () => {
        if (!db) return;
        setSaving(true);
        try {
            const enabledLanguages = Object.keys(settings).filter(key => settings[key]);
            if (!enabledLanguages.includes('en')) {
                enabledLanguages.push('en');
            }
            await setDoc(doc(db, 'settings', 'languages'), { 
                languages: settings, 
                enabledLanguages,
                translationEnabled 
            }, { merge: true });
            toast({ title: 'Success', description: 'Language settings saved.' });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: `Failed to save settings: ${error.message}` });
        } finally {
            setSaving(false);
        }
    };
    
    const filteredLanguages = allLanguages.filter(lang => 
        lang.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        lang.nativeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lang.code.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) {
        return <AdminLayout><div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div></AdminLayout>;
    }

    return (
        <AdminLayout>
            <div className="flex flex-col gap-8">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold font-headline tracking-tight">Language Settings</h1>
                        <p className="text-muted-foreground">Enable or disable languages for the Google Translate widget.</p>
                    </div>
                     <Button onClick={handleSave} disabled={saving}>
                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save Changes
                    </Button>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Global Translation Settings</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between p-4 border rounded-md">
                            <div>
                                <Label htmlFor="translation-enabled" className="font-semibold text-base">Enable Language Translation</Label>
                                <p className="text-sm text-muted-foreground">Turn the Google Translate widget on or off for all users.</p>
                            </div>
                            <Switch
                                id="translation-enabled"
                                checked={translationEnabled}
                                onCheckedChange={setTranslationEnabled}
                            />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Manage Languages</CardTitle>
                        <CardDescription>Use the toggles below to control which languages are available for users.</CardDescription>
                         <div className="relative pt-4">
                            <Search className="absolute left-2.5 top-6 h-4 w-4 text-muted-foreground" />
                            <Input 
                                placeholder="Search languages..." 
                                className="pl-8" 
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </CardHeader>
                    <CardContent>
                       <ScrollArea className="h-[60vh]">
                            <div className="space-y-4 pr-6">
                                {filteredLanguages.map(lang => (
                                    <div key={lang.code} className="flex items-center justify-between p-4 border rounded-md">
                                        <div>
                                            <Label htmlFor={lang.code} className="font-semibold flex items-center gap-2">
                                                {lang.name}
                                                {lang.rtl && <span className="text-xs font-normal text-muted-foreground">(RTL)</span>}
                                            </Label>
                                            <p className="text-sm text-muted-foreground">{lang.nativeName} ({lang.code})</p>
                                        </div>
                                        <Switch
                                            id={lang.code}
                                            checked={settings[lang.code] ?? false}
                                            onCheckedChange={(checked) => handleToggle(lang.code, checked)}
                                            disabled={lang.code === 'en'}
                                        />
                                    </div>
                                ))}
                            </div>
                       </ScrollArea>
                    </CardContent>
                </Card>
            </div>
        </AdminLayout>
    )
}
