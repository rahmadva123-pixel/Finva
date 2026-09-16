
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { AdminLayout } from "@/components/layout/admin-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, PlusCircle, Edit, Trash2, GripVertical, Text, FileImage, Phone, ShieldQuestion } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { doc, setDoc, getDoc, collection, addDoc, getDocs, deleteDoc } from 'firebase/firestore';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

type FieldType = 'text' | 'image' | 'phone';

interface VerificationField {
    id: string;
    label: string;
    type: FieldType;
    required: boolean;
}

interface VerificationMethod {
    id: string;
    name: string;
    status: 'active' | 'inactive';
    fields: VerificationField[];
}

export default function VerificationSetupPage() {
    const { toast } = useToast();
    const [methods, setMethods] = useState<VerificationMethod[]>([]);
    const [loading, setLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingMethod, setEditingMethod] = useState<Partial<VerificationMethod> | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Global settings state
    const [requireVerification, setRequireVerification] = useState(false);
    const [pendingPageTitle, setPendingPageTitle] = useState('');
    const [pendingPageDescription, setPendingPageDescription] = useState('');
    const [pendingPageInstructions, setPendingPageInstructions] = useState('');
    const [pendingPageSupportWhatsapp, setPendingPageSupportWhatsapp] = useState('');
    const [pendingPageSupportTelegram, setPendingPageSupportTelegram] = useState('');
    const [pendingPageSupportEmail, setPendingPageSupportEmail] = useState('');
    const [pendingPageSupportPhone, setPendingPageSupportPhone] = useState('');

    const fetchMethodsAndSettings = useCallback(async () => {
        setLoading(true);
        if(!db) {
            setLoading(false);
            return;
        }
        try {
            const settingsDoc = await getDoc(doc(db, 'settings', 'verification'));
            if(settingsDoc.exists()){
                const data = settingsDoc.data();
                setRequireVerification(data.requireVerification || false);
                setPendingPageTitle(data.pendingPageTitle || 'Verification Pending');
                setPendingPageDescription(data.pendingPageDescription || 'Your documents have been submitted successfully and are now under review. This may take up to 24 hours.');
                setPendingPageInstructions(data.pendingPageInstructions || 'If you log out, you can log in again later to check your status. Once approved, you will automatically be taken to your dashboard.');
                setPendingPageSupportWhatsapp(data.pendingPageSupportWhatsapp || '');
                setPendingPageSupportTelegram(data.pendingPageSupportTelegram || '');
                setPendingPageSupportEmail(data.pendingPageSupportEmail || '');
                setPendingPageSupportPhone(data.pendingPageSupportPhone || '');
            }

            const querySnapshot = await getDocs(collection(db, 'verificationMethods'));
            const methodsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as VerificationMethod));
            setMethods(methodsData);
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: `Failed to fetch data: ${error.message}` });
        } finally {
            setLoading(false);
        }
    }, [toast]);
    
    useEffect(() => {
        fetchMethodsAndSettings();
    }, [fetchMethodsAndSettings]);

    const handleSaveGlobalSettings = async () => {
        if(!db) return;
        try {
            await setDoc(doc(db, 'settings', 'verification'), { 
                requireVerification,
                pendingPageTitle,
                pendingPageDescription,
                pendingPageInstructions,
                pendingPageSupportWhatsapp,
                pendingPageSupportTelegram,
                pendingPageSupportEmail,
                pendingPageSupportPhone,
            }, { merge: true });
            toast({ title: 'Success', description: 'Settings updated successfully.' });
        } catch (error: any) {
             toast({ variant: 'destructive', title: 'Error', description: `Failed to save settings: ${error.message}` });
        }
    }

    const openDialog = (method: Partial<VerificationMethod> | null = null) => {
        setEditingMethod(method ? JSON.parse(JSON.stringify(method)) : { name: '', status: 'active', fields: [] });
        setIsDialogOpen(true);
    };

    const handleSaveMethod = async () => {
        if (!db || !editingMethod) return;
        setIsSubmitting(true);
        try {
            if (editingMethod.id) {
                await setDoc(doc(db, 'verificationMethods', editingMethod.id), editingMethod, { merge: true });
                toast({ title: 'Success', description: 'Method updated.' });
            } else {
                await addDoc(collection(db, 'verificationMethods'), editingMethod);
                toast({ title: 'Success', description: 'New method created.' });
            }
            setIsDialogOpen(false);
            fetchMethodsAndSettings();
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: `Failed to save method: ${error.message}` });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleDeleteMethod = async (id: string) => {
        if(!db) return;
        if (confirm('Are you sure you want to delete this method?')) {
            try {
                await deleteDoc(doc(db, 'verificationMethods', id));
                toast({ title: 'Success', description: 'Method deleted.'});
                fetchMethodsAndSettings();
            } catch (error: any) {
                 toast({ variant: 'destructive', title: 'Error', description: `Failed to delete method: ${error.message}` });
            }
        }
    }
    
    const addField = () => {
        if(!editingMethod) return;
        const newField: VerificationField = { id: Date.now().toString(), label: '', type: 'text', required: true };
        setEditingMethod(prev => ({ ...prev, fields: [...(prev?.fields || []), newField] }));
    }

    const updateField = (index: number, field: keyof VerificationField, value: any) => {
         if(!editingMethod) return;
         const newFields = [...(editingMethod.fields || [])];
         newFields[index] = { ...newFields[index], [field]: value };
         setEditingMethod(prev => ({...prev, fields: newFields}));
    }
    
    const removeField = (index: number) => {
        if(!editingMethod) return;
        setEditingMethod(prev => ({ ...prev, fields: (prev?.fields || []).filter((_, i) => i !== index) }));
    }

    return (
        <AdminLayout>
            <div className="space-y-8">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold font-headline tracking-tight">ID Verification Setup</h1>
                        <p className="text-muted-foreground">Create and manage identity verification methods.</p>
                    </div>
                </div>

                 <Card>
                    <CardHeader>
                        <CardTitle>Global Verification Settings</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex items-center justify-between p-4 border rounded-md">
                            <div>
                                <Label htmlFor="require-verification" className="font-semibold text-base">Require Verification for New Users</Label>
                                <p className="text-sm text-muted-foreground">If enabled, new users must complete verification before accessing the dashboard.</p>
                            </div>
                            <Switch id="require-verification" checked={requireVerification} onCheckedChange={setRequireVerification} />
                        </div>
                        <div className="p-4 border rounded-md space-y-4">
                            <h4 className="font-semibold">Pending Page Content</h4>
                            <div className="space-y-2">
                                <Label htmlFor="pendingTitle">Page Title</Label>
                                <Input id="pendingTitle" value={pendingPageTitle} onChange={(e) => setPendingPageTitle(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="pendingDescription">Page Description</Label>
                                <Textarea id="pendingDescription" value={pendingPageDescription} onChange={(e) => setPendingPageDescription(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="pendingInstructions">Instruction Text</Label>
                                <Textarea id="pendingInstructions" value={pendingPageInstructions} onChange={(e) => setPendingPageInstructions(e.target.value)} />
                            </div>
                        </div>
                         <div className="p-4 border rounded-md space-y-4">
                            <h4 className="font-semibold">Pending Page Support Contacts</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>WhatsApp URL</Label>
                                    <Input value={pendingPageSupportWhatsapp} onChange={(e) => setPendingPageSupportWhatsapp(e.target.value)} placeholder="https://wa.me/..."/>
                                </div>
                                 <div className="space-y-2">
                                    <Label>Telegram URL</Label>
                                    <Input value={pendingPageSupportTelegram} onChange={(e) => setPendingPageSupportTelegram(e.target.value)} placeholder="https://t.me/..."/>
                                </div>
                                 <div className="space-y-2">
                                    <Label>Support Email</Label>
                                    <Input type="email" value={pendingPageSupportEmail} onChange={(e) => setPendingPageSupportEmail(e.target.value)} placeholder="support@example.com"/>
                                </div>
                                 <div className="space-y-2">
                                    <Label>Support Phone</Label>
                                    <Input type="tel" value={pendingPageSupportPhone} onChange={(e) => setPendingPageSupportPhone(e.target.value)} placeholder="+1-800-555-1212"/>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter>
                         <Button onClick={handleSaveGlobalSettings}>Save Settings</Button>
                    </CardFooter>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Verification Methods</CardTitle>
                        <CardDescription>Define the document types users can submit for verification.</CardDescription>
                    </CardHeader>
                    <CardContent>
                         <Button onClick={() => openDialog()} className="mb-4">
                            <PlusCircle className="mr-2 h-4 w-4" /> Add New Method
                        </Button>
                        {loading ? <Loader2 className="animate-spin" /> : (
                            <Table>
                                <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Fields</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                                <TableBody>
                                    {methods.map(method => (
                                        <TableRow key={method.id}>
                                            <TableCell className="font-semibold">{method.name}</TableCell>
                                            <TableCell>{method.fields.length}</TableCell>
                                            <TableCell><Badge variant={method.status === 'active' ? 'default' : 'secondary'}>{method.status}</Badge></TableCell>
                                            <TableCell className="text-right space-x-2">
                                                <Button variant="outline" size="icon" onClick={() => openDialog(method)}><Edit className="h-4 w-4" /></Button>
                                                <Button variant="destructive" size="icon" onClick={() => handleDeleteMethod(method.id)}><Trash2 className="h-4 w-4" /></Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>
            </div>
            
             <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-2xl bg-card border-border">
                    <DialogHeader>
                        <DialogTitle>{editingMethod?.id ? 'Edit' : 'Create'} Verification Method</DialogTitle>
                    </DialogHeader>
                     {editingMethod && (
                    <div className="max-h-[70vh] overflow-y-auto pr-4 space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Method Name</Label>
                            <Input value={editingMethod.name || ''} onChange={e => setEditingMethod(p => ({...p, name: e.target.value}))} placeholder="e.g., National ID Card" />
                        </div>
                         <div className="space-y-2">
                            <Label>Status</Label>
                             <Select value={editingMethod.status || 'active'} onValueChange={(val: 'active' | 'inactive') => setEditingMethod(p => ({...p, status: val}))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem></SelectContent>
                             </Select>
                        </div>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle className="text-lg">Form Fields</CardTitle>
                                    <CardDescription>Define the information users need to provide.</CardDescription>
                                </div>
                                <Button size="sm" type="button" variant="outline" onClick={addField}><PlusCircle className="mr-2 h-4 w-4" /> Add Field</Button>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {(editingMethod.fields || []).map((field, index) => (
                                    <div key={field.id} className="flex items-end gap-2 border p-3 rounded-md relative">
                                        <Button type="button" variant="ghost" size="icon" className="absolute top-1 right-1 h-7 w-7 text-destructive" onClick={() => removeField(index)}><Trash2 className="h-4 w-4" /></Button>
                                        <div className="grid grid-cols-2 gap-4 flex-1">
                                            <div className="space-y-2">
                                                <Label>Field Label</Label>
                                                <Input value={field.label} onChange={(e) => updateField(index, 'label', e.target.value)} placeholder="e.g., ID Number"/>
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Field Type</Label>
                                                <Select value={field.type} onValueChange={(val: FieldType) => updateField(index, 'type', val)}>
                                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="text"><Text className="inline-block mr-2 h-4 w-4"/> Text</SelectItem>
                                                        <SelectItem value="image"><FileImage className="inline-block mr-2 h-4 w-4"/> Image Upload</SelectItem>
                                                        <SelectItem value="phone"><Phone className="inline-block mr-2 h-4 w-4"/> Phone Number</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {(!editingMethod.fields || editingMethod.fields.length === 0) && <p className="text-center text-sm text-muted-foreground p-4">No fields added yet.</p>}
                            </CardContent>
                        </Card>
                    </div>
                     )}
                     <DialogFooter>
                        <Button variant="secondary" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleSaveMethod} disabled={isSubmitting}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} Save
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </AdminLayout>
    );
}
