
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
import { Switch } from "@/components/ui/switch";
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, addDoc, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Info } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Preloader } from '@/components/ui/preloader';

interface StakingPlan {
  id: string;
  planName: string;
  imageUrl?: string;
  minAmount: number;
  maxAmount: number;
  returnPercentage: number;
  durationDays: number;
  capitalBack: boolean;
  payoutType: 'auto' | 'manual';
  status: 'active' | 'inactive';
  earlyUnstakeEnabled: boolean;
  stakingFeePercent: number;
  unstakeFeePercent: number;
}


export default function AdminStakingPage() {
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Form State
    const [formState, setFormState] = useState({
        planName: '',
        imageUrl: '',
        minAmount: '',
        maxAmount: '',
        returnPercentage: '',
        durationDays: '',
        capitalBack: true,
        payoutType: 'auto' as 'auto' | 'manual',
        earlyUnstakeEnabled: false,
        stakingFeePercent: '0',
        unstakeFeePercent: '0',
    });
    
    // Plan List State
    const [plans, setPlans] = useState<StakingPlan[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingPlan, setEditingPlan] = useState<StakingPlan | null>(null);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

    const fetchPlans = async () => {
        if (!db) return;
        setLoading(true);
        try {
            const querySnapshot = await getDocs(collection(db, 'stakingPlans'));
            const plansData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StakingPlan));
            setPlans(plansData);
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: `Failed to fetch plans: ${error.message}` });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPlans();
    }, []);

     const handleFormInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormState(prev => ({...prev, [name]: value}));
    }

    const resetForm = () => {
        setFormState({
            planName: '',
            imageUrl: '',
            minAmount: '',
            maxAmount: '',
            returnPercentage: '',
            durationDays: '',
            capitalBack: true,
            payoutType: 'auto',
            earlyUnstakeEnabled: false,
            stakingFeePercent: '0',
            unstakeFeePercent: '0',
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
                planName: formState.planName,
                imageUrl: formState.imageUrl,
                minAmount: parseFloat(formState.minAmount),
                maxAmount: parseFloat(formState.maxAmount),
                returnPercentage: parseFloat(formState.returnPercentage),
                durationDays: parseInt(formState.durationDays),
                capitalBack: formState.capitalBack,
                payoutType: formState.payoutType,
                stakeCurrency: 'main_balance',
                earlyUnstakeEnabled: formState.earlyUnstakeEnabled,
                stakingFeePercent: parseFloat(formState.stakingFeePercent),
                unstakeFeePercent: parseFloat(formState.unstakeFeePercent),
                status: 'active',
                createdAt: new Date(),
            };

            await addDoc(collection(db, 'stakingPlans'), planData);

            toast({ title: 'Success', description: 'Staking plan created successfully.' });
            resetForm();
            fetchPlans(); // Refresh list
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: `Failed to create plan: ${error.message}` });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEditPlan = (plan: StakingPlan) => {
        setEditingPlan(JSON.parse(JSON.stringify(plan))); // Deep copy
        setIsEditDialogOpen(true);
    };
    
    const handleUpdatePlan = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!db || !editingPlan) return;
        
        setIsSubmitting(true);
        try {
            const planRef = doc(db, 'stakingPlans', editingPlan.id);
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
                await deleteDoc(doc(db, 'stakingPlans', planId));
                toast({ title: 'Success', description: 'Plan deleted successfully.'});
                fetchPlans(); // Refresh list
            } catch (error: any) {
                 toast({ variant: 'destructive', title: 'Error', description: `Failed to delete plan: ${error.message}` });
            }
        }
    }
    
  if (loading) {
      return (
          <AdminLayout>
              <div className="flex items-center justify-center min-h-[calc(100vh-8rem)]">
                  <Preloader />
              </div>
          </AdminLayout>
      );
  }

  return (
    <AdminLayout>
      <div className="space-y-8">
        <form onSubmit={handleCreatePlan}>
            <Card>
            <CardHeader>
                <CardTitle>Create New Staking Plan</CardTitle>
                <CardDescription>
                    Define a new fixed-term staking plan for users.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-2">
                    <Label htmlFor="planName">Plan Name</Label>
                    <Input id="planName" name="planName" placeholder="E.g., 30-Day Stable Stake" value={formState.planName} onChange={handleFormInputChange} required />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="imageUrl">Image URL (Optional)</Label>
                    <Input id="imageUrl" name="imageUrl" placeholder="https://example.com/image.png" value={formState.imageUrl} onChange={handleFormInputChange} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <Label htmlFor="minAmount">Minimum Stake</Label>
                        <Input id="minAmount" name="minAmount" type="number" placeholder="100" value={formState.minAmount} onChange={handleFormInputChange} required />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="maxAmount">Maximum Stake</Label>
                        <Input id="maxAmount" name="maxAmount" type="number" placeholder="10000" value={formState.maxAmount} onChange={handleFormInputChange} required />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="returnPercentage">Total Return (%)</Label>
                        <Input id="returnPercentage" name="returnPercentage" type="number" placeholder="5" value={formState.returnPercentage} onChange={handleFormInputChange} required />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="durationDays">Duration (Days)</Label>
                        <Input id="durationDays" name="durationDays" type="number" placeholder="30" value={formState.durationDays} onChange={handleFormInputChange} required />
                    </div>
                </div>

                 <div className="space-y-4 pt-4 border-t">
                    <h4 className="font-semibold text-lg">Fees &amp; Options</h4>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label htmlFor="stakingFeePercent">Staking Fee (%)</Label>
                            <Input id="stakingFeePercent" name="stakingFeePercent" type="number" placeholder="0" value={formState.stakingFeePercent} onChange={handleFormInputChange} />
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="unstakeFeePercent">Early Unstake Fee (%)</Label>
                            <Input id="unstakeFeePercent" name="unstakeFeePercent" type="number" placeholder="0" value={formState.unstakeFeePercent} onChange={handleFormInputChange} />
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                     <div className="flex items-center space-x-2">
                        <Switch id="early-unstake" checked={formState.earlyUnstakeEnabled} onCheckedChange={(checked) => setFormState(p => ({...p, earlyUnstakeEnabled: checked}))} />
                        <Label htmlFor="early-unstake">Allow Early Unstake</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Switch id="capital-back" checked={formState.capitalBack} onCheckedChange={(checked) => setFormState(p => ({...p, capitalBack: checked}))} />
                        <Label htmlFor="capital-back">Return Capital After Staking Period?</Label>
                    </div>
                    <div>
                        <Label>Payout Type</Label>
                        <RadioGroup value={formState.payoutType} onValueChange={(val: 'auto' | 'manual') => setFormState(p => ({...p, payoutType: val}))} className="flex gap-4 pt-2">
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="auto" id="auto" />
                                <Label htmlFor="auto">Automatic</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="manual" id="manual" />
                                <Label htmlFor="manual">Manual Claim</Label>
                            </div>
                        </RadioGroup>
                    </div>
                </div>
                
            </CardContent>
             <CardFooter className="flex justify-end">
                <Button type="submit" size="lg" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create Plan
                </Button>
            </CardFooter>
            </Card>
        </form>
        
        <Card>
            <CardHeader>
                <CardTitle>Existing Staking Plans</CardTitle>
                <CardDescription>View, edit, or delete existing staking plans.</CardDescription>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Plan Name</TableHead>
                                <TableHead>Return</TableHead>
                                <TableHead>Duration</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {plans.map(plan => (
                                <TableRow key={plan.id}>
                                    <TableCell className="font-medium">{plan.planName}</TableCell>
                                    <TableCell>{plan.returnPercentage}%</TableCell>
                                    <TableCell>{plan.durationDays} Days</TableCell>
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
        <DialogContent className="max-w-2xl">
            <DialogHeader>
                <DialogTitle>Edit Staking Plan: {editingPlan?.planName}</DialogTitle>
                <DialogDescription>Modify the details of the staking plan.</DialogDescription>
            </DialogHeader>
            {editingPlan && (
            <form onSubmit={handleUpdatePlan} className="max-h-[70vh] overflow-y-auto pr-4 space-y-4">
                <div className="space-y-2">
                    <Label>Plan Name</Label>
                    <Input value={editingPlan.planName} onChange={(e) => setEditingPlan({...editingPlan, planName: e.target.value})} />
                </div>
                 <div className="space-y-2">
                    <Label>Image URL</Label>
                    <Input value={editingPlan.imageUrl || ''} onChange={(e) => setEditingPlan({...editingPlan, imageUrl: e.target.value})} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Min Amount</Label>
                        <Input type="number" value={editingPlan.minAmount} onChange={(e) => setEditingPlan({...editingPlan, minAmount: parseFloat(e.target.value) || 0})} />
                    </div>
                    <div className="space-y-2">
                        <Label>Max Amount</Label>
                        <Input type="number" value={editingPlan.maxAmount} onChange={(e) => setEditingPlan({...editingPlan, maxAmount: parseFloat(e.target.value) || 0})} />
                    </div>
                    <div className="space-y-2">
                        <Label>Return (%)</Label>
                        <Input type="number" value={editingPlan.returnPercentage} onChange={(e) => setEditingPlan({...editingPlan, returnPercentage: parseFloat(e.target.value) || 0})} />
                    </div>
                    <div className="space-y-2">
                        <Label>Duration (Days)</Label>
                        <Input type="number" value={editingPlan.durationDays} onChange={(e) => setEditingPlan({...editingPlan, durationDays: parseInt(e.target.value) || 0})} />
                    </div>
                    <div className="space-y-2">
                        <Label>Staking Fee (%)</Label>
                        <Input type="number" value={editingPlan.stakingFeePercent} onChange={(e) => setEditingPlan({...editingPlan, stakingFeePercent: parseFloat(e.target.value) || 0})} />
                    </div>
                    <div className="space-y-2">
                        <Label>Early Unstake Fee (%)</Label>
                        <Input type="number" value={editingPlan.unstakeFeePercent} onChange={(e) => setEditingPlan({...editingPlan, unstakeFeePercent: parseFloat(e.target.value) || 0})} />
                    </div>
                </div>
                 <div className="flex items-center space-x-2">
                    <Switch id="edit-early-unstake" checked={editingPlan.earlyUnstakeEnabled} onCheckedChange={(checked) => setEditingPlan({...editingPlan, earlyUnstakeEnabled: checked})} />
                    <Label htmlFor="edit-early-unstake">Allow Early Unstake</Label>
                </div>
                <div className="flex items-center space-x-2">
                    <Switch id="edit-capital-back" checked={editingPlan.capitalBack} onCheckedChange={(checked) => setEditingPlan({...editingPlan, capitalBack: checked})} />
                    <Label htmlFor="edit-capital-back">Capital Back</Label>
                </div>
                 <div className="space-y-2">
                    <Label>Payout Type</Label>
                    <RadioGroup value={editingPlan.payoutType} onValueChange={(val: 'auto' | 'manual') => setEditingPlan({...editingPlan, payoutType: val})} className="flex gap-4 pt-2">
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="auto" id="edit-auto" />
                            <Label htmlFor="edit-auto">Automatic</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="manual" id="edit-manual" />
                            <Label htmlFor="edit-manual">Manual Claim</Label>
                        </div>
                    </RadioGroup>
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
