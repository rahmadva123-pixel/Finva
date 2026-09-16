
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { AdminLayout } from "@/components/layout/admin-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlusCircle, Trash2, Settings, History, Users, Loader2, Gift, ClipboardEdit, CalendarClock, Edit, ChevronsUpDown, Check, X, Download, TrendingUp } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';
import { db } from '@/lib/firebase';
import { doc, setDoc, getDoc, collection, addDoc, getDocs, deleteDoc, runTransaction, query, where, updateDoc, orderBy, serverTimestamp } from 'firebase/firestore';
import { invalidateCachedDoc } from '@/lib/clientCache';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { format } from 'date-fns';
import { Preloader } from '@/components/ui/preloader';
import { addEarning } from '@/lib/earnings';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import Papa from 'papaparse';


interface IndividualTask {
    id: string;
    name: string;
    url: string;
    buttonText: string;
    buttonColor: string;
    verificationQuestion: string;
}

interface TaskCampaign {
    id: string;
    name: string;
    description: string;
    totalReward: number;
    tasks: IndividualTask[];
    payoutMethod: 'automatic' | 'manual';
}

interface PendingApproval {
    id: string;
    userId: string;
    userEmail: string;
    campaignId: string;
    campaignName: string;
    answers: { taskId: string; answer: string }[];
    submittedAt: any;
}

interface BonusTransaction {
    id: string;
    userId: string;
    userEmail?: string;
    type: 'signup' | 'daily' | 'task' | 'interest' | 'promo';
    amount: number;
    date: any;
    description: string;
}

