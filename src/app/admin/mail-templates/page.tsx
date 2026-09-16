
"use client";

import React, { useState, useEffect } from 'react';
import { AdminLayout } from "@/components/layout/admin-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, PlusCircle, Edit, Trash2, Mail } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, addDoc, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface MailTemplate {
    id: string;
    name: string;
    subject: string;
    body: string;
}

export default function MailTemplatesPage() {
    const { toast } = useToast();
    const [templates, setTemplates] = useState<MailTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<Partial<MailTemplate> | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        const fetchTemplates = async () => {
            if (!db) { setLoading(false); return; }
            try {
                const querySnapshot = await getDocs(collection(db, 'mailTemplates'));
                const templatesData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MailTemplate));
                setTemplates(templatesData);
            } catch (error: any) {
                toast({ variant: 'destructive', title: 'Error', description: `Failed to fetch templates: ${error.message}` });
            } finally {
                setLoading(false);
            }
        };
        fetchTemplates();
    }, [toast]);

    const handleOpenDialog = (template: Partial<MailTemplate> | null = null) => {
        setEditingTemplate(template || { name: '', subject: '', body: '' });
        setIsDialogOpen(true);
    };

    const handleSaveTemplate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!db || !editingTemplate) return;
        
        setIsSubmitting(true);
        try {
            const templateToSave = {
                name: editingTemplate.name || '',
                subject: editingTemplate.subject || '',
                body: editingTemplate.body || '',
            };

            if (editingTemplate.id) {
                await setDoc(doc(db, 'mailTemplates', editingTemplate.id), templateToSave, { merge: true });
                toast({ title: 'Success', description: 'Template updated.' });
            } else {
                await addDoc(collection(db, 'mailTemplates'), templateToSave);
                toast({ title: 'Success', description: 'Template created.' });
            }

            setIsDialogOpen(false);
            setEditingTemplate(null);
            // Refetch after saving
            const querySnapshot = await getDocs(collection(db, 'mailTemplates'));
            const templatesData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MailTemplate));
            setTemplates(templatesData);

        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: `Failed to save template: ${error.message}` });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleDeleteTemplate = async (id: string) => {
        if(!db) return;
        if(confirm('Are you sure you want to delete this template?')) {
            try {
                await deleteDoc(doc(db, 'mailTemplates', id));
                setTemplates(prev => prev.filter(t => t.id !== id));
                toast({ title: 'Success', description: 'Template deleted.'});
            } catch (error: any) {
                toast({ variant: 'destructive', title: 'Error', description: `Failed to delete template: ${error.message}` });
            }
        }
    }

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div className="flex justify-between items-center">
            <div>
                <h1 className="text-3xl font-bold font-headline tracking-tight">Mail Templates</h1>
                <p className="text-muted-foreground">Create and manage email templates for user communication.</p>
            </div>
            <Button onClick={() => handleOpenDialog()}><PlusCircle className="mr-2 h-4 w-4" /> Add New Template</Button>
        </div>

        <Card>
            <CardHeader>
                <CardTitle>Existing Templates</CardTitle>
                <CardDescription>View, edit, or delete email templates.</CardDescription>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Subject</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {templates.map(template => (
                                <TableRow key={template.id}>
                                    <TableCell className="font-medium">{template.name}</TableCell>
                                    <TableCell>{template.subject}</TableCell>
                                    <TableCell className="text-right space-x-2">
                                        <Button variant="outline" size="icon" onClick={() => handleOpenDialog(template)}>
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                        <Button variant="destructive" size="icon" onClick={() => handleDeleteTemplate(template.id)}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
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
        <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
                <DialogTitle>{editingTemplate?.id ? 'Edit' : 'Create'} Template</DialogTitle>
                <DialogDescription>Use placeholders like {'`{{username}}`'} or {'`{{firstName}}`'} which will be replaced.</DialogDescription>
            </DialogHeader>
            {editingTemplate && (
                <form onSubmit={handleSaveTemplate} className="max-h-[70vh] overflow-y-auto pr-4 space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">Template Name</Label>
                        <Input id="name" value={editingTemplate.name || ''} onChange={(e) => setEditingTemplate(p => ({...p, name: e.target.value}))} required/>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="subject">Email Subject</Label>
                        <Input id="subject" value={editingTemplate.subject || ''} onChange={(e) => setEditingTemplate(p => ({...p, subject: e.target.value}))} required/>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="body">Email Body</Label>
                        <Textarea id="body" value={editingTemplate.body || ''} onChange={(e) => setEditingTemplate(p => ({...p, body: e.target.value}))} rows={10} required/>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="secondary" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Save Template'}
                        </Button>
                    </DialogFooter>
                </form>
            )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
