
"use client";

import React, { useState, useEffect } from 'react';
import { AdminLayout } from "@/components/layout/admin-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, updateDoc, getDoc, writeBatch, serverTimestamp, addDoc, runTransaction, deleteDoc } from 'firebase/firestore';
import { Loader2, Check, X, User, ArrowRight, Phone, FileImage, Trash2, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import Image from 'next/image';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import Papa from 'papaparse';
import { addEarning } from '@/lib/earnings';
import { ensureDailyPromoCode } from '@/lib/promo';


interface Deposit {
    id: string;
    userId: string;
    amount: number;
    method: string;
    network?: string;
    status: string;
    createdAt: any;
    user?: { email: string, uid: string, referredBy?: string };
    methodId?: string;
    details?: { [key: string]: string };
}

interface CurrencySettings {
  symbol: string;
  position: 'left' | 'right';
}

interface NotificationSettings {
    [key: string]: boolean;
}

export default function AdminPendingDepositsPage() {
    const [deposits, setDeposits] = useState<Deposit[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [currency, setCurrency] = useState<CurrencySettings>({ symbol: '$', position: 'left' });
    const { toast } = useToast();
    const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({});
    const [logoUrl, setLogoUrl] = useState('');

    const fetchDeposits = async () => {
        if (!db) {
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const generalSettingsDoc = await getDoc(doc(db, 'settings', 'general'));
            if (generalSettingsDoc.exists()) {
                setLogoUrl(generalSettingsDoc.data().logoUrl || '');
            }

            const currencyDoc = await getDoc(doc(db, "settings", "currency"));
            if (currencyDoc.exists()) {
              setCurrency(currencyDoc.data() as CurrencySettings);
            }
            
            const notificationSettingsDoc = await getDoc(doc(db, 'settings', 'notifications'));
            if (notificationSettingsDoc.exists()) {
                setNotificationSettings(notificationSettingsDoc.data());
            }

            const q = query(collection(db, "deposits"), where("status", "==", "pending"));
            const querySnapshot = await getDocs(q);
            const depositsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Deposit[];

            // Fetch user data for each deposit
            const depositsWithUsers = await Promise.all(depositsData.map(async (deposit) => {
                const userDoc = await getDoc(doc(db, "users", deposit.userId));
                if (userDoc.exists()) {
                    return { ...deposit, user: userDoc.data() as { email: string, uid: string, referredBy?: string } };
                }
                return deposit;
            }));

            setDeposits(depositsWithUsers);
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error fetching deposits', description: error.message });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDeposits();
    }, []);

    const handleAction = async (deposit: Deposit, newStatus: 'completed' | 'rejected') => {
        if (!db || !deposit.user) return;
        setProcessingId(deposit.id);

        const depositRef = doc(db, "deposits", deposit.id);

        try {
            if (newStatus === 'completed') {
                const earningRulesDocRef = doc(db, 'settings', 'earningRules');
                const [earningRulesDoc] = await Promise.all([
                    getDoc(earningRulesDocRef),
                ]);

                const directReferrerId = deposit.user.referredBy;
                // Read refreshment settings (enable + amount)
                const refreshSettingsRef = doc(db, 'settings', 'refreshment');
                const refreshSettingsSnap = await getDoc(refreshSettingsRef);
                const refreshmentEnabled = refreshSettingsSnap.exists() ? (refreshSettingsSnap.data().enabled ?? true) : false;
                const refreshmentAmount = refreshSettingsSnap.exists() ? (Number(refreshSettingsSnap.data().amount) || 50) : 50;
                const refreshmentAutoCredit = refreshSettingsSnap.exists() ? Boolean(refreshSettingsSnap.data().autoCredit) : false;
                // Referral settings removed: always use current new referral rules
                const userRef = doc(db, "users", deposit.userId);

                await runTransaction(db, async (transaction) => {
                    const depositDoc = await transaction.get(depositRef);
                    if (!depositDoc.exists() || depositDoc.data().status !== 'pending') {
                        throw new Error("This deposit has already been processed.");
                    }
                    
                    const userDoc = await transaction.get(userRef);
                    if (!userDoc.exists()) throw new Error("User not found.");
                    
                    const userData = userDoc.data();

                    // Read referrer doc if needed (before any writes)
                    let referrerDoc = null;
                    if (directReferrerId) {
                        const referrerRef = doc(db, "users", directReferrerId);
                        referrerDoc = await transaction.get(referrerRef);
                    }

                    const currentBalance = userData.balance || 0;
                    const finalAmount = deposit.amount;

                    // Mark deposit completed (balance will be updated via addEarning to avoid overwrite)
                    transaction.update(depositRef, { status: 'completed', completedAt: serverTimestamp() });

                    let bonusAmount = 0;

                    // Determine which referral rules apply based on when the user was referred
                    // Always apply the current referral bonus percentage (new rules)
                    const bonusPercentage = 13; // default new rule

                    // Apply referral bonus if user was referred and referrer exists
                    if (directReferrerId && referrerDoc && referrerDoc.exists()) {
                        // bonusPercentage determined above
                        bonusAmount = Number(((deposit.amount * bonusPercentage) / 100).toFixed(2));

                            if (bonusAmount > 0) {
                            // Credit referrer (ensure full credit regardless of earning-power ledger)
                            try {
                                const referrerRef2 = doc(db, "users", directReferrerId);
                                const refData = referrerDoc.data();
                                const refBalance = refData.balance || 0;
                                const refTotalEarning = refData.totalEarning || 0;
                                transaction.update(referrerRef2, {
                                    balance: Number((refBalance + bonusAmount).toFixed(2)),
                                    totalEarning: Number((refTotalEarning + bonusAmount).toFixed(2))
                                });
                            } catch (e) {
                                // fallback to addEarning if anything goes wrong
                                await addEarning(transaction, directReferrerId, bonusAmount, referrerDoc, earningRulesDoc);
                            }

                            // Credit referred user (include the deposited capital so we don't overwrite it later)
                            await addEarning(transaction, deposit.userId, bonusAmount, userDoc, earningRulesDoc, finalAmount);

                            // Log for referrer
                            const commissionLogRef = doc(collection(db, 'referralCommissions'));
                            transaction.set(commissionLogRef, {
                                referrerId: directReferrerId,
                                referredUserId: deposit.userId,
                                amount: bonusAmount,
                                type: 'referral_bonus',
                                percentage: bonusPercentage,
                                date: serverTimestamp(),
                                description: `Instant ${bonusPercentage}% referral bonus on completed deposit`
                            });

                            // Bonus transaction for referrer
                            const referrerBt = doc(collection(db, 'bonusTransactions'));
                            transaction.set(referrerBt, {
                                userId: directReferrerId,
                                amount: bonusAmount,
                                title: 'Referral Bonus Credited',
                                description: `Referral bonus for referral ${deposit.userId}`,
                                date: serverTimestamp(),
                                type: 'referralBonus'
                            });

                            // Log for referred user (separate record)
                            const referredLogRef = doc(collection(db, 'referralCommissions'));
                            transaction.set(referredLogRef, {
                                referrerId: directReferrerId,
                                referredUserId: deposit.userId,
                                amount: bonusAmount,
                                type: 'referral_bonus_referred',
                                percentage: bonusPercentage,
                                date: serverTimestamp(),
                                description: `Instant ${bonusPercentage}% bonus credited to referred user on their completed deposit`
                            });

                            // Bonus transaction for referred user
                            const referredBt = doc(collection(db, 'bonusTransactions'));
                            transaction.set(referredBt, {
                                userId: deposit.userId,
                                amount: bonusAmount,
                                title: 'Referral Bonus Received',
                                description: `Referral bonus from ${directReferrerId} for deposit ${deposit.id}`,
                                date: serverTimestamp(),
                                type: 'referralBonus'
                            });

                            // Notifications
                            if (notificationSettings.referralBonus) {
                                const notificationRef = doc(collection(db, "notifications"));
                                transaction.set(notificationRef, {
                                    userId: directReferrerId,
                                    title: "Referral bonus earned!",
                                    description: `You received ${formatCurrency(bonusAmount)} (${bonusPercentage}%) from your referral's deposit of ${formatCurrency(deposit.amount)}.`,
                                    isRead: false,
                                    createdAt: serverTimestamp(),
                                    link: '/dashboard/referral',
                                    type: 'referralBonus'
                                });

                                const notificationRef2 = doc(collection(db, "notifications"));
                                transaction.set(notificationRef2, {
                                    userId: deposit.userId,
                                    title: "Referral bonus received!",
                                    description: `You received ${formatCurrency(bonusAmount)} (${bonusPercentage}%) as a referral bonus on your deposit of ${formatCurrency(deposit.amount)}.`,
                                    isRead: false,
                                    createdAt: serverTimestamp(),
                                    link: '/dashboard/finance/history',
                                    type: 'referralBonus'
                                });
                            }
                        }
                            // Create a claimable refreshment bonus for the referrer (admin-configured amount)
                            try {
                                if (refreshmentEnabled && directReferrerId) {
                                    const refreshRef = doc(collection(db, 'refreshmentBonuses'));
                                    if (refreshmentAutoCredit) {
                                        // Auto-credit the refreshment bonus immediately
                                        transaction.set(refreshRef, {
                                            userId: directReferrerId,
                                            referredUserId: deposit.userId,
                                            amount: refreshmentAmount,
                                            currency: currency.symbol || '$',
                                            status: 'claimed',
                                            claimed: true,
                                            claimedAt: serverTimestamp(),
                                            createdAt: serverTimestamp(),
                                            description: `Auto-credited refreshment bonus for referring user ${deposit.userId}`
                                        });

                                        // Credit referrer balance and totalEarning directly to ensure full credit
                                        try {
                                            const referrerRef3 = doc(db, "users", directReferrerId);
                                            const refData2 = referrerDoc.data();
                                            const refBal2 = refData2.balance || 0;
                                            const refTotal2 = refData2.totalEarning || 0;
                                            transaction.update(referrerRef3, {
                                                balance: Number((refBal2 + refreshmentAmount).toFixed(2)),
                                                totalEarning: Number((refTotal2 + refreshmentAmount).toFixed(2))
                                            });
                                        } catch (e) {
                                            await addEarning(transaction, directReferrerId, refreshmentAmount, referrerDoc, earningRulesDoc);
                                        }

                                        // Log bonus transaction
                                        const bt = doc(collection(db, 'bonusTransactions'));
                                        transaction.set(bt, {
                                            userId: directReferrerId,
                                            amount: refreshmentAmount,
                                            title: 'Refreshment Bonus Credited',
                                            description: `Auto-credited refreshment bonus for referring ${deposit.userId}`,
                                            date: serverTimestamp(),
                                            type: 'refreshmentBonus'
                                        });

                                        // Notification
                                        if (notificationSettings.refreshmentBonus) {
                                            const nb = doc(collection(db, 'notifications'));
                                            transaction.set(nb, {
                                                userId: directReferrerId,
                                                title: 'Refreshment Bonus Credited',
                                                description: `${formatCurrency(refreshmentAmount)} refreshment bonus has been credited to your account for referring ${deposit.userId}.`,
                                                isRead: false,
                                                createdAt: serverTimestamp(),
                                                link: '/dashboard/finance/wallet',
                                                type: 'refreshmentBonus'
                                            });
                                        }
                                    } else {
                                        // Create claimable refreshment bonus
                                        transaction.set(refreshRef, {
                                            userId: directReferrerId,
                                            referredUserId: deposit.userId,
                                            amount: refreshmentAmount,
                                            currency: currency.symbol || '$',
                                            status: 'claimable',
                                            claimed: false,
                                            createdAt: serverTimestamp(),
                                            description: `Claimable refreshment bonus for referring user ${deposit.userId}`
                                        });

                                        if (notificationSettings.refreshmentBonus) {
                                            const nb = doc(collection(db, 'notifications'));
                                            transaction.set(nb, {
                                                userId: directReferrerId,
                                                title: 'Refreshment Bonus Available',
                                                description: `${formatCurrency(refreshmentAmount)} refreshment bonus is available to claim for referring ${deposit.userId}.`,
                                                isRead: false,
                                                createdAt: serverTimestamp(),
                                                link: '/dashboard/referral/refreshment',
                                                type: 'refreshmentBonus'
                                            });
                                        }
                                    }
                                }
                            } catch (e) {
                                console.warn('Failed to create refreshment bonus', e);
                            }
                    }

                        // Ensure deposit amount is credited if it wasn't credited above via addEarning
                        if (!(bonusAmount > 0 && directReferrerId && referrerDoc && referrerDoc.exists())) {
                            await addEarning(transaction, deposit.userId, 0, userDoc, earningRulesDoc, finalAmount);
                        }
                });

                                // After transaction success, ensure qualification is created if referred user reached the threshold
                                try {
                                    const { ensureQualificationForUser } = await import('@/lib/referralQualifications');
                                    // run async (do not block UI)
                                    ensureQualificationForUser(deposit.userId).catch(e => console.warn('Qualification check failed', e));
                                } catch (e) {
                                    console.warn('Qualification helper import failed', e);
                                }

                // Send notification AFTER the transaction is successful
                if (notificationSettings.depositApproved) {
                    await addDoc(collection(db, "notifications"), {
                        userId: deposit.userId,
                        title: "Deposit Approved",
                        description: `Your deposit of ${formatCurrency(deposit.amount)} has been approved and added to your wallet.`,
                        isRead: false,
                        createdAt: serverTimestamp(),
                        link: '/dashboard/finance/history',
                        type: 'depositApproved'
                    });
                }

                await ensureDailyPromoCode(deposit.userId);
            } else { // Rejected
                 const batch = writeBatch(db);
                 batch.update(depositRef, { status: 'rejected', rejectedAt: serverTimestamp() });
                 if (notificationSettings.depositRejected) {
                    const notificationRef = doc(collection(db, "notifications"));
                    batch.set(notificationRef, {
                        userId: deposit.userId,
                        title: "Deposit Rejected",
                        description: `Your deposit of ${formatCurrency(deposit.amount)} has been rejected. Please contact support for more information.`,
                        isRead: false,
                        createdAt: serverTimestamp(),
                        link: '/dashboard/finance/history',
                        type: 'depositRejected'
                    });
                }
                await batch.commit();
            }
            
            toast({ title: 'Success', description: `Deposit has been ${newStatus}.` });
            fetchDeposits();
        } catch (error: any) {
             toast({ variant: 'destructive', title: 'Error', description: `Failed to update deposit: ${error.message || error}` });
        } finally {
            setProcessingId(null);
        }
    }
    
    const handleDelete = async (depositId: string) => {
        if (!db) return;
        setProcessingId(depositId);
        try {
            await deleteDoc(doc(db, "deposits", depositId));
            toast({ title: "Success", description: "Deposit record has been deleted." });
            fetchDeposits();
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: `Failed to delete record: ${error.message}` });
        } finally {
            setProcessingId(null);
        }
    }

    const formatCurrency = (amount: number) => {
        const value = (amount || 0).toFixed(2);
        return currency.position === 'left' ? `${currency.symbol}${value}` : `${value}${currency.symbol}`;
    }

    const downloadCSV = () => {
        const data = deposits.map(d => {
            const details = Object.entries(d.details || {}).reduce((acc, [key, val]) => {
                acc[key] = val;
                return acc;
            }, {} as {[key: string]: string});

            return {
                'User': d.user?.email || d.userId,
                'Amount': formatCurrency(d.amount),
                'Method': `${d.method} ${d.network ? `(${d.network})` : ''}`,
                'Date': d.createdAt?.seconds ? format(new Date(d.createdAt.seconds * 1000), "PPp") : 'N/A',
                ...details
            }
        });
        const csv = Papa.unparse(data);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', 'pending_deposits.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const getBase64FromUrl = (url: string): Promise<string> => {
        return new Promise((resolve, reject) => {
            const img = new (window.Image as any)();
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

    const downloadPDF = async () => {
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
        pdfDoc.setTextColor(0,0,0);

        pdfDoc.setFontSize(12).setFont('helvetica', 'bold').text("Pending Deposits", 14, startY);
        autoTable(pdfDoc, {
            head: [['User', 'Amount', 'Method', 'Date', 'Details']],
            body: deposits.map(d => [
                d.user?.email || d.userId,
                formatCurrency(d.amount),
                `${d.method} ${d.network ? `(${d.network})` : ''}`,
                d.createdAt?.seconds ? format(new Date(d.createdAt.seconds * 1000), "PPp") : 'N/A',
                d.details ? Object.entries(d.details).map(([key, value]) => `${key.replace(/_/g, ' ')}: ${value}`).join('\n') : 'N/A'
            ]),
            startY: startY + 6,
        });
        pdfDoc.save('pending_deposits.pdf');
    };

  return (
    <AdminLayout>
      <div className="flex flex-col gap-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold font-headline tracking-tight">Pending Deposits</h1>
            <p className="text-muted-foreground">Review and process pending deposit requests.</p>
          </div>
           <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button><Download className="mr-2 h-4 w-4"/> Export</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                    <DropdownMenuItem onSelect={downloadCSV}>Download CSV</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => downloadPDF()}>Download PDF</DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
        <Card>
            <CardHeader>
                <CardTitle>Deposit Requests</CardTitle>
                <CardDescription>
                   Approve or reject deposit requests from users.
                </CardDescription>
            </CardHeader>
            <CardContent>
                 {loading ? (
                    <div className="flex justify-center items-center p-8">
                        <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                ) : deposits.length === 0 ? (
                    <p className="text-center text-muted-foreground p-8">No pending deposits.</p>
                ) : (
                    <div className="grid gap-6">
                        {deposits.map(deposit => (
                            <Card key={deposit.id} className="bg-muted/30">
                                <CardHeader>
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <CardTitle className="text-2xl">{formatCurrency(deposit.amount)}</CardTitle>
                                            <CardDescription>via {deposit.method} {deposit.network ? `(${deposit.network})` : ''}</CardDescription>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-semibold flex items-center gap-2"><User className="h-4 w-4" /> {deposit.user?.email || 'Unknown User'}</p>
                                            <p className="text-xs text-muted-foreground">UID: {deposit.userId}</p>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <h4 className="text-sm font-semibold mb-2">User Provided Details:</h4>
                                    <div className="text-sm bg-background p-3 rounded-md space-y-2">
                                       {deposit.details && Object.keys(deposit.details).length > 0 ? (
                                            Object.entries(deposit.details).map(([key, value]) => (
                                                <div key={key} className="grid grid-cols-3">
                                                    <span className="text-muted-foreground capitalize col-span-1">{key.replace(/_/g, ' ')}:</span>
                                                    {value.startsWith('data:image') ? (
                                                        <Dialog>
                                                            <DialogTrigger asChild>
                                                                <Button variant="outline" size="sm" className="w-fit"><FileImage className="mr-2 h-3 w-3"/> View Slip</Button>
                                                            </DialogTrigger>
                                                            <DialogContent className="max-w-2xl">
                                                                <DialogHeader>
                                                                    <DialogTitle>Deposit Slip</DialogTitle>
                                                                </DialogHeader>
                                                                <div className="my-4">
                                                                    <Image src={value} alt="Deposit slip" width={800} height={600} className="rounded-md object-contain" />
                                                                </div>
                                                            </DialogContent>
                                                        </Dialog>
                                                    ) : (
                                                        <span className="font-medium col-span-2 break-all">{value}</span>
                                                    )}
                                                </div>
                                            ))
                                       ) : (
                                           <p className="text-muted-foreground italic">No details provided by user.</p>
                                       )}
                                    </div>
                                </CardContent>
                                <CardFooter className="flex justify-between items-center bg-muted/50 p-4">
                                     <p className="text-xs text-muted-foreground">
                                        Requested on {format(new Date(deposit.createdAt.seconds * 1000), "PPpp")}
                                    </p>
                                    <div className="flex gap-2">
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button size="sm" variant="destructive" disabled={processingId === deposit.id}>
                                                    <Trash2 className="mr-2 h-4 w-4" /> Delete
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                    <AlertDialogDescription>This will permanently delete the deposit record. This action cannot be undone.</AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleDelete(deposit.id)}>Delete</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                        <Button size="sm" variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500/20 hover:text-red-500" onClick={() => handleAction(deposit, 'rejected')} disabled={processingId === deposit.id}>
                                            {processingId === deposit.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <X className="mr-2 h-4 w-4" />} Reject
                                        </Button>
                                        <Button size="sm" variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20 hover:bg-green-500/20 hover:text-green-500" onClick={() => handleAction(deposit, 'completed')} disabled={processingId === deposit.id}>
                                            {processingId === deposit.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Check className="mr-2 h-4 w-4" />} Approve
                                        </Button>
                                    </div>
                                </CardFooter>
                            </Card>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