export default function AdminBonusPage() {
    const { toast } = useToast();
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // Signup Bonus State
    const [signupBonusEnabled, setSignupBonusEnabled] = useState(false);
    const [signupBonusAmount, setSignupBonusAmount] = useState('');
    const [signupBonusHistory, setSignupBonusHistory] = useState<BonusTransaction[]>([]);

    // Daily Bonus State
    const [dailyBonusEnabled, setDailyBonusEnabled] = useState(false);
    const [dailyBonusAmount, setDailyBonusAmount] = useState('');
    const [dailyBonusStart, setDailyBonusStart] = useState('');
    const [dailyBonusEnd, setDailyBonusEnd] = useState('');
    const [dailyBonusHistory, setDailyBonusHistory] = useState<BonusTransaction[]>([]);

    // Promo Code State
    const [promoCodeEnabled, setPromoCodeEnabled] = useState(true);
    const [promoCodeMinDeposit, setPromoCodeMinDeposit] = useState('495');
    const [promoCodeRewardPercentage, setPromoCodeRewardPercentage] = useState('1');

    // VIP program temporarily disabled — state removed

    // Daily Interest State
    const [dailyInterestEnabled, setDailyInterestEnabled] = useState(true);
    const [dailyInterestRate, setDailyInterestRate] = useState('1'); // 1% daily
    const [dailyInterestMinBalance, setDailyInterestMinBalance] = useState('0'); // Minimum balance to earn interest
    const [dailyInterestHistory, setDailyInterestHistory] = useState<BonusTransaction[]>([]);
    const [processingDailyInterest, setProcessingDailyInterest] = useState(false);
    const [interestProcessingResult, setInterestProcessingResult] = useState<string>('');
    
    // Task Campaign State
    const [taskCampaigns, setTaskCampaigns] = useState<TaskCampaign[]>([]);
    const [isCampaignDialogOpen, setIsCampaignDialogOpen] = useState(false);
    const [currentCampaign, setCurrentCampaign] = useState<Partial<TaskCampaign> & { tasks?: IndividualTask[] } | null>(null);
    const [isSubmittingCampaign, setIsSubmittingCampaign] = useState(false);

    // Approval State
    const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([]);
    const [loadingApprovals, setLoadingApprovals] = useState(false);
    const [taskBonusHistory, setTaskBonusHistory] = useState<BonusTransaction[]>([]);


    const fetchBonusHistory = useCallback(async (type: BonusTransaction['type']): Promise<BonusTransaction[]> => {
        if (!db) return [];
        try {
            const q = query(collection(db, 'bonusTransactions'), where('type', '==', type), orderBy('date', 'desc'));
            const querySnapshot = await getDocs(q);
            
            const historyData = await Promise.all(querySnapshot.docs.map(async d => {
                const data = d.data();
                let userEmail = 'Unknown User';
                try {
                    if (data.userId) {
                        const userDoc = await getDoc(doc(db, 'users', data.userId));
                        if(userDoc.exists()) {
                            userEmail = userDoc.data().email;
                        }
                    }
                } catch (userError) {
                    console.error(`Failed to fetch user ${data.userId}`, userError);
                }
                return {
                    id: d.id,
                    ...data,
                    userEmail,
                } as BonusTransaction;
            }));
            
            return historyData;
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: `Failed to fetch ${type} bonus history.` });
            console.error(`Error fetching ${type} bonus history:`, error);
            return [];
        }
    }, [toast]);
    

    const fetchAllData = useCallback(async () => {
        if (!db) { setIsLoading(false); return; }
        setIsLoading(true);
        try {
            // Fetch bonus settings
            const docRef = doc(db, 'settings', 'bonus');
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                setSignupBonusEnabled(data.signupBonusEnabled ?? false);
                setSignupBonusAmount(data.signupBonusAmount?.toString() || '');
                setDailyBonusEnabled(data.dailyBonusEnabled ?? false);
                setDailyBonusAmount(data.dailyBonusAmount?.toString() || '');
                setDailyBonusStart(data.dailyBonusStart || '');
                setDailyBonusEnd(data.dailyBonusEnd || '');
                setDailyInterestEnabled(data.dailyInterestEnabled ?? true);
                setDailyInterestRate(data.dailyInterestRate?.toString() || '1');
                setDailyInterestMinBalance(data.dailyInterestMinBalance?.toString() || '0');
                setPromoCodeEnabled(data.promoCodeEnabled ?? true);
                setPromoCodeMinDeposit(data.promoCodeMinDeposit?.toString() || '495');
                setPromoCodeRewardPercentage(data.promoCodeRewardPercentage?.toString() || '1');
                // VIP program settings intentionally ignored (feature disabled for now)
            }

            // Fetch task campaigns
            const campaignsSnapshot = await getDocs(collection(db, 'taskCampaigns'));
            const campaignsData = campaignsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TaskCampaign));
            setTaskCampaigns(campaignsData);

             // Fetch all bonus histories sequentially to avoid toast issues in Promise.all
            const signupHistory = await fetchBonusHistory('signup');
            setSignupBonusHistory(signupHistory);
            
            const dailyHistory = await fetchBonusHistory('promo');
            setDailyBonusHistory(dailyHistory);
            
            const interestHistory = await fetchBonusHistory('interest');
            setDailyInterestHistory(interestHistory);
            
            const taskHistory = await fetchBonusHistory('task');
            setTaskBonusHistory(taskHistory);


        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to fetch settings or campaigns.' });
            console.error("Error in fetchAllData:", error)
        } finally {
            setIsLoading(false);
        }
    }, [toast, fetchBonusHistory]);

    
    const fetchApprovals = useCallback(async () => {
        if(!db) return;
        setLoadingApprovals(true);
        try {
            const q = query(collection(db, 'taskSubmissions'), where('status', '==', 'pending'));
            const querySnapshot = await getDocs(q);
            
            const approvalsData = await Promise.all(querySnapshot.docs.map(async d => {
                const data = d.data();
                const userDoc = await getDoc(doc(db, 'users', data.userId));
                return {
                    id: d.id,
                    ...data,
                    userEmail: userDoc.exists() ? userDoc.data().email : 'Unknown User'
                } as PendingApproval;
            }));
            setPendingApprovals(approvalsData);
            
        } catch(error: any) {
            toast({ variant: 'destructive', title: 'Error', description: `Failed to fetch approvals: ${error.message}`});
        } finally {
            setLoadingApprovals(false);
        }
    }, [toast]);

    useEffect(() => {
        fetchAllData();
        fetchApprovals();
    }, [fetchAllData, fetchApprovals]);


    const handleSaveChanges = async () => {
        if(!db) {
            toast({ variant: 'destructive', title: 'Error', description: 'Firestore is not initialized.' });
            return;
        }
        setIsSaving(true);
        try {
            // VIP validation skipped since VIP program is disabled
            const settingsData = {
                signupBonusEnabled,
                signupBonusAmount: parseFloat(signupBonusAmount) || 0,
                dailyBonusEnabled,
                dailyBonusAmount: parseFloat(dailyBonusAmount) || 0,
                dailyBonusStart,
                dailyBonusEnd,
                promoCodeEnabled,
                promoCodeMinDeposit: parseFloat(promoCodeMinDeposit) || 495,
                promoCodeRewardPercentage: parseFloat(promoCodeRewardPercentage) || 1,
                dailyInterestEnabled,
                dailyInterestRate: parseFloat(dailyInterestRate) || 1,
                dailyInterestMinBalance: parseFloat(dailyInterestMinBalance) || 0,
                // VIP program settings intentionally omitted while feature is disabled
            };
            await setDoc(doc(db, 'settings', 'bonus'), settingsData, { merge: true });
            toast({ title: 'Success', description: 'Bonus settings saved successfully.' });
            try { invalidateCachedDoc('settings', 'bonus'); } catch (_) {}
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: `Failed to save settings: ${error.message}` });
        } finally {
            setIsSaving(false);
        }
    }
    
    const handleCampaignDialogOpen = (campaign: TaskCampaign | null = null) => {
        if (campaign) {
            setCurrentCampaign(JSON.parse(JSON.stringify(campaign))); // Deep copy
        } else {
            setCurrentCampaign({ name: '', description: '', totalReward: 0, tasks: [], payoutMethod: 'automatic' });
        }
        setIsCampaignDialogOpen(true);
    };

    const handleSaveCampaign = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!db || !currentCampaign || !currentCampaign.name) {
            toast({ variant: 'destructive', title: 'Error', description: 'Campaign name is required.' });
            return;
        };
        
        setIsSubmittingCampaign(true);
        try {
            const campaignToSave: Omit<TaskCampaign, 'id'> = {
                name: currentCampaign.name!,
                description: currentCampaign.description!,
                totalReward: currentCampaign.totalReward!,
                tasks: currentCampaign.tasks || [],
                payoutMethod: currentCampaign.payoutMethod || 'automatic',
            };

            if (currentCampaign.id) {
                // Update existing
                const campaignRef = doc(db, 'taskCampaigns', currentCampaign.id);
                await setDoc(campaignRef, campaignToSave, { merge: true });
                toast({ title: 'Success', description: 'Campaign updated.'});
            } else {
                // Create new
                await addDoc(collection(db, 'taskCampaigns'), campaignToSave);
                toast({ title: 'Success', description: 'New campaign created.'});
            }
            setIsCampaignDialogOpen(false);
            setCurrentCampaign(null);
            fetchAllData(); // Refresh list
        } catch (error: any) {
             toast({ variant: 'destructive', title: 'Error', description: `Failed to save campaign: ${error.message}` });
        } finally {
            setIsSubmittingCampaign(false);
        }
    };

    const handleDeleteCampaign = async (id: string) => {
        if (!db || !confirm('Are you sure you want to delete this campaign?')) return;
        try {
            await deleteDoc(doc(db, 'taskCampaigns', id));
            toast({ title: 'Success', description: 'Campaign deleted.'});
            fetchAllData(); // Refresh
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: `Failed to delete campaign: ${error.message}` });
        }
    };

    const handleProcessDailyInterest = async () => {
        if (!db) {
            toast({ variant: 'destructive', title: 'Error', description: 'Firestore is not initialized.' });
            return;
        }

        setProcessingDailyInterest(true);
        try {
            const usersSnapshot = await getDocs(collection(db, 'users'));
            const users = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), doc }));

            let processedCount = 0;
            let totalInterestPaid = 0;

            for (const user of users) {
                const userBalance = (user as any).balance || 0;
                const minBalance = parseFloat(dailyInterestMinBalance) || 0;

                // Only process users with balance above minimum
                if (userBalance >= minBalance) {
                    const interestRate = parseFloat(dailyInterestRate) || 1;
                    const interestAmount = (userBalance * interestRate) / 100;

                    if (interestAmount > 0) {
                        // Update user balance and total earning
                        const newBalance = userBalance + interestAmount;
                        const newTotalEarning = ((user as any).totalEarning || 0) + interestAmount;

                        await runTransaction(db, async (transaction) => {
                            const userRef = doc(db, 'users', user.id);
                            transaction.update(userRef, {
                                balance: newBalance,
                                totalEarning: newTotalEarning
                            });

                            // Add earning record
                            await addEarning(transaction, user.id, interestAmount, user.doc, null);

                            // Create interest transaction record
                            const interestRef = doc(collection(db, 'bonusTransactions'));
                            transaction.set(interestRef, {
                                userId: user.id,
                                amount: interestAmount,
                                type: 'interest',
                                description: `Daily interest: ${interestRate}% on balance of $${userBalance.toFixed(2)}`,
                                date: serverTimestamp()
                            });
                        });

                        processedCount++;
                        totalInterestPaid += interestAmount;
                    }
                }
            }

            toast({
                title: "Daily Interest Processed",
                description: `Processed interest for ${processedCount} users. Total interest paid: ${totalInterestPaid.toFixed(2)}`
            });

            // Refresh history
            const interestHistory = await fetchBonusHistory('interest');
            setDailyInterestHistory(interestHistory);
            setInterestProcessingResult(`Processed interest for ${processedCount} users. Total: $${totalInterestPaid.toFixed(2)}`);

        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: `Failed to process daily interest: ${error.message}` });
            setInterestProcessingResult(`Error: ${error.message}`);
        } finally {
            setProcessingDailyInterest(false);
        }
    };

    // VIP tiers handlers removed (feature disabled temporarily)
    
    // Task handlers within the dialog
    const handleAddTask = () => {
        if (!currentCampaign) return;
        const newTask: IndividualTask = {
            id: Date.now().toString(),
            name: 'New Task',
            url: '',
            buttonText: 'Complete Task',
            buttonColor: '#6B46C1', // default purple
            verificationQuestion: '',
        };
        setCurrentCampaign(prev => ({ ...prev, tasks: [...(prev?.tasks || []), newTask] }));
    };
    
    const handleUpdateTask = (taskId: string, field: keyof Omit<IndividualTask, 'id'>, value: string) => {
        if (!currentCampaign) return;
        setCurrentCampaign(prev => ({
            ...prev,
            tasks: (prev?.tasks || []).map(task =>
                task.id === taskId ? { ...task, [field]: value } : task
            ),
        }));
    };
    
    const handleRemoveTask = (taskId: string) => {
        if (!currentCampaign) return;
        setCurrentCampaign(prev => ({
            ...prev,
            tasks: (prev?.tasks || []).filter(task => task.id !== taskId),
        }));
    }

    const handleApprovalAction = async (submission: PendingApproval, action: 'approve' | 'reject') => {
        if(!db) return;
        try {
            if (action === 'approve') {
                await runTransaction(db, async (transaction) => {
                    const submissionRef = doc(db, 'taskSubmissions', submission.id);
                    const campaignDoc = await getDoc(doc(db, 'taskCampaigns', submission.campaignId));
                    if (!campaignDoc.exists()) throw new Error("Campaign not found.");
                    const campaignData = campaignDoc.data() as TaskCampaign;
    
                    const userRef = doc(db, 'users', submission.userId);
                    const earningRulesDocRef = doc(db, 'settings', 'earningRules');

                    const [userDoc, earningRulesDoc] = await Promise.all([
                        transaction.get(userRef),
                        transaction.get(earningRulesDocRef)
                    ]);
    
                    if (!userDoc.exists()) throw new Error("User not found.");
    
                    await addEarning(transaction, submission.userId, campaignData.totalReward, userDoc, earningRulesDoc);
    
                    transaction.update(submissionRef, { status: 'approved' });
    
                    const bonusTransactionRef = doc(collection(db, 'bonusTransactions'));
                    transaction.set(bonusTransactionRef, {
                        userId: submission.userId,
                        type: 'task',
                        amount: campaignData.totalReward,
                        date: serverTimestamp(),
                        description: `Task Bonus: ${campaignData.name}`
                    });
                });
            } else { // reject
                const submissionRef = doc(db, 'taskSubmissions', submission.id);
                await updateDoc(submissionRef, { status: 'rejected' });
            }

            toast({ title: 'Success', description: `Submission has been ${action}d.`});
            fetchApprovals();
            fetchBonusHistory('task').then(setTaskBonusHistory);
        } catch (error: any) {
             toast({ variant: 'destructive', title: 'Error', description: `Failed to process approval: ${error.message}` });
        }
    }

    const downloadCSV = (type: 'signup' | 'daily' | 'task') => {
        const history = type === 'signup' ? signupBonusHistory : type === 'daily' ? dailyBonusHistory : taskBonusHistory;
        const data = history.map(item => {
            const base = {
                'User Email': item.userEmail,
                'Amount': `$${(item.amount || 0).toFixed(2)}`,
                'Date': item.date?.seconds ? format(new Date(item.date.seconds * 1000), 'PPp') : 'N/A',
            };
            if(type === 'task') {
                return {...base, 'Description': item.description };
            }
            return base;
        });
        const csv = Papa.unparse(data);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', `${type}_bonus_history.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };
    
    const getBase64FromUrl = (url: string): Promise<string> => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'Anonymous';
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    return reject(new Error('Canvas context not available'));
                }
                ctx.drawImage(img, 0, 0);
                resolve(canvas.toDataURL('image/png'));
            };
            img.onerror = () => reject(new Error(`Failed to load image for PDF: ${url}`));
            img.src = url;
        });
    };

    const downloadPDF = async (type: 'signup' | 'daily' | 'task') => {
        const pdfDoc = new jsPDF();
        let startY = 15;
    
        const generalSettingsDoc = await getDoc(doc(db, 'settings', 'general'));
        const brandingData = generalSettingsDoc.exists() ? generalSettingsDoc.data() : {};
        const { 
            companyName = 'My App', 
            companySlogan = '', 
            logoUrl = '',
            pdfHeaderType = 'logo_and_text',
            pdfHeaderTextColor = '#000000',
            pdfSloganTextColor = '#555555'
        } = brandingData;
    
        if ((pdfHeaderType === 'logo_and_text' || pdfHeaderType === 'logo_only') && logoUrl) {
            try {
                const logoBase64 = await getBase64FromUrl(logoUrl);
                const imgProps = pdfDoc.getImageProperties(logoBase64);
                const imgWidth = 40;
                const imgHeight = (imgProps.height * imgWidth) / imgProps.width;
                pdfDoc.addImage(logoBase64, 'PNG', 14, startY, imgWidth, imgHeight);
                startY += imgHeight + 2;
            } catch (e) {
                console.error("Error adding logo to PDF", e);
            }
        }
        
        if (pdfHeaderType === 'logo_and_text' || pdfHeaderType === 'text_only') {
            if (pdfHeaderType === 'text_only' && !logoUrl) startY = 22;
             pdfDoc.setTextColor(pdfHeaderTextColor);
             pdfDoc.setFontSize(16).setFont('helvetica', 'bold').text(companyName, 14, startY);
             startY += 8;
             if (companySlogan) {
                 pdfDoc.setTextColor(pdfSloganTextColor);
                 pdfDoc.setFontSize(10).setFont('helvetica', 'normal').text(companySlogan, 14, startY);
                 startY += 6;
             }
        }
        
        startY += 5;
        pdfDoc.setTextColor(0, 0, 0);
    
        const history = type === 'signup' ? signupBonusHistory : type === 'daily' ? dailyBonusHistory : taskBonusHistory;
        const title = `${type.charAt(0).toUpperCase() + type.slice(1)} Bonus History`;
        const head = type === 'task' ? [['User Email', 'Description', 'Amount', 'Date']] : [['User Email', 'Amount', 'Date']];
        const body = history.map(item => {
             const base = [
                item.userEmail || 'N/A',
                `$${(item.amount || 0).toFixed(2)}`,
                item.date?.seconds ? format(new Date(item.date.seconds * 1000), 'PPp') : 'N/A',
            ];
            if (type === 'task') {
                base.splice(1, 0, item.description || 'N/A');
            }
            return base;
        });
    
        pdfDoc.setFontSize(12).setFont('helvetica', 'bold').text(title, 14, startY);
        autoTable(pdfDoc, { head, body, startY: startY + 6 });
        pdfDoc.save(`${type}_bonus_history.pdf`);
    };

    if (isLoading) {
        return (
            <AdminLayout>
                <div className="flex justify-center items-center h-full">
                    <Preloader />
                </div>
            </AdminLayout>
        )
    }

    return (
        <AdminLayout>
            <div className="flex flex-col gap-8">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold font-headline tracking-tight">Bonus Settings</h1>
                        <p className="text-muted-foreground">Configure signup, promo, task, and bonus rewards for users.</p>
                    </div>
                    <Button onClick={handleSaveChanges} disabled={isSaving}>
                        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                        Save Changes
                    </Button>
                </div>

                 <Tabs defaultValue="signup">
                      <TabsList className="grid w-full max-w-lg grid-cols-7">
                        <TabsTrigger value="signup"><Gift className="mr-2" />Signup</TabsTrigger>
                        <TabsTrigger value="task"><ClipboardEdit className="mr-2" />Tasks</TabsTrigger>
                        <TabsTrigger value="approvals"><Check className="mr-2" />Approvals</TabsTrigger>
                        <TabsTrigger value="daily"><CalendarClock className="mr-2" />Promo</TabsTrigger>
                        <TabsTrigger value="interest"><TrendingUp className="mr-2" />Interest</TabsTrigger>
                        <TabsTrigger value="history"><History className="mr-2" />History</TabsTrigger>
                          {/* VIP tab removed while feature is disabled */}
                    </TabsList>
                    <TabsContent value="signup" className="space-y-8">
                         <Card>
                            <CardHeader>
                                <CardTitle>Signup Bonus</CardTitle>
                                <CardDescription>Reward new users instantly when they register an account.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-center justify-between p-4 border rounded-md">
                                    <Label htmlFor="signup-bonus-enabled">Enable Signup Bonus</Label>
                                    <Switch id="signup-bonus-enabled" checked={signupBonusEnabled} onCheckedChange={setSignupBonusEnabled} />
                                </div>
                                {signupBonusEnabled && (
                                <div className="space-y-2">
                                    <Label htmlFor="signup-bonus-amount">Bonus Amount ($)</Label>
                                    <Input id="signup-bonus-amount" type="number" placeholder="e.g., 5.00" value={signupBonusAmount} onChange={e => setSignupBonusAmount(e.target.value)} />
                                </div>
                                )}
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle>Bonus Recipients</CardTitle>
                                    <CardDescription>A list of users who have received the signup bonus.</CardDescription>
                                </div>
                                {signupBonusHistory.length > 0 && (
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="outline"><Download className="mr-2 h-4 w-4"/> Export</Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent>
                                            <DropdownMenuItem onSelect={() => downloadCSV('signup')}>Download CSV</DropdownMenuItem>
                                            <DropdownMenuItem onSelect={() => downloadPDF('signup')}>Download PDF</DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                )}
                            </CardHeader>
                            <CardContent>
                                {signupBonusHistory.length > 0 ? (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>User Email</TableHead>
                                                <TableHead>Amount</TableHead>
                                                <TableHead>Date</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {signupBonusHistory.map(item => (
                                                <TableRow key={item.id}>
                                                    <TableCell>{item.userEmail}</TableCell>
                                                    <TableCell>${(item.amount || 0).toFixed(2)}</TableCell>
                                                    <TableCell>{item.date?.seconds ? format(new Date(item.date.seconds * 1000), 'PPp') : 'N/A'}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                ) : (
                                    <p className="text-center text-muted-foreground p-8">No signup bonuses have been awarded yet.</p>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                    <TabsContent value="task">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle>Task Campaign Setup</CardTitle>
                                    <CardDescription>Create multi-step task campaigns for users to complete and earn rewards.</CardDescription>
                                </div>
                                <Button onClick={() => handleCampaignDialogOpen()}><PlusCircle className="mr-2"/> Add New Campaign</Button>
                            </CardHeader>
                            <CardContent>
                                {taskCampaigns.length > 0 ? (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Campaign Name</TableHead>
                                                <TableHead>Total Reward</TableHead>
                                                <TableHead># of Tasks</TableHead>
                                                <TableHead>Payout</TableHead>
                                                <TableHead className="text-right">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {taskCampaigns.map(campaign => (
                                                <TableRow key={campaign.id}>
                                                    <TableCell className="font-medium">{campaign.name}</TableCell>
                                                    <TableCell>${(campaign.totalReward || 0).toFixed(2)}</TableCell>
                                                    <TableCell>{campaign.tasks.length}</TableCell>
                                                    <TableCell className="capitalize">{campaign.payoutMethod}</TableCell>
                                                    <TableCell className="text-right space-x-2">
                                                        <Button variant="outline" size="icon" onClick={() => handleCampaignDialogOpen(campaign)}>
                                                            <Edit className="h-4 w-4" />
                                                        </Button>
                                                        <Button variant="destructive" size="icon" onClick={() => handleDeleteCampaign(campaign.id)}>
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                ) : (
                                    <p className="text-center text-muted-foreground p-8">No task campaigns created yet.</p>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                     <TabsContent value="approvals">
                        <Card>
                            <CardHeader>
                                <CardTitle>Pending Approvals</CardTitle>
                                <CardDescription>Review and approve task submissions from users.</CardDescription>
                            </CardHeader>
                            <CardContent>
                               {loadingApprovals ? (
                                    <div className="flex justify-center items-center h-48"><Preloader /></div>
                               ) : pendingApprovals.length > 0 ? (
                                    <Accordion type="multiple" className="w-full space-y-4">
                                        {pendingApprovals.map(submission => (
                                            <AccordionItem value={submission.id} key={submission.id} className="border rounded-md">
                                                <div className="flex items-center px-4 py-2">
                                                    <AccordionTrigger className="flex-1 hover:no-underline pr-4">
                                                        <div className="flex justify-between w-full">
                                                            <div className="font-medium">{submission.campaignName}</div>
                                                            <div className="text-sm text-muted-foreground">{submission.userEmail}</div>
                                                            <div className="text-xs text-muted-foreground">{submission.submittedAt?.seconds ? format(new Date(submission.submittedAt.seconds * 1000), 'PPp') : 'N/A'}</div>
                                                        </div>
                                                    </AccordionTrigger>
                                                     <div className="flex gap-2 shrink-0">
                                                        <Button size="sm" variant="outline" className="bg-red-500/10 text-red-500 hover:bg-red-500/20" onClick={() => handleApprovalAction(submission, 'reject')}><X className="mr-1 h-4 w-4"/> Reject</Button>
                                                        <Button size="sm" variant="outline" className="bg-green-500/10 text-green-500 hover:bg-green-500/20" onClick={() => handleApprovalAction(submission, 'approve')}><Check className="mr-1 h-4 w-4"/> Approve</Button>
                                                    </div>
                                                </div>
                                                <AccordionContent className="pt-4 px-4 pb-4 border-t space-y-4">
                                                    <h4 className="font-semibold">User's Answers:</h4>
                                                    {submission.answers.map(ans => (
                                                        <div key={ans.taskId}>
                                                            <p className="text-sm font-medium">Task ID: {ans.taskId}</p>
                                                            <p className="text-sm text-muted-foreground bg-muted p-2 rounded-md">{ans.answer}</p>
                                                        </div>
                                                    ))}
                                                </AccordionContent>
                                            </AccordionItem>
                                        ))}
                                    </Accordion>
                               ) : (
                                    <p className="text-center text-muted-foreground p-8">No pending approvals.</p>
                               )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                    <TabsContent value="daily">
                        <Card>
                            <CardHeader>
                                <CardTitle>Daily Promo Code Setup</CardTitle>
                                <CardDescription>Eligible users receive their first code 24 hours after a qualifying deposit, and each next unique code arrives 24 hours after the previous one.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                               <div className="flex items-center justify-between p-4 border rounded-md">
                                    <Label htmlFor="promo-code-enabled">Enable Daily Promo Code</Label>
                                    <Switch id="promo-code-enabled" checked={promoCodeEnabled} onCheckedChange={setPromoCodeEnabled} />
                                </div>
                                {promoCodeEnabled && (
                                <>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="promo-min-deposit">Minimum Completed Deposit ($)</Label>
                                        <Input id="promo-min-deposit" type="number" placeholder="e.g., 495" value={promoCodeMinDeposit} onChange={e => setPromoCodeMinDeposit(e.target.value)} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="promo-reward-percentage">Reward Percentage (%)</Label>
                                        <Input id="promo-reward-percentage" type="number" step="0.1" placeholder="e.g., 1" value={promoCodeRewardPercentage} onChange={e => setPromoCodeRewardPercentage(e.target.value)} />
                                    </div>
                                </div>
                                 <p className="text-sm text-muted-foreground">Example: users with completed deposits of at least $495 receive their first unique code after 24 hours, then each next code becomes available 24 hours after the last issued code.</p>
                                </>
                                )}
                            </CardContent>
                        </Card>
                         <Card>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle>Promo Redemption History</CardTitle>
                                    <CardDescription>A list of users who have redeemed their daily promo reward.</CardDescription>
                                </div>
                                {dailyBonusHistory.length > 0 && (
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="outline"><Download className="mr-2 h-4 w-4"/> Export</Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent>
                                            <DropdownMenuItem onSelect={() => downloadCSV('daily')}>Download CSV</DropdownMenuItem>
                                            <DropdownMenuItem onSelect={() => downloadPDF('daily')}>Download PDF</DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                )}
                            </CardHeader>
                            <CardContent>
                                {dailyBonusHistory.length > 0 ? (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>User Email</TableHead>
                                                <TableHead>Amount</TableHead>
                                                <TableHead>Date</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {dailyBonusHistory.map(item => (
                                                <TableRow key={item.id}>
                                                    <TableCell>{item.userEmail}</TableCell>
                                                    <TableCell>${(item.amount || 0).toFixed(2)}</TableCell>
                                                    <TableCell>{item.date?.seconds ? format(new Date(item.date.seconds * 1000), 'PPp') : 'N/A'}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                ) : (
                                    <p className="text-center text-muted-foreground p-8">No promo rewards have been redeemed yet.</p>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                    <TabsContent value="interest">
                        <Card>
                            <CardHeader>
                                <CardTitle>Daily Interest Settings</CardTitle>
                                <CardDescription>Configure daily interest payments for user account balances.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <Label htmlFor="interest-enabled">Enable Daily Interest</Label>
                                        <Switch
                                            id="interest-enabled"
                                            checked={dailyInterestEnabled}
                                            onCheckedChange={setDailyInterestEnabled}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="interest-rate">Interest Rate (%)</Label>
                                        <Input
                                            id="interest-rate"
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            max="100"
                                            value={dailyInterestRate}
                                            onChange={(e) => setDailyInterestRate((parseFloat(e.target.value) || 0).toString())}
                                            placeholder="1.00"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="interest-min-balance">Minimum Balance ($)</Label>
                                        <Input
                                            id="interest-min-balance"
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={dailyInterestMinBalance}
                                            onChange={(e) => setDailyInterestMinBalance((parseFloat(e.target.value) || 0).toString())}
                                            placeholder="0.00"
                                        />
                                    </div>
                                </div>
                                <div className="flex gap-4">
                                    <Button onClick={handleSaveChanges} disabled={isSaving}>
                                        {isSaving ? 'Saving...' : 'Save Settings'}
                                    </Button>
                                    <Button
                                        onClick={handleProcessDailyInterest}
                                        disabled={processingDailyInterest || !dailyInterestEnabled}
                                        variant="outline"
                                    >
                                        {processingDailyInterest ? 'Processing...' : 'Process Daily Interest'}
                                    </Button>
                                </div>
                                {interestProcessingResult && (
                                    <div className="p-4 border rounded-lg bg-muted">
                                        <h4 className="font-semibold mb-2">Last Processing Result</h4>
                                        <p className="text-sm">{interestProcessingResult}</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                    {/* VIP tab content removed while Monthly VIP feature is disabled */}
                    <TabsContent value="history">
                        <Card>
                             <CardHeader className="flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle>Task Bonus History</CardTitle>
                                    <CardDescription>A log of all approved manual task bonuses.</CardDescription>
                                </div>
                                {taskBonusHistory.length > 0 && (
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="outline"><Download className="mr-2 h-4 w-4"/> Export</Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent>
                                            <DropdownMenuItem onSelect={() => downloadCSV('task')}>Download CSV</DropdownMenuItem>
                                            <DropdownMenuItem onSelect={() => downloadPDF('task')}>Download PDF</DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                )}
                            </CardHeader>
                             <CardContent>
                                {taskBonusHistory.length > 0 ? (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>User Email</TableHead>
                                                <TableHead>Description</TableHead>
                                                <TableHead>Amount</TableHead>
                                                <TableHead>Date</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {taskBonusHistory.map(item => (
                                                <TableRow key={item.id}>
                                                    <TableCell>{item.userEmail}</TableCell>
                                                    <TableCell>{item.description}</TableCell>
                                                    <TableCell>${(item.amount || 0).toFixed(2)}</TableCell>
                                                    <TableCell>{item.date?.seconds ? format(new Date(item.date.seconds * 1000), 'PPp') : 'N/A'}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                ) : (
                                    <p className="text-center text-muted-foreground p-8">No task bonuses have been awarded yet.</p>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                 </Tabs>

            </div>

             <Dialog open={isCampaignDialogOpen} onOpenChange={setIsCampaignDialogOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{currentCampaign?.id ? 'Edit' : 'Create'} Task Campaign</DialogTitle>
                        <DialogDescription>Fill out the details for your task campaign.</DialogDescription>
                    </DialogHeader>
                    {currentCampaign && (
                        <form onSubmit={handleSaveCampaign} className="space-y-4 max-h-[70vh] overflow-y-auto pr-4">
                            <div className="p-4 border rounded-lg space-y-4">
                                <h4 className="font-semibold text-lg">Campaign Details</h4>
                                <div className="space-y-2">
                                    <Label htmlFor="campaign-name">Campaign Name</Label>
                                    <Input id="campaign-name" value={currentCampaign.name} onChange={(e) => setCurrentCampaign({...currentCampaign, name: e.target.value})} required/>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="campaign-desc">Description</Label>
                                    <Textarea id="campaign-desc" value={currentCampaign.description} onChange={(e) => setCurrentCampaign({...currentCampaign, description: e.target.value})} />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="campaign-reward">Total Reward Amount ($)</Label>
                                        <Input id="campaign-reward" type="number" value={currentCampaign.totalReward} onChange={(e) => setCurrentCampaign({...currentCampaign, totalReward: parseFloat(e.target.value) || 0})} required/>
                                        <p className="text-xs text-muted-foreground">This reward is granted after all tasks are completed and approved.</p>
                                    </div>
                                     <div className="space-y-2">
                                        <Label>Payout Method</Label>
                                        <RadioGroup 
                                            value={currentCampaign.payoutMethod} 
                                            onValueChange={(value: 'automatic' | 'manual') => setCurrentCampaign({...currentCampaign, payoutMethod: value})}
                                        >
                                            <div className="flex items-center space-x-2">
                                                <RadioGroupItem value="automatic" id="auto" />
                                                <Label htmlFor="auto">Automatic</Label>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <RadioGroupItem value="manual" id="manual" />
                                                <Label htmlFor="manual">Manual (Admin Approval)</Label>
                                            </div>
                                        </RadioGroup>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="p-4 border rounded-lg space-y-4">
                                <div className="flex justify-between items-center">
                                    <h4 className="font-semibold text-lg">Tasks</h4>
                                    <Button type="button" variant="outline" size="sm" onClick={handleAddTask}><PlusCircle className="mr-2 h-4 w-4" /> Add Task</Button>
                                </div>
                                <Accordion type="multiple" className="w-full space-y-2">
                                    {(currentCampaign.tasks || []).map((task, index) => (
                                        <AccordionItem value={task.id} key={task.id} className="border rounded-md bg-muted/50">
                                            <div className="flex items-center px-4">
                                                <AccordionTrigger className="flex-1 py-2 hover:no-underline">
                                                    <span className="font-medium">Task {index + 1}: {task.name}</span>
                                                </AccordionTrigger>
                                                <Button type="button" variant="ghost" size="icon" className="shrink-0 text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); handleRemoveTask(task.id); }}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                            <AccordionContent className="space-y-4 pt-4 px-4 pb-4 border-t bg-background">
                                                <div className="space-y-2">
                                                    <Label>Task Name</Label>
                                                    <Input value={task.name} onChange={(e) => handleUpdateTask(task.id, 'name', e.target.value)} />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Task URL</Label>
                                                    <Input value={task.url} onChange={(e) => handleUpdateTask(task.id, 'url', e.target.value)} />
                                                </div>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-2">
                                                        <Label>Button Text</Label>
                                                        <Input value={task.buttonText} onChange={(e) => handleUpdateTask(task.id, 'buttonText', e.target.value)} />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label>Button Color</Label>
                                                        <Input type="color" value={task.buttonColor} onChange={(e) => handleUpdateTask(task.id, 'buttonColor', e.target.value)} className="h-10"/>
                                                    </div>
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Verification Question</Label>
                                                    <Textarea value={task.verificationQuestion} onChange={(e) => handleUpdateTask(task.id, 'verificationQuestion', e.target.value)} placeholder="e.g., What was the code on the page?" />
                                                </div>
                                            </AccordionContent>
                                        </AccordionItem>
                                    ))}
                                </Accordion>
                                {(!currentCampaign.tasks || currentCampaign.tasks.length === 0) && (
                                     <p className="text-center text-sm text-muted-foreground py-4">No tasks added yet.</p>
                                )}
                            </div>

                            <DialogFooter>
                                <Button type="button" variant="secondary" onClick={() => setIsCampaignDialogOpen(false)}>Cancel</Button>
                                <Button type="submit" disabled={isSubmittingCampaign}>
                                    {isSubmittingCampaign && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                                    Save Campaign
                                </Button>
                            </DialogFooter>
                        </form>
                    )}
                </DialogContent>
            </Dialog>
        </AdminLayout>
    )
}
