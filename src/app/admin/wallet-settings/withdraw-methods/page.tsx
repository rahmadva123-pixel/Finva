
"use client"

import React, { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/layout/admin-layout';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, addDoc, getDocs, doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { PlusCircle, Edit, Trash, Loader2, Text, FileText, Hash, FileImage } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';

interface FormField {
    id: string;
    label: string;
    type: 'text' | 'textarea' | 'number';
    required: boolean;
}

interface WithdrawMethod {
  id?: string;
  name: string;
  minAmount: number;
  maxAmount: number;
  unlimited: boolean;
  fields: FormField[];
  createdAt?: any;
  status: 'active' | 'inactive';
  iconUrl?: string;
  currency?: string;
  rate?: number;
}

const initialMethods: Omit<WithdrawMethod, 'id' | 'createdAt'>[] = [
    {
        name: 'Bank Transfer',
        minAmount: 100,
        maxAmount: 5000,
        unlimited: false,
        fields: [
            { id: '1', label: 'Bank Name', type: 'text', required: true },
            { id: '2', label: 'Account Number', type: 'number', required: true },
            { id: '3', label: 'Account Holder Name', type: 'text', required: true },
        ],
        status: 'active',
        iconUrl: 'https://i.postimg.cc/mD7b20N4/bank.png',
        currency: 'USD',
        rate: 1,
    },
    {
        name: 'Binance Pay',
        minAmount: 20,
        maxAmount: 0,
        unlimited: true,
        fields: [
            { id: '1', label: 'Your Binance Pay ID / Email', type: 'text', required: true }
        ],
        status: 'active',
        iconUrl: 'https://i.postimg.cc/T1GqM1sL/binance.png',
        currency: 'USDT',
        rate: 1,
    }
];


export default function WithdrawMethodsPage() {
  const { toast } = useToast();
  const [methods, setMethods] = useState<WithdrawMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentMethod, setCurrentMethod] = useState<Partial<WithdrawMethod>>({});

  useEffect(() => {
    const fetchMethods = async () => {
      if (!db) {
        setLoading(false);
        return;
      }
      try {
        const querySnapshot = await getDocs(collection(db, 'withdrawMethods'));
         if (querySnapshot.empty) {
            for (const method of initialMethods) {
                await addDoc(collection(db, 'withdrawMethods'), { ...method, createdAt: serverTimestamp() });
            }
           const newSnapshot = await getDocs(collection(db, 'withdrawMethods'));
           const methodsData = newSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WithdrawMethod));
           setMethods(methodsData);
        } else {
            const methodsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WithdrawMethod));
            setMethods(methodsData);
        }
      } catch (error) {
        console.error('Error fetching withdraw methods:', error);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch withdraw methods.' });
      } finally {
        setLoading(false);
      }
    };
    fetchMethods();
  }, [toast]);
  
  const handleSaveMethod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !currentMethod) return;

    setIsSubmitting(true);
    
    const methodToSave: Omit<WithdrawMethod, 'id' | 'createdAt'> = {
        name: currentMethod.name || 'Unnamed Method',
        minAmount: Number(currentMethod.minAmount || 0),
        maxAmount: Number(currentMethod.maxAmount || 0),
        unlimited: currentMethod.unlimited || false,
        fields: currentMethod.fields || [],
        status: currentMethod.status || 'active',
        iconUrl: currentMethod.iconUrl || '',
        currency: currentMethod.currency || 'USD',
        rate: Number(currentMethod.rate || 1),
    };

    try {
        if (currentMethod.id) {
            await setDoc(doc(db, 'withdrawMethods', currentMethod.id), methodToSave, { merge: true });
        } else {
            await addDoc(collection(db, 'withdrawMethods'), { ...methodToSave, createdAt: serverTimestamp() });
        }
        
        const querySnapshot = await getDocs(collection(db, 'withdrawMethods'));
        const methodsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WithdrawMethod));
        setMethods(methodsData);

        setIsDialogOpen(false);
        setCurrentMethod({});
         toast({ title: 'Success', description: 'Method saved successfully.' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
        setIsSubmitting(false);
    }
  };
  
  const handleDeleteMethod = async (id: string) => {
      if(!db || !id) return;
      if(!confirm('Are you sure you want to delete this method?')) return;

      try {
          await deleteDoc(doc(db, 'withdrawMethods', id));
          setMethods(methods.filter(m => m.id !== id));
          toast({ title: 'Success', description: 'Method deleted successfully.' });
      } catch (error: any) {
           toast({ variant: 'destructive', title: 'Error', description: error.message });
      }
  }

  const openDialog = (method: Partial<WithdrawMethod> | null = null) => {
    setCurrentMethod(method ? JSON.parse(JSON.stringify(method)) : { name: '', minAmount: 0, maxAmount: 0, unlimited: false, fields: [], status: 'active', iconUrl: '', currency: 'USD', rate: 1 });
    setIsDialogOpen(true);
  };
  
  const handleFieldChange = (index: number, field: keyof FormField, value: any) => {
      if (!currentMethod) return;
      const updatedFields = [...(currentMethod.fields || [])];
      updatedFields[index] = {...updatedFields[index], [field]: value};
      setCurrentMethod(p => ({...p, fields: updatedFields}));
  }
  
  const addField = () => {
      if (!currentMethod) return;
      const newField: FormField = { id: Date.now().toString(), label: '', type: 'text', required: true };
      setCurrentMethod(p => ({ ...p, fields: [...(p?.fields || []), newField]}));
  }
  
  const removeField = (index: number) => {
      if (!currentMethod) return;
      setCurrentMethod(p => ({...p, fields: (p?.fields || []).filter((_, i) => i !== index)}));
  }


  return (
    <AdminLayout>
       <div className="flex flex-col gap-8">
        <div className="flex items-center justify-between">
            <div>
                <h1 className="text-3xl font-bold font-headline tracking-tight">Withdrawal Methods</h1>
                <p className="text-muted-foreground">Manage how users can withdraw funds from their wallets.</p>
            </div>
            <Button onClick={() => openDialog()}>
                <PlusCircle className="mr-2 h-4 w-4" /> Add Method
            </Button>
        </div>

        {loading ? (
          <div className="flex justify-center items-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {methods.sort((a,b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0)).map(method => (
              <Card key={method.id}>
                <CardHeader>
                  <CardTitle className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                        {method.iconUrl && <Image src={method.iconUrl} alt={method.name} width={24} height={24}/>}
                        {method.name}
                    </div>
                     <Badge variant={method.status === 'active' ? 'default' : 'secondary'}>{method.status}</Badge>
                  </CardTitle>
                  <CardDescription>
                     Min: {method.minAmount} / Max: {method.unlimited ? 'Unlimited' : method.maxAmount}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-sm font-semibold">Required User Info Fields:</p>
                    <ul className="text-sm text-muted-foreground list-disc pl-5 mt-2">
                        {method.fields?.map(field => <li key={field.id}>{field.label} ({field.type})</li>)}
                    </ul>
                </CardContent>
                <CardFooter className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => openDialog(method)}><Edit className="mr-2 h-4 w-4"/> Edit</Button>
                    <Button variant="destructive" size="sm" onClick={() => handleDeleteMethod(method.id!)}><Trash className="mr-2 h-4 w-4"/> Delete</Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>

       <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{currentMethod?.id ? 'Edit' : 'Add'} Withdrawal Method</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSaveMethod} className="max-h-[70vh] overflow-y-auto pr-4 space-y-6 pt-4">
               <div className="space-y-4 border p-4 rounded-md">
                   <div className="space-y-2">
                       <Label>Method Name</Label>
                       <Input value={currentMethod?.name || ''} onChange={(e) => setCurrentMethod(p => ({...p, name: e.target.value}))} required />
                   </div>
                   <div className="space-y-2">
                        <Label>Icon URL</Label>
                        <Input value={currentMethod?.iconUrl || ''} onChange={(e) => setCurrentMethod(p => ({...p, iconUrl: e.target.value}))} placeholder="https://example.com/icon.png" />
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Currency</Label>
                            <Input value={currentMethod?.currency || ''} onChange={(e) => setCurrentMethod(p => ({...p, currency: e.target.value}))} placeholder="e.g. USDT" required />
                        </div>
                        <div className="space-y-2">
                            <Label>Rate (vs 1 USD)</Label>
                            <Input type="number" value={currentMethod?.rate || 1} onChange={(e) => setCurrentMethod(p => ({...p, rate: parseFloat(e.target.value)}))} required />
                        </div>
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                           <Label>Min Amount</Label>
                           <Input type="number" value={currentMethod?.minAmount || ''} onChange={(e) => setCurrentMethod(p => ({...p, minAmount: parseFloat(e.target.value)}))} required />
                       </div>
                        <div className="space-y-2">
                           <Label>Max Amount</Label>
                           <Input type="number" value={currentMethod?.maxAmount || ''} onChange={(e) => setCurrentMethod(p => ({...p, maxAmount: parseFloat(e.target.value)}))} disabled={currentMethod?.unlimited} required={!currentMethod?.unlimited} />
                       </div>
                   </div>
                    <div className="flex items-center gap-2">
                       <Switch id="unlimited-switch" checked={currentMethod?.unlimited} onCheckedChange={(checked) => setCurrentMethod(prev => ({...prev, unlimited: checked}))} />
                       <Label htmlFor="unlimited-switch">Unlimited Max Amount</Label>
                   </div>
                    <div className="space-y-2">
                        <Label>Status</Label>
                        <select
                            value={currentMethod?.status}
                            onChange={(e) => setCurrentMethod(p => ({...p, status: e.target.value as 'active' | 'inactive'}))}
                            className="w-full p-2 border rounded-md bg-background"
                        >
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                        </select>
                    </div>
               </div>
               
               <Card>
                   <CardHeader>
                       <CardTitle className="text-lg">Custom Form Fields</CardTitle>
                       <CardDescription>Define the fields users must fill out for this method.</CardDescription>
                   </CardHeader>
                   <CardContent className="space-y-4">
                       {(currentMethod?.fields || []).map((field, index) => (
                           <div key={field.id} className="border p-4 rounded-md space-y-4 bg-muted/50">
                               <div className="flex justify-between items-center">
                                   <h4 className="font-semibold">Field {index + 1}</h4>
                                   <Button type="button" variant="destructive" size="icon" className="h-7 w-7" onClick={() => removeField(index)}><Trash className="h-4 w-4"/></Button>
                               </div>
                               <div className="grid grid-cols-2 gap-4">
                                   <div className="space-y-2">
                                       <Label>Field Label</Label>
                                       <Input value={field.label} onChange={e => handleFieldChange(index, 'label', e.target.value)} placeholder="e.g., Wallet Address" required/>
                                   </div>
                                    <div className="space-y-2">
                                       <Label>Field Type</Label>
                                       <select value={field.type} onChange={e => handleFieldChange(index, 'type', e.target.value)} className="w-full p-2 border rounded-md bg-background">
                                           <option value="text">Text</option>
                                           <option value="textarea">Text Area</option>
                                           <option value="number">Number</option>
                                       </select>
                                   </div>
                               </div>
                           </div>
                       ))}
                       <Button type="button" variant="outline" onClick={addField}><PlusCircle className="mr-2"/> Add Field</Button>
                   </CardContent>
               </Card>

                <DialogFooter className="mt-4">
                     <DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose>
                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Save Method
                    </Button>
                </DialogFooter>
            </form>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
