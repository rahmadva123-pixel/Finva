
"use client";

import React, { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/layout/admin-layout';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, addDoc, getDocs, doc, setDoc, deleteDoc, writeBatch, query, where, updateDoc } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PlusCircle, Edit, Trash, Loader2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import Image from 'next/image';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';

interface DigitalCurrency {
  id: string;
  name: string;
  symbol: string;
  iconUrl: string;
  rate: number;
  status: 'active' | 'inactive';
}

export default function DigitalCurrenciesPage() {
  const { toast } = useToast();
  const [currencies, setCurrencies] = useState<DigitalCurrency[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentCurrency, setCurrentCurrency] = useState<Partial<DigitalCurrency>>({});

  useEffect(() => {
    const fetchCurrencies = async () => {
      if (!db) { setLoading(false); return; }
      try {
        const querySnapshot = await getDocs(collection(db, 'digitalCurrencies'));
        const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DigitalCurrency));
        setCurrencies(data);
      } catch (error) {
        console.error('Error fetching digital currencies:', error);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch currencies.' });
      } finally {
        setLoading(false);
      }
    };
    fetchCurrencies();
  }, [toast]);

  const handleSaveCurrency = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !currentCurrency) return;

    setIsSubmitting(true);
    
    const currencyToSave: Omit<DigitalCurrency, 'id'> = {
        name: currentCurrency.name || '',
        symbol: currentCurrency.symbol || '',
        iconUrl: currentCurrency.iconUrl || '',
        rate: Number(currentCurrency.rate || 1),
        status: currentCurrency.status || 'active',
    };

    try {
        if (currentCurrency.id) {
            await setDoc(doc(db, 'digitalCurrencies', currentCurrency.id), currencyToSave, { merge: true });
            setCurrencies(currencies.map(c => c.id === currentCurrency.id ? { ...c, ...currencyToSave } as DigitalCurrency : c));
            toast({ title: 'Success', description: 'Currency updated successfully.' });
        } else {
            const docRef = await addDoc(collection(db, 'digitalCurrencies'), currencyToSave);
            setCurrencies([...currencies, { id: docRef.id, ...currencyToSave }]);
            toast({ title: 'Success', description: 'Currency added successfully.' });
        }
        setIsDialogOpen(false);
        setCurrentCurrency({});
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleDeleteCurrency = async (id: string) => {
      if(!db || !id) return;
      if(!confirm('Are you sure you want to delete this currency? This will also delete all user wallets associated with it.')) return;

      try {
          const batch = writeBatch(db);
          
          const walletsQuery = query(collection(db, 'digitalWallets'), where('currencyId', '==', id));
          const walletsSnapshot = await getDocs(walletsQuery);
          walletsSnapshot.forEach(walletDoc => {
              batch.delete(walletDoc.ref);
          });

          const currencyRef = doc(db, 'digitalCurrencies', id);
          batch.delete(currencyRef);
          
          await batch.commit();

          setCurrencies(currencies.filter(c => c.id !== id));
          toast({ title: 'Success', description: 'Currency and all associated wallets have been deleted.' });
      } catch (error: any) {
           toast({ variant: 'destructive', title: 'Error', description: `Failed to delete currency: ${error.message}` });
      }
  }
  
  const handleToggleStatus = async (id: string, currentStatus: 'active' | 'inactive') => {
      if (!db) return;
      const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
      try {
          await updateDoc(doc(db, 'digitalCurrencies', id), { status: newStatus });
          setCurrencies(prev => prev.map(c => c.id === id ? { ...c, status: newStatus } : c));
          toast({ title: 'Success', description: `Currency status updated to ${newStatus}.` });
      } catch (error: any) {
          toast({ variant: 'destructive', title: 'Error', description: `Failed to update status: ${error.message}` });
      }
  };
  
  const openDialog = (currency: Partial<DigitalCurrency> | null = null) => {
    setCurrentCurrency(currency || { name: '', symbol: '', iconUrl: '', rate: 1, status: 'active' });
    setIsDialogOpen(true);
  };

  return (
    <AdminLayout>
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold font-headline tracking-tight">Digital Currencies</h1>
                    <p className="text-muted-foreground">Manage custom currencies for the P2P digital wallet system.</p>
                </div>
                <Button onClick={() => openDialog()}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Currency
                </Button>
            </div>
            
            <Card>
                <CardHeader>
                    <CardTitle>Available Currencies</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin"/></div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Icon</TableHead>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Symbol</TableHead>
                                    <TableHead>Rate (to 1 USD)</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {currencies.map(currency => (
                                    <TableRow key={currency.id}>
                                        <TableCell>
                                            {currency.iconUrl && <Image src={currency.iconUrl} alt={currency.name} width={32} height={32} />}
                                        </TableCell>
                                        <TableCell className="font-semibold">{currency.name}</TableCell>
                                        <TableCell>{currency.symbol}</TableCell>
                                        <TableCell>{currency.rate}</TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <Switch
                                                    checked={currency.status === 'active'}
                                                    onCheckedChange={() => handleToggleStatus(currency.id, currency.status)}
                                                />
                                                <Badge variant={currency.status === 'active' ? 'default' : 'secondary'}>
                                                    {currency.status}
                                                </Badge>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right space-x-2">
                                            <Button variant="outline" size="icon" onClick={() => openDialog(currency)}><Edit className="h-4 w-4"/></Button>
                                            <Button variant="destructive" size="icon" onClick={() => handleDeleteCurrency(currency.id)}><Trash className="h-4 w-4"/></Button>
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
        <DialogContent>
            <DialogHeader>
              <DialogTitle>{currentCurrency?.id ? 'Edit' : 'Add'} Digital Currency</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSaveCurrency} className="space-y-4 pt-4">
                <div className="space-y-2">
                    <Label>Currency Name</Label>
                    <Input value={currentCurrency?.name || ''} onChange={e => setCurrentCurrency(p=>({...p, name: e.target.value}))} placeholder="e.g., MyToken" required />
                </div>
                <div className="space-y-2">
                    <Label>Currency Symbol</Label>
                    <Input value={currentCurrency?.symbol || ''} onChange={e => setCurrentCurrency(p=>({...p, symbol: e.target.value}))} placeholder="e.g., MTK" required />
                </div>
                <div className="space-y-2">
                    <Label>Icon URL</Label>
                    <Input value={currentCurrency?.iconUrl || ''} onChange={e => setCurrentCurrency(p=>({...p, iconUrl: e.target.value}))} placeholder="https://example.com/icon.png" required />
                </div>
                <div className="space-y-2">
                    <Label>Rate (how much 1 USD is worth in this currency)</Label>
                    <Input type="number" step="any" value={currentCurrency?.rate || 1} onChange={e => setCurrentCurrency(p=>({...p, rate: parseFloat(e.target.value)}))} required />
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
