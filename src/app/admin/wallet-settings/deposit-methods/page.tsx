
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
import { collection, addDoc, getDocs, doc, setDoc, deleteDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { PlusCircle, Edit, Trash, Loader2, Banknote, Bitcoin, X, Text, FileText as TextareaIcon, Hash, FileImage } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import Image from 'next/image';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface Network {
  id: string;
  name: string;
  address: string;
}

interface BankDetail {
  id: string;
  label: string;
  value: string;
}

type FieldType = 'text' | 'textarea' | 'number' | 'image';

interface FormField {
    id: string;
    label: string;
    type: FieldType;
    required: boolean;
}

interface DepositMethod {
  id?: string;
  name: string;
  type: 'bank' | 'crypto';
  bankDetails?: BankDetail[];
  minAmount: number;
  maxAmount: number;
  unlimited: boolean;
  fields: FormField[];
  iconUrl: string;
  instructions: string;
  networks?: Network[];
  status: 'active' | 'inactive';
  currency: string;
  rate: number;
  fixedCharge: number;
  percentCharge: number;
  createdAt?: any;
}


const initialMethods: Omit<DepositMethod, 'id' | 'createdAt'>[] = [
    {
        name: 'Bank Deposit',
        type: 'bank',
        bankDetails: [
            { id: '1', label: 'Bank Name', value: 'Global Bank' },
            { id: '2', label: 'Account Number', value: '1234567890' },
            { id: '3', label: 'Account Name', value: 'WealthWise Inc.' },
        ],
        minAmount: 50,
        maxAmount: 10000,
        unlimited: false,
        fields: [
            { id: 'phone_number', label: 'Phone Number', type: 'text', required: true },
            { id: 'deposit_slip', label: 'Deposit Slip', type: 'image', required: true },
        ],
        iconUrl: 'https://i.postimg.cc/mD7b20N4/bank.png',
        instructions: 'After making the deposit, please upload a screenshot of your transaction receipt.',
        status: 'active',
        currency: 'USD',
        rate: 1,
        fixedCharge: 0,
        percentCharge: 0,
    },
    {
        name: 'Binance Pay (USDT)',
        type: 'crypto',
        minAmount: 10,
        maxAmount: 0,
        unlimited: true,
        fields: [
            { id: 'phone_number', label: 'Phone Number', type: 'text', required: true },
            { id: 'deposit_slip', label: 'Deposit Slip', type: 'image', required: true },
        ],
        iconUrl: 'https://i.postimg.cc/T1GqM1sL/binance.png',
        instructions: 'Please ensure you are sending from your own Binance account.',
        networks: [
            { id: '1', name: 'BEP20', address: '0x1234...be_p20' },
            { id: '2', name: 'ERC20', address: '0x1234...er_c20' },
        ],
        status: 'active',
        currency: 'USDT',
        rate: 1,
        fixedCharge: 1,
        percentCharge: 0.5,
    }
];

export default function DepositMethodsPage() {
  const { toast } = useToast();
  const [methods, setMethods] = useState<DepositMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentMethod, setCurrentMethod] = useState<Partial<DepositMethod>>({});

  useEffect(() => {
    const fetchMethods = async () => {
      if (!db) {
        setLoading(false);
        return;
      }
      try {
        const querySnapshot = await getDocs(collection(db, 'depositMethods'));
        if (querySnapshot.empty) {
          const batch = writeBatch(db);
          initialMethods.forEach(method => {
              const docRef = doc(collection(db, 'depositMethods'));
              batch.set(docRef, { ...method, createdAt: serverTimestamp() });
          });
          await batch.commit();
          const newSnapshot = await getDocs(collection(db, 'depositMethods'));
          const methodsData = newSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DepositMethod));
          setMethods(methodsData);
        } else {
            const methodsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DepositMethod));
            setMethods(methodsData);
        }
      } catch (error) {
        console.error('Error fetching deposit methods:', error);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch deposit methods.' });
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
    
    try {
        const methodToSave: Partial<DepositMethod> = {
            ...currentMethod,
            minAmount: Number(currentMethod.minAmount || 0),
            maxAmount: Number(currentMethod.maxAmount || 0),
            rate: Number(currentMethod.rate || 1),
            fixedCharge: Number(currentMethod.fixedCharge || 0),
            percentCharge: Number(currentMethod.percentCharge || 0),
            fields: currentMethod.fields || [],
        };

        if (currentMethod.id) {
            await setDoc(doc(db, 'depositMethods', currentMethod.id), methodToSave, { merge: true });
            setMethods(methods.map(m => m.id === currentMethod.id ? { ...m, ...methodToSave } as DepositMethod : m));
            toast({ title: 'Success', description: 'Method updated successfully.' });
        } else {
            const docRef = await addDoc(collection(db, 'depositMethods'), { ...methodToSave, createdAt: serverTimestamp() });
            setMethods([...methods, { id: docRef.id, ...methodToSave } as DepositMethod]);
            toast({ title: 'Success', description: 'Method added successfully.' });
        }
        setIsDialogOpen(false);
        setCurrentMethod({});
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
          await deleteDoc(doc(db, 'depositMethods', id));
          setMethods(methods.filter(m => m.id !== id));
          toast({ title: 'Success', description: 'Method deleted successfully.' });
      } catch (error: any) {
           toast({ variant: 'destructive', title: 'Error', description: error.message });
      }
  }

  const openDialog = (method: Partial<DepositMethod> | null = null) => {
    setCurrentMethod(method || { type: 'bank', unlimited: false, networks: [], bankDetails: [], fields: [], status: 'active', currency: 'USD', rate: 1, fixedCharge: 0, percentCharge: 0 });
    setIsDialogOpen(true);
  };

  const handleToggleStatus = async (method: DepositMethod) => {
      if (!db) return;
      const newStatus = method.status === 'active' ? 'inactive' : 'active';
      try {
          await setDoc(doc(db, 'depositMethods', method.id!), { status: newStatus }, { merge: true });
          setMethods(methods.map(m => m.id === method.id ? { ...m, status: newStatus } : m));
          toast({ title: 'Success', description: `Method ${newStatus === 'active' ? 'enabled' : 'disabled'}.` });
      } catch (error: any) {
          toast({ variant: 'destructive', title: 'Error', description: `Failed to update status: ${error.message}` });
      }
  };
  
  const handleNetworkChange = (index: number, field: keyof Network, value: string | number) => {
      const updatedNetworks = [...(currentMethod.networks || [])];
      updatedNetworks[index] = { ...updatedNetworks[index], [field]: value } as Network;
      setCurrentMethod(prev => ({...prev, networks: updatedNetworks}));
  }

  const handleBankDetailChange = (index: number, field: keyof BankDetail, value: string) => {
    const updatedDetails = [...(currentMethod.bankDetails || [])];
    updatedDetails[index] = {...updatedDetails[index], [field]: value};
    setCurrentMethod(prev => ({...prev, bankDetails: updatedDetails}));
  }
  
  const addNetwork = () => {
      const newNetwork: Network = { id: Date.now().toString(), name: '', address: '' };
      setCurrentMethod(prev => ({ ...prev, networks: [...(prev.networks || []), newNetwork]}));
  }

  const addBankDetail = () => {
    const newDetail: BankDetail = { id: Date.now().toString(), label: '', value: '' };
    setCurrentMethod(prev => ({ ...prev, bankDetails: [...(prev.bankDetails || []), newDetail]}));
  }

  const removeNetwork = (index: number) => {
      setCurrentMethod(prev => ({...prev, networks: (prev.networks || []).filter((_, i) => i !== index)}));
  }

  const removeBankDetail = (index: number) => {
    setCurrentMethod(prev => ({...prev, bankDetails: (prev.bankDetails || []).filter((_, i) => i !== index)}));
  }
  
    const addField = () => {
        if(!currentMethod) return;
        const newField: FormField = { id: Date.now().toString(), label: '', type: 'text', required: true };
        setCurrentMethod(prev => ({ ...prev, fields: [...(prev?.fields || []), newField] }));
    }

    const updateField = (index: number, field: keyof FormField, value: any) => {
         if(!currentMethod) return;
         const newFields = [...(currentMethod.fields || [])];
         newFields[index] = { ...newFields[index], [field]: value };
         setCurrentMethod(prev => ({...prev, fields: newFields}));
    }
    
    const removeField = (index: number) => {
        if(!currentMethod) return;
        setCurrentMethod(prev => ({ ...prev, fields: (prev?.fields || []).filter((_, i) => i !== index) }));
    }

  return (
    <AdminLayout>
      <div className="flex flex-col gap-8">
        <div className="flex items-center justify-between">
            <div>
                <h1 className="text-3xl font-bold font-headline tracking-tight">Deposit Methods</h1>
                <p className="text-muted-foreground">Manage how users can deposit funds into their wallets.</p>
            </div>
            <Button onClick={() => openDialog()}>
                <PlusCircle className="mr-2 h-4 w-4" /> Add Method
            </Button>
        </div>

        {loading ? (
          <div className="flex justify-center items-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {methods.sort((a,b) => a.name.localeCompare(b.name)).map(method => (
              <Card key={method.id} className={cn("transition-opacity", method.status === 'inactive' && "opacity-50")}>
                 <CardHeader className="flex flex-row items-start justify-between">
                  <div className="flex items-center gap-4">
                     {method.iconUrl && <Image src={method.iconUrl} alt={method.name} width={40} height={40} className="rounded-md" />}
                    <div>
                        <CardTitle>{method.name}</CardTitle>
                        <CardDescription>
                            {method.currency} (1 USD = {method.rate} {method.currency})
                        </CardDescription>
                    </div>
                  </div>
                    <div className="flex gap-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openDialog(method)}><Edit className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDeleteMethod(method.id!)}><Trash className="h-4 w-4" /></Button>
                    </div>
                  </CardHeader>
                <CardContent>
                    <div className="text-sm space-y-1">
                        <p>Limit: ${method.minAmount} - {method.unlimited ? 'Unlimited' : `$${method.maxAmount}`}</p>
                        <p>Charge: ${method.fixedCharge} + {method.percentCharge}%</p>
                    </div>
                </CardContent>
                 <CardFooter className="border-t pt-4">
                     <div className="flex items-center justify-between w-full">
                         <Label htmlFor={`status-switch-${method.id}`} className="font-semibold">Enable Method</Label>
                         <Switch
                            id={`status-switch-${method.id}`}
                            checked={method.status === 'active'}
                            onCheckedChange={() => handleToggleStatus(method)}
                        />
                     </div>
                 </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl bg-card border-border">
            <DialogHeader>
              <DialogTitle>{currentMethod?.id ? 'Edit' : 'Add'} Deposit Method</DialogTitle>
              <DialogDescription>
                Fill in the details for the deposit method.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSaveMethod} className="max-h-[70vh] overflow-y-auto pr-4 space-y-4">
                <RadioGroup
                  value={currentMethod.type || 'bank'}
                  onValueChange={(value: 'bank' | 'crypto') => setCurrentMethod(prev => ({...prev, type: value}))}
                  className="grid grid-cols-2 gap-4"
                >
                    <Label className={cn("flex items-center gap-2 p-4 border rounded-lg cursor-pointer", currentMethod.type === 'bank' ? "bg-primary/10 border-primary" : "border-border")}>
                        <RadioGroupItem value="bank" /> <Banknote className="mr-2"/> Bank Wallet
                    </Label>
                    <Label className={cn("flex items-center gap-2 p-4 border rounded-lg cursor-pointer", currentMethod.type === 'crypto' ? "bg-primary/10 border-primary" : "border-border")}>
                        <RadioGroupItem value="crypto" /> <Bitcoin className="mr-2"/> Crypto Wallet
                    </Label>
                </RadioGroup>
                <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={currentMethod.status || 'active'} onValueChange={(value: 'active' | 'inactive') => setCurrentMethod(p => ({...p, status: value}))}>
                        <SelectTrigger><SelectValue/></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="inactive">Inactive</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label>Method Name</Label>
                    <Input value={currentMethod.name || ''} onChange={e => setCurrentMethod(p=>({...p, name: e.target.value}))} required />
                </div>
                 <div className="space-y-2">
                    <Label>Icon URL</Label>
                    <Input value={currentMethod.iconUrl || ''} onChange={e => setCurrentMethod(p=>({...p, iconUrl: e.target.value}))} placeholder="https://example.com/icon.png" required />
                </div>
                 <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-2">
                        <Label>Currency Symbol</Label>
                        <Input value={currentMethod.currency || ''} onChange={e => setCurrentMethod(p=>({...p, currency: e.target.value}))} placeholder="e.g. USDT" required />
                     </div>
                      <div className="space-y-2">
                        <Label>Conversion Rate (to 1 USD)</Label>
                        <Input type="number" value={currentMethod.rate || 1} onChange={e => setCurrentMethod(p=>({...p, rate: parseFloat(e.target.value)}))} required />
                      </div>
                 </div>

                 {currentMethod.type === 'bank' && (
                    <div className="space-y-4 p-4 border rounded-lg">
                        <h4 className="font-semibold">Bank Account Details</h4>
                        {(currentMethod.bankDetails || []).map((detail, index) => (
                            <div key={detail.id || index} className="flex items-end gap-2">
                                <div className="flex-1 space-y-2">
                                    <Label>Label</Label>
                                    <Input value={detail.label} onChange={(e) => handleBankDetailChange(index, 'label', e.target.value)} placeholder="e.g., Account Name" />
                                </div>
                                <div className="flex-1 space-y-2">
                                    <Label>Value</Label>
                                    <Input value={detail.value} onChange={(e) => handleBankDetailChange(index, 'value', e.target.value)} placeholder="e.g., John Doe" />
                                </div>
                                <Button type="button" variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => removeBankDetail(index)}><X className="h-4 w-4"/></Button>
                            </div>
                        ))}
                        <Button type="button" variant="outline" onClick={addBankDetail}><PlusCircle className="mr-2"/> Add Detail</Button>
                    </div>
                )}
                
                {currentMethod.type === 'crypto' && (
                    <div className="space-y-4 p-4 border rounded-lg">
                        <h4 className="font-semibold">Networks</h4>
                        {(currentMethod.networks || []).map((network, index) => (
                            <div key={network.id || index} className="space-y-3 p-3 border rounded-md relative bg-muted/50">
                                <Button type="button" variant="ghost" size="icon" className="absolute top-1 right-1 h-6 w-6 text-destructive hover:text-destructive" onClick={() => removeNetwork(index)}><X className="h-4 w-4"/></Button>
                                <div className="space-y-2">
                                    <Label>Network Name</Label>
                                    <Input value={network.name} onChange={e => handleNetworkChange(index, 'name', e.target.value)} placeholder="e.g. BEP20" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Wallet Address</Label>
                                    <Input value={network.address} onChange={e => handleNetworkChange(index, 'address', e.target.value)} />
                                </div>
                            </div>
                        ))}
                        <Button type="button" variant="outline" onClick={addNetwork}><PlusCircle className="mr-2"/> Add Network</Button>
                    </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Min Amount (USD)</Label>
                        <Input type="number" value={currentMethod.minAmount || ''} onChange={e => setCurrentMethod(p=>({...p, minAmount: parseFloat(e.target.value)}))} required />
                    </div>
                    <div className="space-y-2">
                        <Label>Max Amount (USD)</Label>
                        <Input type="number" value={currentMethod.maxAmount || ''} onChange={e => setCurrentMethod(p=>({...p, maxAmount: parseFloat(e.target.value)}))} disabled={currentMethod.unlimited} required={!currentMethod.unlimited} />
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Switch id="unlimited-switch" checked={currentMethod.unlimited} onCheckedChange={(checked) => setCurrentMethod(prev => ({...prev, unlimited: checked}))} />
                    <Label htmlFor="unlimited-switch">Unlimited Max Amount</Label>
                </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Fixed Charge (USD)</Label>
                        <Input type="number" value={currentMethod.fixedCharge || 0} onChange={e => setCurrentMethod(p=>({...p, fixedCharge: parseFloat(e.target.value)}))} />
                    </div>
                    <div className="space-y-2">
                        <Label>Percent Charge (%)</Label>
                        <Input type="number" value={currentMethod.percentCharge || 0} onChange={e => setCurrentMethod(p=>({...p, percentCharge: parseFloat(e.target.value)}))} />
                    </div>
                </div>
                
                 <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">User Required Information</CardTitle>
                        <CardDescription>Define the form fields users must fill out for this method.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {(currentMethod.fields || []).map((field, index) => (
                            <div key={field.id} className="flex items-end gap-2 border p-3 rounded-md relative bg-muted/50">
                                <Button type="button" variant="ghost" size="icon" className="absolute top-1 right-1 h-7 w-7 text-destructive" onClick={() => removeField(index)}><Trash className="h-4 w-4" /></Button>
                                <div className="grid grid-cols-2 gap-4 flex-1">
                                    <div className="space-y-2">
                                        <Label>Field Label</Label>
                                        <Input value={field.label} onChange={(e) => updateField(index, 'label', e.target.value)} placeholder="e.g., Transaction ID" required/>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Field Type</Label>
                                        <Select value={field.type} onValueChange={(val: FieldType) => updateField(index, 'type', val)}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="text"><Text className="inline-block mr-2 h-4 w-4"/> Text</SelectItem>
                                                <SelectItem value="textarea"><TextareaIcon className="inline-block mr-2 h-4 w-4"/> Text Area</SelectItem>
                                                <SelectItem value="number"><Hash className="inline-block mr-2 h-4 w-4"/> Number</SelectItem>
                                                <SelectItem value="image"><FileImage className="inline-block mr-2 h-4 w-4"/> Image Upload</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-2 pb-1">
                                    <Switch id={`required-${field.id}`} checked={field.required} onCheckedChange={(checked) => updateField(index, 'required', checked)} />
                                    <Label htmlFor={`required-${field.id}`}>Required</Label>
                                </div>
                            </div>
                        ))}
                        <Button type="button" variant="outline" onClick={addField}><PlusCircle className="mr-2 h-4 w-4" /> Add Field</Button>
                    </CardContent>
                </Card>

                 <div className="space-y-2">
                    <Label>Confirmation Instructions</Label>
                    <Textarea value={currentMethod.instructions || ''} onChange={e => setCurrentMethod(p=>({...p, instructions: e.target.value}))} placeholder="Instructions for user after payment." />
                </div>
                
                <DialogFooter className="mt-4">
                    <DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose>
                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Save
                    </Button>
                </DialogFooter>
            </form>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}

    