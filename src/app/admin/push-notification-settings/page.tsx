
"use client";

import React, { useState, useEffect } from 'react';
import { AdminLayout } from "@/components/layout/admin-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

interface PushNotificationSettings {
    oneSignalAppId: string;
    safariWebId: string;
    notifyButtonEnabled: boolean;
}

export default function PushNotificationSettingsPage() {
    const { toast } = useToast();
    const [settings, setSettings] = useState<PushNotificationSettings>({
        oneSignalAppId: '',
        safariWebId: '',
        notifyButtonEnabled: true,
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const fetchSettings = async () => {
            if (!db) {
                setLoading(false);
                return;
            }
            try {
                const docRef = doc(db, 'settings', 'pushNotifications');
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setSettings({
                        oneSignalAppId: data.oneSignalAppId || '',
                        safariWebId: data.safariWebId || '',
                        notifyButtonEnabled: data.notifyButtonEnabled ?? true,
                    });
                }
            } catch (error) {
                toast({ variant: 'destructive', title: 'Error', description: 'Failed to fetch settings.' });
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
            await setDoc(doc(db, 'settings', 'pushNotifications'), settings, { merge: true });
            toast({ title: 'Success', description: 'Push notification settings saved.' });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: `Failed to save settings: ${error.message}` });
        } finally {
            setSaving(false);
        }
    };
    
    if (loading) {
        return <AdminLayout><div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div></AdminLayout>;
    }

    return (
        <AdminLayout>
            <div className="flex flex-col gap-8">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold font-headline tracking-tight">Push Notification Settings</h1>
                        <p className="text-muted-foreground">Configure your OneSignal push notification service.</p>
                    </div>
                     <Button onClick={handleSave} disabled={saving}>
                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save Changes
                    </Button>
                </div>
                <Card>
                    <CardHeader>
                        <CardTitle>OneSignal Configuration</CardTitle>
                        <CardDescription>
                            Enter your App ID and Safari Web ID from your OneSignal dashboard.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                           <Label htmlFor="oneSignalAppId">OneSignal App ID</Label>
                           <Input
                             id="oneSignalAppId"
                             value={settings.oneSignalAppId}
                             onChange={(e) => setSettings(prev => ({...prev, oneSignalAppId: e.target.value}))}
                             placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                           />
                        </div>
                         <div className="space-y-2">
                           <Label htmlFor="safariWebId">Safari Web ID (Optional)</Label>
                           <Input
                             id="safariWebId"
                             value={settings.safariWebId}
                             onChange={(e) => setSettings(prev => ({...prev, safariWebId: e.target.value}))}
                             placeholder="web.onesignal.auto.xxxxxxxx-xxxx..."
                           />
                        </div>
                        <div className="flex items-center justify-between p-4 border rounded-lg">
                            <div>
                                <Label htmlFor="notifyButtonEnabled" className="font-semibold">Enable Notification Bell</Label>
                                <p className="text-sm text-muted-foreground">Show the subscription bell widget on your site.</p>
                            </div>
                            <Switch
                                id="notifyButtonEnabled"
                                checked={settings.notifyButtonEnabled}
                                onCheckedChange={(checked) => setSettings(prev => ({...prev, notifyButtonEnabled: checked}))}
                            />
                        </div>
                    </CardContent>
                </Card>
            </div>
        </AdminLayout>
    )
}
