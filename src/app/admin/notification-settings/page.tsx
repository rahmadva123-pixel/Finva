
"use client";

import React, { useState, useEffect } from 'react';
import { AdminLayout } from "@/components/layout/admin-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Bell } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';

const notificationTypes = [
    { key: 'welcome', label: 'Welcome Notification', description: 'Sent to new users upon registration.' },
    { key: 'depositApproved', label: 'Deposit Approved', description: 'Sent when a deposit is approved.' },
    { key: 'depositRejected', label: 'Deposit Rejected', description: 'Sent when a deposit is rejected.' },
    { key: 'withdrawalApproved', label: 'Withdrawal Approved', description: 'Sent when a withdrawal is approved.' },
    { key: 'withdrawalRejected', label: 'Withdrawal Rejected', description: 'Sent when a withdrawal is rejected.' },
    { key: 'newInvestment', label: 'New Investment', description: 'Sent when a user makes a new investment.' },
    { key: 'investmentReturn', label: 'Investment Return', description: 'Sent when an investment pays out a return.' },
    { key: 'capitalBack', label: 'Investment Capital Back', description: 'Sent when capital is returned at the end of an investment.' },
    { key: 'referralCommission', label: 'Referral Commission', description: 'Sent when a user earns a referral commission.' },
    { key: 'signupBonus', label: 'Signup Bonus Awarded', description: 'Sent when a user receives a signup bonus.' },
    { key: 'dailyBonus', label: 'Daily Bonus Awarded', description: 'Sent when a user claims a daily bonus.' },
    { key: 'promoCode', label: 'Daily Promo Code', description: 'Sent when an eligible user receives a daily promo code or promo reward.' },
    { key: 'taskBonus', label: 'Task Bonus Awarded', description: 'Sent when a task submission is approved.' },
    { key: 'stakeCompleted', label: 'Staking Completed', description: 'Sent when a stake matures and pays out.' },
    { key: 'poolPayout', label: 'Pool Payout', description: 'Sent when a pool investment pays out.' },
];

type NotificationSettings = {
    [key: string]: boolean;
};

export default function NotificationSettingsPage() {
    const { toast } = useToast();
    const [settings, setSettings] = useState<NotificationSettings>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const fetchSettings = async () => {
            if (!db) {
                setLoading(false);
                return;
            }
            try {
                const docRef = doc(db, 'settings', 'notifications');
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setSettings(docSnap.data());
                } else {
                    // Initialize with all true if not set
                    const initialSettings: NotificationSettings = {};
                    notificationTypes.forEach(t => initialSettings[t.key] = true);
                    setSettings(initialSettings);
                }
            } catch (error) {
                toast({ variant: 'destructive', title: 'Error', description: 'Failed to fetch settings.' });
            } finally {
                setLoading(false);
            }
        };
        fetchSettings();
    }, [toast]);

    const handleToggle = (key: string, checked: boolean) => {
        setSettings(prev => ({ ...prev, [key]: checked }));
    };

    const handleSave = async () => {
        if (!db) return;
        setSaving(true);
        try {
            await setDoc(doc(db, 'settings', 'notifications'), settings, { merge: true });
            toast({ title: 'Success', description: 'Notification settings saved.' });
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
                        <h1 className="text-3xl font-bold font-headline tracking-tight">Notification Settings</h1>
                        <p className="text-muted-foreground">Enable or disable specific notifications sent to users.</p>
                    </div>
                     <Button onClick={handleSave} disabled={saving}>
                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save Changes
                    </Button>
                </div>
                <Card>
                    <CardHeader>
                        <CardTitle>Manage Notifications</CardTitle>
                        <CardDescription>Use the toggles below to control which automated notifications are active.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {notificationTypes.map(type => (
                            <div key={type.key} className="flex items-center justify-between p-4 border rounded-md">
                                <div>
                                    <Label htmlFor={type.key} className="font-semibold">{type.label}</Label>
                                    <p className="text-sm text-muted-foreground">{type.description}</p>
                                </div>
                                <Switch
                                    id={type.key}
                                    checked={settings[type.key] ?? true}
                                    onCheckedChange={(checked) => handleToggle(type.key, checked)}
                                />
                            </div>
                        ))}
                    </CardContent>
                </Card>
            </div>
        </AdminLayout>
    )
}
