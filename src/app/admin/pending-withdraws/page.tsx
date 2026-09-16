
"use client";

import React, { useState, useEffect } from 'react';
import { AdminLayout } from "@/components/layout/admin-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, updateDoc, getDoc, writeBatch, deleteDoc, serverTimestamp, addDoc } from 'firebase/firestore';
import { Loader2, Check, X, User, Trash2, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import Papa from 'papaparse';


interface Withdrawal {
    id: string;
    userId: string;
    amount: number;
    fee?: number;
    withdrawalFeePercent?: number | null;
    finalAmount?: number;
    earlyPrincipalAmount?: number;
    earlyWithdrawalFee?: number;
    method: string;
    details: { [key: string]: string };
    status: string;
    createdAt: any;
    user?: { email: string, uid: string, balance: number };
}

const EARLY_WITHDRAWAL_DAYS = 60;
const EARLY_WITHDRAWAL_FEE_PERCENTAGE = 20;

interface CurrencySettings {
  symbol: string;
  position: 'left' | 'right';
}

interface NotificationSettings {
    [key: string]: boolean;
}

export default function AdminPendingWithdrawsPage() {
    const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [currency, setCurrency] = useState<CurrencySettings>({ symbol: '$', position: 'left' });
    const { toast } = useToast();
    const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({});
    const [logoUrl, setLogoUrl] = useState('');

    const fetchWithdrawals = async () => {
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

            const q = query(collection(db, "withdrawals"), where("status", "==", "pending"));
            const querySnapshot = await getDocs(q);
            const withdrawalsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Withdrawal[];

            const withdrawalsWithUsers = await Promise.all(withdrawalsData.map(async (withdrawal) => {
                const userDoc = await getDoc(doc(db, "users", withdrawal.userId));
                if (userDoc.exists()) {
                    return { ...withdrawal, user: userDoc.data() as { email: string, uid: string, balance: number } };
                }
                return withdrawal;
            }));

            setWithdrawals(withdrawalsWithUsers);
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error fetching withdrawals', description: error.message });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchWithdrawals();
    }, []);

    const calculateEarlyWithdrawalDeductions = async (userId: string, amount: number) => {
        const cutoffMs = Date.now() - EARLY_WITHDRAWAL_DAYS * 24 * 60 * 60 * 1000;

        const depositsSnapshot = await getDocs(query(collection(db, "deposits"), where("userId", "==", userId)));
        const recentCompletedDepositTotal = depositsSnapshot.docs.reduce((sum, depositDoc) => {
            const data = depositDoc.data();
            const status = String(data.status || "").toLowerCase();
            if (status !== "completed" && status !== "approved") return sum;

            const completedAt = data.completedAt?.seconds ? new Date(data.completedAt.seconds * 1000) : null;
            const createdAt = data.createdAt?.seconds ? new Date(data.createdAt.seconds * 1000) : null;
            const depositDate = completedAt || createdAt;
            if (!depositDate || depositDate.getTime() < cutoffMs) return sum;

            return sum + Number(data.amount || 0);
        }, 0);

        const earlyPrincipalAmount = Math.min(amount, recentCompletedDepositTotal);
        const earlyWithdrawalFee = Math.round(earlyPrincipalAmount * (EARLY_WITHDRAWAL_FEE_PERCENTAGE / 100) * 100) / 100;
        const clawbackRatio = recentCompletedDepositTotal > 0 ? earlyPrincipalAmount / recentCompletedDepositTotal : 0;

        const referralCommissionsSnapshot = await getDocs(query(collection(db, "referralCommissions"), where("referredUserId", "==", userId)));
        const commissionClawbacks = referralCommissionsSnapshot.docs
            .map((commissionDoc) => {
                const data = commissionDoc.data();
                const commissionDate = data.date?.seconds ? new Date(data.date.seconds * 1000) : null;
                const alreadyClawedBack = data.clawedBack === true;
                const amount = Number(data.amount || 0);

                if (alreadyClawedBack || amount <= 0 || !data.referrerId || !commissionDate || commissionDate.getTime() < cutoffMs) {
                    return null;
                }

                return {
                    ref: commissionDoc.ref,
                    referrerId: String(data.referrerId),
                    amount: Math.round(amount * clawbackRatio * 100) / 100,
                };
            })
            .filter((item): item is { ref: any; referrerId: string; amount: number } => Boolean(item && item.amount > 0));

        return {
            earlyPrincipalAmount,
            earlyWithdrawalFee,
            commissionClawbacks,
        };
    };

    const handleAction = async (withdrawalId: string, userId: string, amount: number, newStatus: 'completed' | 'rejected') => {
        if (!db) return;
        setProcessingId(withdrawalId);
        try {
            const batch = writeBatch(db);
            const withdrawalRef = doc(db, "withdrawals", withdrawalId);
            const withdrawalDoc = await getDoc(withdrawalRef);
            const withdrawalData = withdrawalDoc.data() as Withdrawal | undefined;
            batch.update(withdrawalRef, { status: newStatus });

            if (newStatus === 'rejected') {
                const userRef = doc(db, "users", userId);
                const userDoc = await getDoc(userRef);
                const currentBalance = userDoc.data()?.balance || 0;
                batch.update(userRef, { balance: currentBalance + amount });
            }

            let earlyWithdrawalFee = 0;
            let earlyPrincipalAmount = 0;
            let referralClawbackAmount = 0;

            if (newStatus === 'completed') {
                const deductions = await calculateEarlyWithdrawalDeductions(userId, amount);
                earlyWithdrawalFee = deductions.earlyWithdrawalFee;
                earlyPrincipalAmount = deductions.earlyPrincipalAmount;

                const referrerClawbacks = new Map<string, number>();
                deductions.commissionClawbacks.forEach((clawback) => {
                    referralClawbackAmount += clawback.amount;
                    referrerClawbacks.set(clawback.referrerId, (referrerClawbacks.get(clawback.referrerId) || 0) + clawback.amount);
                    batch.update(clawback.ref, {
                        clawedBack: true,
                        clawbackAmount: clawback.amount,
                        clawbackWithdrawalId: withdrawalId,
                        clawedBackAt: serverTimestamp(),
                    });
                });

                for (const [referrerId, clawbackAmount] of referrerClawbacks.entries()) {
                    const referrerRef = doc(db, "users", referrerId);
                    const referrerDoc = await getDoc(referrerRef);
                    if (!referrerDoc.exists()) continue;

                    const referrerData = referrerDoc.data();
                    batch.update(referrerRef, {
                        balance: Math.max(0, Number(referrerData.balance || 0) - clawbackAmount),
                        totalEarning: Math.max(0, Number(referrerData.totalEarning || 0) - clawbackAmount),
                    });

                    const notificationRef = doc(collection(db, "notifications"));
                    batch.set(notificationRef, {
                        userId: referrerId,
                        title: "Referral reward deducted",
                        description: `${formatCurrency(clawbackAmount)} was deducted because your referred user withdrew principal before ${EARLY_WITHDRAWAL_DAYS} days.`,
                        isRead: false,
                        createdAt: serverTimestamp(),
                        link: '/dashboard/referral',
                        type: 'referralClawback'
                    });
                }

                const requestFee = Number(withdrawalData?.fee || 0);
                const adjustedFinalAmount = Math.max(0, amount - Math.max(requestFee, earlyWithdrawalFee));

                batch.update(withdrawalRef, {
                    earlyPrincipalAmount,
                    earlyWithdrawalFee,
                    earlyWithdrawalFeePercentage: EARLY_WITHDRAWAL_FEE_PERCENTAGE,
                    referralClawbackAmount: Math.round(referralClawbackAmount * 100) / 100,
                    finalAmount: Math.round(adjustedFinalAmount * 100) / 100,
                    processedAt: serverTimestamp(),
                });
            }
            
            if (newStatus === 'completed' && notificationSettings.withdrawalApproved) {
                const notificationRef = doc(collection(db, "notifications"));
                batch.set(notificationRef, {
                    userId: userId,
                    title: "Withdrawal Approved",
                    description: earlyWithdrawalFee > 0
                        ? `Your withdrawal request for ${formatCurrency(amount)} has been approved. A ${EARLY_WITHDRAWAL_FEE_PERCENTAGE}% early principal withdrawal fee of ${formatCurrency(earlyWithdrawalFee)} was charged.`
                        : `Your withdrawal request for ${formatCurrency(amount)} has been approved and processed.`,
                    isRead: false,
                    createdAt: serverTimestamp(),
                    link: '/dashboard/finance/history',
                    type: 'withdrawalApproved'
                });
            } else if (newStatus === 'rejected' && notificationSettings.withdrawalRejected) {
                 const notificationRef = doc(collection(db, "notifications"));
                batch.set(notificationRef, {
                    userId: userId,
                    title: "Withdrawal Rejected",
                    description: `Your withdrawal request for ${formatCurrency(amount)} has been rejected. The amount has been refunded to your wallet.`,
                    isRead: false,
                    createdAt: serverTimestamp(),
                    link: '/dashboard/finance/history',
                    type: 'withdrawalRejected'
                });
            }

            await batch.commit();

            // After commit, check whether this withdrawal revokes any referral qualifications
            try {
                const { revokeQualificationIfNeeded } = await import('@/lib/referralQualifications');
                revokeQualificationIfNeeded(userId, withdrawalId).catch(e => console.warn('Referral revocation failed', e));
            } catch (e) {
                console.warn('Failed to import revocation helper', e);
            }

            toast({ title: 'Success', description: `Withdrawal has been ${newStatus}.` });
            fetchWithdrawals(); // Refresh list
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: `Failed to update withdrawal: ${error.message}` });
        } finally {
            setProcessingId(null);
        }
    };
    
    const handleDelete = async (withdrawalId: string, userId: string, amount: number) => {
        if (!db) return;
        setProcessingId(withdrawalId);
        try {
            const batch = writeBatch(db);
            const withdrawalRef = doc(db, "withdrawals", withdrawalId);
            batch.delete(withdrawalRef);
            
            // Refund the user's balance since the pending request is being deleted
            const userRef = doc(db, "users", userId);
            const userDoc = await getDoc(userRef);
            const currentBalance = userDoc.data()?.balance || 0;
            batch.update(userRef, { balance: currentBalance + amount });

            await batch.commit();
            toast({ title: "Success", description: "Withdrawal record has been deleted and funds returned to user." });
            fetchWithdrawals();
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: `Failed to delete record: ${error.message}` });
        } finally {
            setProcessingId(null);
        }
    }

    const formatCurrency = (amount: number) => {
        const value = amount.toFixed(2);
        return currency.position === 'left' ? `${currency.symbol}${value}` : `${value}${currency.symbol}`;
    }

    const getEstimatedEarlyWithdrawalFee = (withdrawal: Withdrawal) => {
        return Number(withdrawal.earlyWithdrawalFee || 0);
    };

    const getAmountAfterWithdrawalFee = (withdrawal: Withdrawal) => {
        if (withdrawal.finalAmount !== undefined) return Number(withdrawal.finalAmount || 0);
        return Math.max(0, Number(withdrawal.amount || 0) - Number(withdrawal.fee || 0));
    };

    const downloadCSV = () => {
        const data = withdrawals.map(w => ({
            'User': w.user?.email || w.userId,
            'Amount': formatCurrency(w.amount),
            'Method': w.method,
            'Fee': w.fee !== undefined ? formatCurrency(Number(w.fee)) : 'N/A',
            'Fee %': w.withdrawalFeePercent !== undefined && w.withdrawalFeePercent !== null ? `${w.withdrawalFeePercent}%` : 'Default',
            'Date': w.createdAt?.seconds ? format(new Date(w.createdAt.seconds * 1000), "PPp") : 'N/A',
            ...w.details,
        }));
        const csv = Papa.unparse(data);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', 'pending_withdrawals.csv');
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

        pdfDoc.setFontSize(12).setFont('helvetica', 'bold').text("Pending Withdrawals", 14, startY);
        const bodyData = withdrawals.map(w => [
            w.user?.email || w.userId,
            formatCurrency(w.amount),
            w.fee !== undefined ? formatCurrency(Number(w.fee)) : 'N/A',
            w.withdrawalFeePercent !== undefined && w.withdrawalFeePercent !== null ? `${w.withdrawalFeePercent}%` : 'Default',
            w.method,
            w.createdAt?.seconds ? format(new Date(w.createdAt.seconds * 1000), "PPp") : 'N/A',
            Object.entries(w.details).map(([key, value]) => `${key}: ${value}`).join('\n')
        ]);
        autoTable(pdfDoc, {
            head: [['User', 'Amount', 'Fee', 'Fee %', 'Method', 'Date', 'Details']],
            body: bodyData,
            startY: startY + 6,
        });
        pdfDoc.save('pending_withdrawals.pdf');
    };

  return (
    <AdminLayout>
      <div className="flex flex-col gap-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold font-headline tracking-tight">Pending Withdrawals</h1>
            <p className="text-muted-foreground">Review and process pending withdrawal requests.</p>
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
                <CardTitle>Withdrawal Requests</CardTitle>
                <CardDescription>
                   Approve or reject withdrawal requests from users.
                </CardDescription>
            </CardHeader>
            <CardContent>
                 {loading ? (
                    <div className="flex justify-center items-center p-8">
                        <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                ) : withdrawals.length === 0 ? (
                    <p className="text-center text-muted-foreground p-8">No pending withdrawals.</p>
                ) : (
                    <div className="grid gap-6">
                        {withdrawals.map(w => (
                            <Card key={w.id} className="bg-muted/30">
                                <CardHeader>
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <CardTitle className="text-2xl">{formatCurrency(w.amount)}</CardTitle>
                                            <CardDescription>via {w.method}</CardDescription>
                                            <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                                                <p>Regular Fee: {formatCurrency(Number(w.fee || 0))}</p>
                                                <p>Fee %: {w.withdrawalFeePercent !== undefined && w.withdrawalFeePercent !== null ? `${w.withdrawalFeePercent}%` : 'Default'}</p>
                                                <p className="text-sm font-semibold text-green-600">User Receives After Fee: {formatCurrency(getAmountAfterWithdrawalFee(w))}</p>
                                                <p>Early Rule: 30% fee applies to principal withdrawn before 60 days.</p>
                                                {getEstimatedEarlyWithdrawalFee(w) > 0 && (
                                                    <p>Early Withdrawal Fee: {formatCurrency(getEstimatedEarlyWithdrawalFee(w))}</p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-semibold flex items-center gap-2"><User className="h-4 w-4" /> {w.user?.email || 'Unknown User'}</p>
                                            <p className="text-xs text-muted-foreground">UID: {w.userId}</p>
                                            <p className="text-xs text-muted-foreground">Current Balance: {w.user?.balance ? formatCurrency(w.user.balance) : 'N/A'}</p>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <h4 className="text-sm font-semibold mb-2">User Provided Withdrawal Details:</h4>
                                    <div className="text-sm bg-background p-3 rounded-md space-y-2">
                                       {typeof w.details === 'object' && w.details !== null ? (
                                            Object.entries(w.details).map(([key, value]) => (
                                                <div key={key} className="grid grid-cols-3">
                                                    <span className="text-muted-foreground capitalize col-span-1">{key.replace(/_/g, ' ')}:</span>
                                                    <span className="font-medium col-span-2">{value}</span>
                                                </div>
                                            ))
                                       ) : (
                                           <p>{String(w.details)}</p>
                                       )}
                                    </div>
                                </CardContent>
                                <CardFooter className="flex justify-between items-center bg-muted/50 p-4">
                                    <p className="text-xs text-muted-foreground">
                                        Requested on {format(new Date(w.createdAt.seconds * 1000), "PPpp")}
                                    </p>
                                    <div className="flex gap-2">
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button size="sm" variant="destructive" disabled={processingId === w.id}>
                                                    <Trash2 className="mr-2 h-4 w-4" /> Delete
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                    <AlertDialogDescription>This will permanently delete the withdrawal record and refund the requested amount to the user's balance. This action cannot be undone.</AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleDelete(w.id, w.userId, w.amount)}>Delete & Refund</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                        <Button size="sm" variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500/20 hover:text-red-500" onClick={() => handleAction(w.id, w.userId, w.amount, 'rejected')}>
                                            <X className="mr-2 h-4 w-4" /> Reject
                                        </Button>
                                        <Button size="sm" variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20 hover:bg-green-500/20 hover:text-green-500" onClick={() => handleAction(w.id, w.userId, w.amount, 'completed')}>
                                            <Check className="mr-2 h-4 w-4" /> Approve
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
