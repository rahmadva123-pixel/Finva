
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { AdminLayout } from "@/components/layout/admin-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, Trash2, Star, User, Bitcoin, Banknote, Search, X } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Separator } from '@/components/ui/separator';


interface User { id: string; email: string; username?: string; }
interface DepositMethod { id: string; name: string; type: 'bank' | 'crypto'; networks?: any[], bankDetails?: any[] }

interface SpecialDepositSettings {
    isEnabled: boolean;
    specialUserIds: string[];
    methodOverrides: Record<string, Record<string, string[]>>; // methodId -> detailLabel -> overrideValues[]
}

export default function SpecialDepositsPage() {
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [settings, setSettings] = useState<SpecialDepositSettings>({ isEnabled: false, specialUserIds: [], methodOverrides: {} });
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [allMethods, setAllMethods] = useState<DepositMethod[]>([]);
    const [searchTerm, setSearchTerm] = useState('');

    const fetchData = useCallback(async () => {
        if (!db) { setLoading(false); return; }
        try {
            const [settingsDoc, usersSnap, methodsSnap] = await Promise.all([
                getDoc(doc(db, 'settings', 'specialDeposits')),
                getDocs(collection(db, 'users')),
                getDocs(collection(db, 'depositMethods'))
            ]);

            if (settingsDoc.exists()) {
                setSettings(settingsDoc.data() as SpecialDepositSettings);
            }
            setAllUsers(usersSnap.docs.map(d => ({id: d.id, ...d.data()} as User)));
            setAllMethods(methodsSnap.docs.map(d => ({id: d.id, ...d.data()} as DepositMethod)));

        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: `Failed to fetch data: ${error.message}`});
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);
    
    const handleSave = async () => {
        if (!db) return;
        setSaving(true);
        try {
            await setDoc(doc(db, 'settings', 'specialDeposits'), settings);
            toast({ title: 'Success', description: 'Special deposit settings have been saved.' });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error saving settings', description: error.message });
        } finally {
            setSaving(false);
        }
    }
    
    const handleUserSelection = (userId: string, checked: boolean) => {
        setSettings(prev => {
            const newIds = checked 
                ? [...prev.specialUserIds, userId]
                : prev.specialUserIds.filter(id => id !== userId);
            return { ...prev, specialUserIds: newIds };
        });
    }

    const handleAddOverride = (methodId: string, detailLabel: string) => {
        setSettings(prev => {
            const newOverrides = { ...prev.methodOverrides };
            if (!newOverrides[methodId]) {
                newOverrides[methodId] = {};
            }
            if (!newOverrides[methodId][detailLabel]) {
                newOverrides[methodId][detailLabel] = [];
            }
            newOverrides[methodId][detailLabel].push('');
            return { ...prev, methodOverrides: newOverrides };
        });
    }

    const handleRemoveOverride = (methodId: string, detailLabel: string, overrideIndex: number) => {
        setSettings(prev => {
            const newOverrides = { ...prev.methodOverrides };
            if (newOverrides[methodId] && newOverrides[methodId][detailLabel]) {
                newOverrides[methodId][detailLabel].splice(overrideIndex, 1);
            }
            return { ...prev, methodOverrides: newOverrides };
        });
    }
    
    const handleOverrideChange = (methodId: string, detailLabel: string, overrideIndex: number, value: string) => {
        setSettings(prev => {
            const newOverrides = { ...prev.methodOverrides };
            if (newOverrides[methodId] && newOverrides[methodId][detailLabel]) {
                newOverrides[methodId][detailLabel][overrideIndex] = value;
            }
            return { ...prev, methodOverrides: newOverrides };
        });
    }


    const filteredUsers = allUsers.filter(u => 
        u.email.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (u.username || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) {
        return <AdminLayout><div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin" /></div></AdminLayout>;
    }

    return (
        <AdminLayout>
            <div className="space-y-8">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold font-headline tracking-tight">Special Deposits System</h1>
                        <p className="text-muted-foreground">Manage randomized deposit details for specific users.</p>
                    </div>
                    <Button onClick={handleSave} disabled={saving}>
                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save Settings
                    </Button>
                </div>
                
                <Card>
                    <CardHeader>
                        <CardTitle>Global Settings</CardTitle>
                    </CardHeader>
                    <CardContent>
                         <div className="flex items-center justify-between p-4 border rounded-md">
                            <div>
                                <Label htmlFor="isEnabled" className="font-semibold text-base">Enable Special Deposits System</Label>
                                <p className="text-sm text-muted-foreground">If enabled, selected users will see randomized deposit details.</p>
                            </div>
                            <Switch id="isEnabled" checked={settings.isEnabled} onCheckedChange={(checked) => setSettings(p => ({...p, isEnabled: checked}))} />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Manage Special Users</CardTitle>
                        <CardDescription>Select which users will be part of this system.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"/>
                            <Input placeholder="Search users..." className="pl-8 mb-4" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                        </div>
                        <ScrollArea className="h-72 border rounded-md p-2">
                            <div className="space-y-1">
                            {filteredUsers.map(user => (
                                <div key={user.id} className="flex items-center space-x-3 p-2 hover:bg-muted/50 rounded-md">
                                    <Checkbox 
                                        id={user.id}
                                        checked={settings.specialUserIds.includes(user.id)}
                                        onCheckedChange={(checked) => handleUserSelection(user.id, checked as boolean)}
                                    />
                                    <div className="flex flex-col">
                                        <Label htmlFor={user.id} className="font-semibold cursor-pointer">{user.username || 'No Username'}</Label>
                                        <span className="text-xs text-muted-foreground">{user.email}</span>
                                    </div>
                                </div>
                            ))}
                            </div>
                        </ScrollArea>
                    </CardContent>
                    <CardFooter>
                        <p className="text-sm text-muted-foreground">{settings.specialUserIds.length} user(s) selected.</p>
                    </CardFooter>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Deposit Method Overrides</CardTitle>
                        <CardDescription>Add alternative wallet addresses or bank details for each method. These will be pooled with the originals for special users.</CardDescription>
                    </CardHeader>
                    <CardContent>
                         <Accordion type="multiple" className="w-full space-y-4">
                            {allMethods.map(method => (
                                <AccordionItem key={method.id} value={method.id} className="border rounded-lg">
                                    <AccordionTrigger className="p-4 font-semibold text-lg hover:no-underline">
                                        <div className="flex items-center gap-2">
                                            {method.type === 'crypto' ? <Bitcoin /> : <Banknote />}
                                            {method.name}
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="p-4 border-t space-y-4">
                                        {(method.type === 'crypto' ? (method.networks || []) : (method.bankDetails || [])).map((detail: any) => (
                                            <div key={detail.id} className="p-3 border rounded-md bg-muted/20 space-y-2">
                                                <h4 className="font-semibold text-muted-foreground">Original Detail</h4>
                                                <div className="text-sm">
                                                    <span className="font-medium">{detail.name || detail.label}: </span>
                                                    <span className="font-mono text-xs">{detail.address || detail.value}</span>
                                                </div>

                                                <Separator className="my-4"/>
                                                
                                                <div className="space-y-2">
                                                     <h5 className="font-semibold text-muted-foreground">Alternative Details for "{detail.name || detail.label}"</h5>
                                                     {(settings.methodOverrides[method.id]?.[detail.name || detail.label] || []).map((overrideValue, overrideIndex) => (
                                                        <div key={overrideIndex} className="flex items-center gap-2">
                                                            <Input 
                                                                value={overrideValue} 
                                                                onChange={(e) => handleOverrideChange(method.id, detail.name || detail.label, overrideIndex, e.target.value)} 
                                                                placeholder="Enter alternative address/value"
                                                            />
                                                            <Button type="button" variant="ghost" size="icon" className="text-destructive shrink-0" onClick={() => handleRemoveOverride(method.id, detail.name || detail.label, overrideIndex)}>
                                                                <X className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                     ))}
                                                     <Button type="button" variant="outline" size="sm" onClick={() => handleAddOverride(method.id, detail.name || detail.label)}><Plus className="mr-2 h-4 w-4"/> Add Alternative</Button>
                                                </div>
                                            </div>
                                        ))}
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                         </Accordion>
                    </CardContent>
                </Card>
            </div>
        </AdminLayout>
    );
}
