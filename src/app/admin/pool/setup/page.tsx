
"use client";

import React, { useState, useEffect } from 'react';
import { AdminLayout } from "@/components/layout/admin-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, PlusCircle, Edit, Trash2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, addDoc, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';

interface PoolPlan {
  id: string;
  poolName: string;
  totalAmount: number;
  investTill: string; // Date string
  returnDate: string; // Date string
  minReturn: number;
  maxReturn: number;
  payoutType: 'auto' | 'manual';
  status: 'active' | 'inactive';
  featured: boolean;
  imageUrl?: string;
}

export default function AdminPoolSetupPage() {
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Form State
    const [formState, setFormState] = useState({
        poolName: '',
        imageUrl: '',
        totalAmount: '',
        investTill: '',
        returnDate: '',
        minReturn: '',
        maxReturn: '',
        payoutType: 'auto' as 'auto' | 'manual',
        featured: false,
    });
    
    // Plan List State
    const [plans, setPlans] = useState<PoolPlan[]>([]);
    const [loadingPlans, setLoadingPlans] = useState(true);
    const [editingPlan, setEditingPlan] = useState<PoolPlan | null>(null);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

    const fetchPlans = async () => {
        if (!db) return;
        setLoadingPlans(true);
        try {
            const querySnapshot = await getDocs(collection(db, 'poolPlans'));
            const plansData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PoolPlan));
            setPlans(plansData);
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: `Failed to fetch plans: ${error.message}` });
        } finally {
            setLoadingPlans(false);
        }
    };

    useEffect(() => {
        fetchPlans();
    }, []);
    
    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        const checked = (e.target as HTMLInputElement).checked;
        setFormState(prev => ({...prev, [name]: type === 'checkbox' ? checked : value }));
    }

    const handlePayoutTypeChange = (value: 'auto' | 'manual') => {
        setFormState(prev => ({...prev, payoutType: value}));
    }

    const resetForm = () => {
        setFormState({
            poolName: '',
            imageUrl: '',
            totalAmount: '',
            investTill: '',
            returnDate: '',
            minReturn: '',
            maxReturn: '',
            payoutType: 'auto',
            featured: false,
        });
    }

    const handleCreatePlan = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!db) {
            toast({ variant: 'destructive', title: 'Error', description: 'Firestore is not initialized.' });
            return;
        }

        setIsSubmitting(true);
        try {
            const planData = {
                poolName: formState.poolName,
                imageUrl: formState.imageUrl,
                totalAmount: parseFloat(formState.totalAmount),
                investTill: formState.investTill,
                returnDate: formState.returnDate,
                minReturn: parseFloat(formState.minReturn),
                maxReturn: parseFloat(formState.maxReturn),
                payoutType: formState.payoutType,
                featured: formState.featured,
                status: 'active',
                createdAt: new Date(),
            };

            await addDoc(collection(db, 'poolPlans'), planData);

            toast({ title: 'Success', description: 'Pool plan created successfully.' });
            resetForm();
            fetchPlans(); // Refresh list
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: `Failed to create plan: ${error.message}` });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleEditPlan = (plan: PoolPlan) => {
        setEditingPlan(JSON.parse(JSON.stringify(plan))); // Deep copy
        setIsEditDialogOpen(true);
    };

    const handleUpdatePlan = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!db || !editingPlan) return;
        
        setIsSubmitting(true);
        try {
            const planRef = doc(db, 'poolPlans', editingPlan.id);
            await setDoc(planRef, editingPlan, { merge: true });
            toast({ title: 'Success', description: 'Plan updated successfully.' });
            setIsEditDialogOpen(false);
            setEditingPlan(null);
            fetchPlans(); // Refresh list
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: `Failed to update plan: ${error.message}` });
        } finally {
            setIsSubmitting(false);
        }
    }
    
    const handleDeletePlan = async (planId: string) => {
        if(!db) return;
        if (confirm('Are you sure you want to delete this plan? This action cannot be undone.')) {
            try {
                await deleteDoc(doc(db, 'poolPlans', planId));
                toast({ title: 'Success', description: 'Plan deleted successfully.'});
                fetchPlans(); // Refresh list
            } catch (error: any) {
                 toast({ variant: 'destructive', title: 'Error', description: `Failed to delete plan: ${error.message}` });
            }
        }
    }

  return (
    <AdminLayout>
      <div className="space-y-8">
        <form onSubmit={handleCreatePlan}>
            <Card>
            <CardHeader>
                <CardTitle>Create New Pool</CardTitle>
                <CardDescription>
                    Define the parameters for a new investment pool.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-2">
                    <Label htmlFor="poolName">Pool Name</Label>
                    <Input id="poolName" name="poolName" placeholder="E.g., Gold Pool" value={formState.poolName} onChange={handleFormChange} required />
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="imageUrl">Image URL (Optional)</Label>
                    <Input id="imageUrl" name="imageUrl" placeholder="https://example.com/image.png" value={formState.imageUrl} onChange={handleFormChange} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <Label htmlFor="totalAmount">Total Amount ($)</Label>
                        <Input id="totalAmount" name="totalAmount" type="number" placeholder="100000" value={formState.totalAmount} onChange={handleFormChange} required />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     <div className="space-y-2">
                        <Label htmlFor="investTill">Invest Till</Label>
                        <Input id="investTill" name="investTill" type="date" value={formState.investTill} onChange={handleFormChange} required />
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="returnDate">Return Date</Label>
                        <Input id="returnDate" name="returnDate" type="date" value={formState.returnDate} onChange={handleFormChange} required />
                    </div>
                </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     <div className="space-y-2">
                        <Label htmlFor="minReturn">Min Return (%)</Label>
                        <Input id="minReturn" name="minReturn" type="number" placeholder="3" value={formState.minReturn} onChange={handleFormChange} required />
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="maxReturn">Max Return (%)</Label>
                        <Input id="maxReturn" name="maxReturn" type="number" placeholder="10" value={formState.maxReturn} onChange={handleFormChange} required />
                    </div>
                </div>
                 <div className="space-y-4">
                    <div>
                        <Label>Payout Method</Label>
                         <RadioGroup value={formState.payoutType} onValueChange={handlePayoutTypeChange} className="flex gap-4 pt-2">
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="auto" id="auto" />
                                <Label htmlFor="auto">Automatic (Randomized)</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="manual" id="manual" />
                                <Label htmlFor="manual">Manual</Label>
                            </div>
                        </RadioGroup>
                        <p className="text-xs text-muted-foreground">Automatic payout will randomly assign a return within the range on the return date.</p>
                    </div>
                     <div className="flex items-center space-x-2">
                        <Switch id="featured" name="featured" checked={formState.featured} onCheckedChange={(checked) => setFormState(p => ({...p, featured: checked}))} />
                        <Label htmlFor="featured">Make this a featured plan?</Label>
                    </div>
                </div>
                
            </CardContent>
             <CardFooter className="flex justify-end">
                <Button type="submit" size="lg" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create Pool Plan
                </Button>
            </CardFooter>
            </Card>
        </form>
        
        <Card>
            <CardHeader>
                <CardTitle>Existing Pool Plans</CardTitle>
                <CardDescription>View, edit, or delete existing pool plans.</CardDescription>
            </CardHeader>
            <CardContent>
                {loadingPlans ? (
                    <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Plan Name</TableHead>
                                <TableHead>Total Amount</TableHead>
                                <TableHead>Return Range</TableHead>
                                <TableHead>Payout</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {plans.map(plan => (
                                <TableRow key={plan.id}>
                                    <TableCell className="font-medium flex items-center gap-2">
                                        {plan.poolName}
                                        {plan.featured && <Badge>Featured</Badge>}
                                    </TableCell>
                                    <TableCell>${plan.totalAmount.toLocaleString()}</TableCell>
                                    <TableCell>{plan.minReturn}% - {plan.maxReturn}%</TableCell>
                                    <TableCell className="capitalize">{plan.payoutType}</TableCell>
                                    <TableCell><Badge variant={plan.status === 'active' ? 'default' : 'destructive'} className="capitalize">{plan.status}</Badge></TableCell>
                                    <TableCell className="text-right space-x-2">
                                        <Button variant="outline" size="icon" onClick={() => handleEditPlan(plan)}>
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                        <Button variant="destructive" size="icon" onClick={() => handleDeletePlan(plan.id)}>
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
      
      {/* Edit Plan Dialog */}
       <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Edit Pool Plan: {editingPlan?.poolName}</DialogTitle>
                <DialogDescription>Modify the details of the pool plan.</DialogDescription>
            </DialogHeader>
            {editingPlan && (
            <form onSubmit={handleUpdatePlan} className="max-h-[70vh] overflow-y-auto pr-4 space-y-4">
                <div className="space-y-2">
                    <Label>Plan Name</Label>
                    <Input value={editingPlan.poolName} onChange={(e) => setEditingPlan({...editingPlan, poolName: e.target.value})} />
                </div>
                 <div className="space-y-2">
                    <Label>Image URL</Label>
                    <Input value={editingPlan.imageUrl || ''} onChange={(e) => setEditingPlan({...editingPlan, imageUrl: e.target.value})} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Total Amount</Label>
                        <Input type="number" value={editingPlan.totalAmount} onChange={(e) => setEditingPlan({...editingPlan, totalAmount: parseFloat(e.target.value) || 0})} />
                    </div>
                     <div className="space-y-2">
                        <Label>Invest Till</Label>
                        <Input type="date" value={editingPlan.investTill} onChange={(e) => setEditingPlan({...editingPlan, investTill: e.target.value})} />
                    </div>
                     <div className="space-y-2">
                        <Label>Return Date</Label>
                        <Input type="date" value={editingPlan.returnDate} onChange={(e) => setEditingPlan({...editingPlan, returnDate: e.target.value})} />
                    </div>
                     <div className="space-y-2">
                        <Label>Min Return (%)</Label>
                        <Input type="number" value={editingPlan.minReturn} onChange={(e) => setEditingPlan({...editingPlan, minReturn: parseFloat(e.target.value) || 0})} />
                    </div>
                     <div className="space-y-2">
                        <Label>Max Return (%)</Label>
                        <Input type="number" value={editingPlan.maxReturn} onChange={(e) => setEditingPlan({...editingPlan, maxReturn: parseFloat(e.target.value) || 0})} />
                    </div>
                </div>
                 <div className="space-y-2">
                    <Label>Status</Label>
                    <select
                        value={editingPlan.status}
                        onChange={(e) => setEditingPlan({...editingPlan, status: e.target.value as 'active' | 'inactive'})}
                        className="w-full p-2 border rounded-md bg-background"
                    >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                    </select>
                </div>
                 <div className="flex items-center space-x-2">
                    <Switch id="edit-featured" checked={editingPlan.featured} onCheckedChange={(checked) => setEditingPlan({...editingPlan, featured: checked})} />
                    <Label htmlFor="edit-featured">Featured</Label>
                </div>
                <DialogFooter>
                    <Button type="button" variant="secondary" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Save Changes'}
                    </Button>
                </DialogFooter>
            </form>
            )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
