
"use client";

import React, { useState, useEffect } from 'react';
import { AdminLayout } from "@/components/layout/admin-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, List, PlusCircle, Edit, Trash2, CalendarDays, Loader2, Eye, Users, CheckCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, addDoc, getDocs, doc, setDoc, deleteDoc, query, where, writeBatch, getDoc } from 'firebase/firestore';
import { timezones } from '@/lib/timezones';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

interface TimeSetting {
  id: string;
  name: string;
  time: number; // in hours
  status: 'active' | 'inactive';
}

const initialTimeSettings: Omit<TimeSetting, 'id'>[] = [
    { name: "Hourly", time: 1, status: "active" },
    { name: "Daily", time: 24, status: "active" },
    { name: "Weekly", time: 168, status: "active" },
    { name: "Monthly", time: 720, status: "active" },
    { name: "Yearly", time: 8760, status: "active" },
];


const weekdays = ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

type ReturnPeriod = 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly';

interface InvestmentPlan {
  id: string;
  planName: string;
  investmentType: 'fixed' | 'range';
  minAmount: number;
  maxAmount: number;
  interestRate: number;
  returnPeriod: ReturnPeriod;
  termDuration: number; // -1 for lifetime
  capitalBack: boolean;
  returnPayout: boolean;
  featured: boolean;
  timezone: string;
  blockedDays: string[];
  status: 'active' | 'inactive';
  imageUrl?: string;
}

interface Investor {
    userId: string;
    amount: number;
    startDate: any;
}

interface ConfirmationSettings {
    showTermsCheckbox: boolean;
    infoBoxEnabled: boolean;
    infoBoxText: string;
    infoBoxBackgroundColor: string;
    infoBoxTextColor: string;
}

export default function CreateInvestmentPlanPage() {
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Form State
    const [planName, setPlanName] = useState('');
    const [investmentType, setInvestmentType] = useState<'fixed' | 'range'>('range');
    const [minAmount, setMinAmount] = useState('');
    const [maxAmount, setMaxAmount] = useState('');
    const [interestRate, setInterestRate] = useState('');
    const [returnPeriod, setReturnPeriod] = useState<ReturnPeriod | ''>('');
    const [termDuration, setTermDuration] = useState('');
    const [unlimitedDuration, setUnlimitedDuration] = useState(false);
    const [capitalBack, setCapitalBack] = useState(false);
    const [returnPayout, setReturnPayout] = useState(false);
    const [featured, setFeatured] = useState(false);
    const [timezone, setTimezone] = useState('');
    const [blockedDays, setBlockedDays] = useState<string[]>([]);
    const [imageUrl, setImageUrl] = useState('');
    
    // Time Setting State
    const [timeSettings, setTimeSettings] = useState<TimeSetting[]>([]);
    const [loadingTimeSettings, setLoadingTimeSettings] = useState(true);
    const [isTimeSettingDialog, setIsTimeSettingDialog] = useState(false);
    const [currentTimeSetting, setCurrentTimeSetting] = useState<Partial<TimeSetting> | null>(null);
    
    // Plan List State
    const [plans, setPlans] = useState<InvestmentPlan[]>([]);
    const [loadingPlans, setLoadingPlans] = useState(true);
    const [editingPlan, setEditingPlan] = useState<InvestmentPlan | null>(null);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

    const [viewingInvestors, setViewingInvestors] = useState<Investor[]>([]);
    const [isInvestorDialogOpen, setIsInvestorDialogOpen] = useState(false);
    const [loadingInvestors, setLoadingInvestors] = useState(false);

    const [confirmationSettings, setConfirmationSettings] = useState<ConfirmationSettings>({
        showTermsCheckbox: true,
        infoBoxEnabled: true,
        infoBoxText: 'Please note that all investments are subject to market risks. Past performance is not indicative of future results.',
        infoBoxBackgroundColor: '#1E3A8A', // Dark Blue
        infoBoxTextColor: '#FFFFFF', // White
    });
    const [savingSettings, setSavingSettings] = useState(false);

    const fetchAllData = async () => {
        if (!db) return;
        setLoadingPlans(true);
        setLoadingTimeSettings(true);
        try {
            // Time Settings
            const timeSettingsSnapshot = await getDocs(collection(db, 'timeSettings'));
            if (timeSettingsSnapshot.empty) {
                const batch = writeBatch(db);
                initialTimeSettings.forEach(setting => {
                    const docRef = doc(collection(db, 'timeSettings'));
                    batch.set(docRef, setting);
                });
                await batch.commit();
                const newSnapshot = await getDocs(collection(db, 'timeSettings'));
                setTimeSettings(newSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TimeSetting)));
            } else {
                setTimeSettings(timeSettingsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TimeSetting)));
            }

            // Investment Plans
            const plansSnapshot = await getDocs(collection(db, 'investmentPlans'));
            setPlans(plansSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InvestmentPlan)));

            // Confirmation Settings
            const settingsDoc = await getDoc(doc(db, 'settings', 'investment'));
            if (settingsDoc.exists()) {
                setConfirmationSettings(settingsDoc.data() as ConfirmationSettings);
            }
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: `Failed to fetch data: ${error.message}` });
        } finally {
            setLoadingPlans(false);
            setLoadingTimeSettings(false);
        }
    };

    useEffect(() => {
        fetchAllData();
    }, []);

    const handleBlockedDayChange = (day: string, checked: boolean) => {
        setBlockedDays(prev => 
            checked ? [...prev, day] : prev.filter(d => d !== day)
        );
    }
    
    const resetForm = () => {
        setPlanName('');
        setInvestmentType('range');
        setMinAmount('');
        setMaxAmount('');
        setInterestRate('');
        setReturnPeriod('');
        setTermDuration('');
        setUnlimitedDuration(false);
        setCapitalBack(false);
        setReturnPayout(false);
        setFeatured(false);
        setTimezone('');
        setBlockedDays([]);
        setImageUrl('');
    }

    const handleCreatePlan = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!db) {
            toast({ variant: 'destructive', title: 'Error', description: 'Firestore is not initialized.' });
            return;
        }

        setIsSubmitting(true);
        try {
            const planData: Omit<InvestmentPlan, 'id'> = {
                planName,
                investmentType,
                minAmount: parseFloat(minAmount),
                maxAmount: investmentType === 'fixed' ? parseFloat(minAmount) : parseFloat(maxAmount),
                interestRate: parseFloat(interestRate),
                returnPeriod: returnPeriod as ReturnPeriod,
                termDuration: unlimitedDuration ? -1 : parseInt(termDuration),
                capitalBack: unlimitedDuration ? false : capitalBack,
                returnPayout,
                featured,
                timezone,
                blockedDays,
                status: 'active',
                imageUrl,
            };

            await addDoc(collection(db, 'investmentPlans'), { ...planData, createdAt: new Date() });

            toast({ title: 'Success', description: 'Investment plan created successfully.' });
            resetForm();
            fetchAllData(); // Refresh list
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: `Failed to create plan: ${error.message}` });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEditPlan = (plan: InvestmentPlan) => {
        setEditingPlan(plan);
        setIsEditDialogOpen(true);
    };
    
    const handleUpdatePlan = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!db || !editingPlan) return;
        
        setIsSubmitting(true);
        try {
            const planRef = doc(db, 'investmentPlans', editingPlan.id);
            await setDoc(planRef, editingPlan, { merge: true });
            toast({ title: 'Success', description: 'Plan updated successfully.' });
            setIsEditDialogOpen(false);
            setEditingPlan(null);
            fetchAllData(); // Refresh list
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
                await deleteDoc(doc(db, 'investmentPlans', planId));
                toast({ title: 'Success', description: 'Plan deleted successfully.'});
                fetchAllData(); // Refresh list
            } catch (error: any) {
                 toast({ variant: 'destructive', title: 'Error', description: `Failed to delete plan: ${error.message}` });
            }
        }
    }

    const handleViewInvestors = async (planId: string) => {
        if (!db) return;
        setLoadingInvestors(true);
        setIsInvestorDialogOpen(true);
        try {
            const q = query(collection(db, "userInvestments"), where("planId", "==", planId));
            const querySnapshot = await getDocs(q);
            const investorsData = querySnapshot.docs.map(doc => doc.data() as Investor);
            setViewingInvestors(investorsData);
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: `Failed to fetch investors: ${error.message}` });
        } finally {
            setLoadingInvestors(false);
        }
    };
    
    const handleOpenTimeSettingDialog = (setting: Partial<TimeSetting> | null) => {
        setCurrentTimeSetting(setting || { name: '', time: 0, status: 'active' });
        setIsTimeSettingDialog(true);
    }
    
    const handleSaveTimeSetting = async () => {
        if(!db || !currentTimeSetting || !currentTimeSetting.name) return;
        setIsSubmitting(true);
        try {
            const settingToSave = { ...currentTimeSetting, time: Number(currentTimeSetting.time) };
            if (currentTimeSetting.id) {
                await setDoc(doc(db, 'timeSettings', currentTimeSetting.id), settingToSave, { merge: true });
                toast({ title: 'Success', description: 'Time setting updated.' });
            } else {
                await addDoc(collection(db, 'timeSettings'), settingToSave);
                toast({ title: 'Success', description: 'Time setting created.' });
            }
            setIsTimeSettingDialog(false);
            fetchAllData();
        } catch(error: any) {
            toast({ variant: 'destructive', title: 'Error', description: `Failed to save setting: ${error.message}` });
        } finally {
            setIsSubmitting(false);
        }
    }
    
    const handleDeleteTimeSetting = async (id: string) => {
        if(!db || !confirm('Are you sure you want to delete this time setting?')) return;
        try {
            await deleteDoc(doc(db, 'timeSettings', id));
            toast({ title: 'Success', description: 'Time setting deleted.' });
            fetchAllData();
        } catch (error: any) {
             toast({ variant: 'destructive', title: 'Error', description: `Failed to delete setting: ${error.message}` });
        }
    }

    const handleConfirmationSettingsChange = (field: keyof ConfirmationSettings, value: string | boolean) => {
        setConfirmationSettings(prev => ({...prev, [field]: value}));
    }

    const handleSaveConfirmationSettings = async () => {
        if(!db) return;
        setSavingSettings(true);
        try {
            await setDoc(doc(db, 'settings', 'investment'), confirmationSettings, { merge: true });
            toast({ title: 'Success', description: 'Confirmation settings updated.'});
        } catch (error: any) {
             toast({ variant: 'destructive', title: 'Error', description: `Failed to save settings: ${error.message}` });
        } finally {
            setSavingSettings(false);
        }
    }

  return (
    <AdminLayout>
      <div className="flex flex-col gap-8">
        <Tabs defaultValue="manage-plan">
            <TabsList className="grid w-full max-w-lg grid-cols-3">
                <TabsTrigger value="time-setting"><Clock className="mr-2" />Time Setting</TabsTrigger>
                <TabsTrigger value="manage-plan"><List className="mr-2" />Manage Plan</TabsTrigger>
                <TabsTrigger value="confirmation"><CheckCircle className="mr-2" />Confirmation Page</TabsTrigger>
            </TabsList>
            <TabsContent value="time-setting">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle>Manage Time Settings</CardTitle>
                            <CardDescription>
                               Define the time intervals for your investment plans.
                            </CardDescription>
                        </div>
                         <Button onClick={() => handleOpenTimeSettingDialog(null)}>
                            <PlusCircle className="mr-2 h-4 w-4" /> Add New
                        </Button>
                    </CardHeader>
                    <CardContent>
                        {loadingTimeSettings ? (
                             <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
                        ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Time (in hours)</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {timeSettings.map((setting) => (
                                    <TableRow key={setting.id}>
                                        <TableCell className="font-medium">{setting.name}</TableCell>
                                        <TableCell>{setting.time} Hours</TableCell>
                                        <TableCell>
                                            <Badge variant={setting.status === 'active' ? 'default' : 'secondary'} className="capitalize">{setting.status}</Badge>
                                        </TableCell>
                                        <TableCell className="text-right space-x-2">
                                            <Button variant="outline" size="sm" onClick={() => handleOpenTimeSettingDialog(setting)}>
                                                <Edit className="mr-1 h-3 w-3" /> Edit
                                            </Button>
                                            <Button variant="destructive" size="sm" onClick={() => handleDeleteTimeSetting(setting.id)}>
                                                <Trash2 className="mr-1 h-3 w-3" /> Delete
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                        )}
                    </CardContent>
                </Card>
            </TabsContent>
            <TabsContent value="manage-plan">
                <div className="space-y-8">
                 <form onSubmit={handleCreatePlan}>
                 <Card>
                    <CardHeader>
                        <CardTitle>Create New Investment Plan</CardTitle>
                        <CardDescription>
                           Create a new investment plan for users.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="plan-name">Plan Name</Label>
                            <Input id="plan-name" placeholder="E.g., Starter Plan" value={planName} onChange={e => setPlanName(e.target.value)} required />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="imageUrl">Image URL (Optional)</Label>
                            <Input id="imageUrl" placeholder="https://example.com/image.png" value={imageUrl} onChange={e => setImageUrl(e.target.value)} />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label>Investment Type</Label>
                                <Select onValueChange={(value: 'fixed' | 'range') => setInvestmentType(value)} value={investmentType}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select investment type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="fixed">Fixed Amount</SelectItem>
                                        <SelectItem value="range">Range</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                             <div className="space-y-2">
                                <Label htmlFor="min-amount">{investmentType === 'fixed' ? 'Amount ($)' : 'Minimum Invest ($)'}</Label>
                                <Input id="min-amount" type="number" placeholder="100" value={minAmount} onChange={e => setMinAmount(e.target.value)} required />
                            </div>
                             {investmentType === 'range' && (
                                <div className="space-y-2">
                                    <Label htmlFor="max-amount">Maximum Invest ($)</Label>
                                    <Input id="max-amount" type="number" placeholder="1000" value={maxAmount} onChange={e => setMaxAmount(e.target.value)} required />
                                </div>
                             )}
                             <div className="space-y-2">
                                <Label htmlFor="interest-rate">Interest Rate (%)</Label>
                                <Input id="interest-rate" type="number" placeholder="10" value={interestRate} onChange={e => setInterestRate(e.target.value)} required />
                            </div>
                             <div className="space-y-2">
                                <Label>Return Period</Label>
                                <Select onValueChange={(value: ReturnPeriod) => setReturnPeriod(value)} value={returnPeriod}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select return period" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {timeSettings.filter(ts => ts.status === 'active').map(ts => (
                                            <SelectItem key={ts.id} value={ts.name.toLowerCase() as ReturnPeriod}>{ts.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            {!unlimitedDuration && (
                                <div className="space-y-2">
                                    <Label htmlFor="term-duration">Term Duration (Times)</Label>
                                    <Input id="term-duration" type="number" placeholder="52" value={termDuration} onChange={e => setTermDuration(e.target.value)} required={!unlimitedDuration} />
                                    <p className="text-xs text-muted-foreground">How many times the user will receive the return.</p>
                                </div>
                            )}
                            <div className="space-y-2">
                                <Label>Time Zone</Label>
                                <Select onValueChange={setTimezone} value={timezone}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a time zone" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <ScrollArea className="h-72">
                                            {timezones.map(tz => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}
                                        </ScrollArea>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center space-x-2">
                                <Switch id="unlimited-duration" checked={unlimitedDuration} onCheckedChange={setUnlimitedDuration} />
                                <Label htmlFor="unlimited-duration">Unlimited Duration (Lifetime Returns)</Label>
                            </div>
                            {!unlimitedDuration && (
                            <div className="flex items-center space-x-2">
                                <Switch id="capital-back" checked={capitalBack} onCheckedChange={setCapitalBack} />
                                <Label htmlFor="capital-back">Capital Will Be Returned After Term End?</Label>
                            </div>
                            )}
                             <div className="flex items-center space-x-2">
                                <Switch id="return-type" checked={returnPayout} onCheckedChange={setReturnPayout} />
                                <Label htmlFor="return-type">Return Payout</Label>
                                <p className="text-sm text-muted-foreground">(Switch ON for Automatic, OFF for Manual Claim)</p>
                            </div>
                            <div className="flex items-center space-x-2">
                                <Switch id="featured" checked={featured} onCheckedChange={setFeatured}/>
                                <Label htmlFor="featured">Make this a featured plan?</Label>
                            </div>
                        </div>

                        <div>
                            <div className="flex items-center gap-2 mb-4">
                               <CalendarDays className="h-5 w-5 text-primary" />
                               <h4 className="font-semibold">Block days for returns</h4>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                                {weekdays.map(day => (
                                    <div key={day} className="flex items-center space-x-2">
                                        <Checkbox id={`day-${day.toLowerCase()}`} onCheckedChange={(checked) => handleBlockedDayChange(day, checked as boolean)} />
                                        <Label htmlFor={`day-${day.toLowerCase()}`}>{day}</Label>
                                    </div>
                                ))}
                            </div>
                        </div>
                        
                        <div className="flex justify-end">
                            <Button type="submit" size="lg" disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Create Plan
                            </Button>
                        </div>
                    </CardContent>
                </Card>
                </form>
                
                <Card>
                    <CardHeader>
                        <CardTitle>Existing Investment Plans</CardTitle>
                        <CardDescription>View, edit, or delete existing investment plans.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {loadingPlans ? (
                            <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Plan Name</TableHead>
                                        <TableHead>Type</TableHead>
                                        <TableHead>Amount</TableHead>
                                        <TableHead>Interest</TableHead>
                                        <TableHead>Term</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {plans.map(plan => (
                                        <TableRow key={plan.id}>
                                            <TableCell className="font-medium">{plan.planName}</TableCell>
                                            <TableCell className="capitalize">{plan.investmentType}</TableCell>
                                            <TableCell>{plan.investmentType === 'fixed' ? `$${plan.minAmount}` : `$${plan.minAmount} - $${plan.maxAmount}`}</TableCell>
                                            <TableCell>{plan.interestRate}% / {plan.returnPeriod}</TableCell>
                                            <TableCell>{plan.termDuration === -1 ? 'Lifetime' : `${plan.termDuration} Times`}</TableCell>
                                            <TableCell><Badge variant={plan.status === 'active' ? 'default' : 'destructive'} className="capitalize">{plan.status}</Badge></TableCell>
                                            <TableCell className="text-right space-x-2">
                                                <Button variant="ghost" size="icon" onClick={() => handleViewInvestors(plan.id)}>
                                                    <Eye className="h-4 w-4" />
                                                </Button>
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
            </TabsContent>
            <TabsContent value="confirmation">
                <Card>
                    <CardHeader>
                        <CardTitle>Investment Confirmation Settings</CardTitle>
                        <CardDescription>Customize the final confirmation screen that users see before investing.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex items-center justify-between p-4 border rounded-md">
                            <Label htmlFor="show-terms" className="font-semibold">Show "Agree to Terms" Checkbox</Label>
                            <Switch id="show-terms" checked={confirmationSettings.showTermsCheckbox} onCheckedChange={(checked) => handleConfirmationSettingsChange('showTermsCheckbox', checked)} />
                        </div>

                         <div className="p-4 border rounded-md space-y-4">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="enable-infobox" className="font-semibold">Enable Information Box</Label>
                                <Switch id="enable-infobox" checked={confirmationSettings.infoBoxEnabled} onCheckedChange={(checked) => handleConfirmationSettingsChange('infoBoxEnabled', checked)} />
                            </div>
                            {confirmationSettings.infoBoxEnabled && (
                                <div className="space-y-4 pt-4 border-t">
                                    <div className="space-y-2">
                                        <Label htmlFor="infobox-text">Box Text</Label>
                                        <Input id="infobox-text" value={confirmationSettings.infoBoxText} onChange={(e) => handleConfirmationSettingsChange('infoBoxText', e.target.value)} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="infobox-bg">Background Color</Label>
                                            <Input id="infobox-bg" type="color" value={confirmationSettings.infoBoxBackgroundColor} onChange={(e) => handleConfirmationSettingsChange('infoBoxBackgroundColor', e.target.value)} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="infobox-text-color">Text Color</Label>
                                            <Input id="infobox-text-color" type="color" value={confirmationSettings.infoBoxTextColor} onChange={(e) => handleConfirmationSettingsChange('infoBoxTextColor', e.target.value)} />
                                        </div>
                                    </div>
                                    <div>
                                        <Label>Preview</Label>
                                        <Alert style={{ backgroundColor: confirmationSettings.infoBoxBackgroundColor, color: confirmationSettings.infoBoxTextColor, borderColor: confirmationSettings.infoBoxTextColor }}>
                                            <AlertTitle>Heads Up!</AlertTitle>
                                            <AlertDescription>{confirmationSettings.infoBoxText}</AlertDescription>
                                        </Alert>
                                    </div>
                                </div>
                            )}
                         </div>
                    </CardContent>
                     <CardFooter>
                        <Button onClick={handleSaveConfirmationSettings} disabled={savingSettings}>
                            {savingSettings && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                            Save Confirmation Settings
                        </Button>
                    </CardFooter>
                </Card>
            </TabsContent>
        </Tabs>
      </div>
      
      {/* Edit Plan Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Edit Plan: {editingPlan?.planName}</DialogTitle>
                <DialogDescription>Modify the details of the investment plan.</DialogDescription>
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
                        <Input type="number" value={editingPlan.minAmount} onChange={(e) => setEditingPlan({...editingPlan, minAmount: parseFloat(e.target.value)})} />
                    </div>
                     {editingPlan.investmentType === 'range' && (
                    <div className="space-y-2">
                        <Label>Max Amount</Label>
                        <Input type="number" value={editingPlan.maxAmount} onChange={(e) => setEditingPlan({...editingPlan, maxAmount: parseFloat(e.target.value)})} />
                    </div>
                    )}
                    <div className="space-y-2">
                        <Label>Interest Rate (%)</Label>
                        <Input type="number" value={editingPlan.interestRate} onChange={(e) => setEditingPlan({...editingPlan, interestRate: parseFloat(e.target.value)})} />
                    </div>
                    <div className="space-y-2">
                        <Label>Term Duration</Label>
                        <Input type="number" value={editingPlan.termDuration === -1 ? '' : editingPlan.termDuration} onChange={(e) => setEditingPlan({...editingPlan, termDuration: parseInt(e.target.value)})} disabled={editingPlan.termDuration === -1} />
                    </div>
                </div>
                 <div className="flex items-center space-x-2">
                    <Switch id="edit-unlimited" checked={editingPlan.termDuration === -1} onCheckedChange={(checked) => setEditingPlan({...editingPlan, termDuration: checked ? -1 : 0, capitalBack: checked ? false : editingPlan.capitalBack})} />
                    <Label htmlFor="edit-unlimited">Unlimited Duration</Label>
                </div>
                <div className="flex items-center space-x-2">
                    <Switch id="edit-featured" checked={editingPlan.featured} onCheckedChange={(checked) => setEditingPlan({...editingPlan, featured: checked})} />
                    <Label htmlFor="edit-featured">Featured</Label>
                </div>
                {editingPlan.termDuration !== -1 && (
                <div className="flex items-center space-x-2">
                    <Switch id="edit-capital-back" checked={editingPlan.capitalBack} onCheckedChange={(checked) => setEditingPlan({...editingPlan, capitalBack: checked})} />
                    <Label htmlFor="edit-capital-back">Capital Back</Label>
                </div>
                )}
                 <div className="flex items-center space-x-2">
                    <Switch id="edit-return-payout" checked={editingPlan.returnPayout} onCheckedChange={(checked) => setEditingPlan({...editingPlan, returnPayout: checked})} />
                    <Label htmlFor="edit-return-payout">Return Payout (Auto/Manual)</Label>
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
      
      {/* View Investors Dialog */}
      <Dialog open={isInvestorDialogOpen} onOpenChange={setIsInvestorDialogOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Plan Investors</DialogTitle>
            </DialogHeader>
            {loadingInvestors ? (
                 <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
            ) : viewingInvestors.length > 0 ? (
                <ScrollArea className="max-h-96">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>User ID</TableHead>
                                <TableHead>Amount</TableHead>
                                <TableHead>Date</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {viewingInvestors.map((investor, index) => (
                                <TableRow key={index}>
                                    <TableCell className="truncate max-w-[100px]">{investor.userId}</TableCell>
                                    <TableCell>${investor.amount.toFixed(2)}</TableCell>
                                    <TableCell>{new Date(investor.startDate.seconds * 1000).toLocaleDateString()}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </ScrollArea>
            ) : (
                <p className="text-center text-muted-foreground p-8">No investors in this plan yet.</p>
            )}
        </DialogContent>
      </Dialog>
      
      {/* Time Setting Dialog */}
      <Dialog open={isTimeSettingDialog} onOpenChange={setIsTimeSettingDialog}>
          <DialogContent>
              <DialogHeader>
                  <DialogTitle>{currentTimeSetting?.id ? 'Edit' : 'Add'} Time Setting</DialogTitle>
              </DialogHeader>
              <div className="py-4 space-y-4">
                  <div className="space-y-2">
                      <Label>Name</Label>
                      <Input value={currentTimeSetting?.name || ''} onChange={e => setCurrentTimeSetting(p => ({...p, name: e.target.value}))} placeholder="e.g., Bi-Weekly" />
                  </div>
                   <div className="space-y-2">
                      <Label>Time (in hours)</Label>
                      <Input type="number" value={currentTimeSetting?.time || 0} onChange={e => setCurrentTimeSetting(p => ({...p, time: parseInt(e.target.value)}))} />
                  </div>
                  <div className="space-y-2">
                      <Label>Status</Label>
                       <Select value={currentTimeSetting?.status || 'active'} onValueChange={(value: 'active' | 'inactive') => setCurrentTimeSetting(p => ({...p, status: value}))}>
                            <SelectTrigger><SelectValue/></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="inactive">Inactive</SelectItem>
                            </SelectContent>
                        </Select>
                  </div>
              </div>
              <DialogFooter>
                  <Button variant="secondary" onClick={() => setIsTimeSettingDialog(false)}>Cancel</Button>
                  <Button onClick={handleSaveTimeSetting} disabled={isSubmitting}>
                      {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                      Save
                  </Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
