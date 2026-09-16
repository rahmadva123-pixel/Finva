
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { AdminLayout } from "@/components/layout/admin-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from '@/lib/firebase';
import { collection, query, getDocs, doc, getDoc, orderBy, deleteDoc } from 'firebase/firestore';
import { Loader2, CheckCircle, Clock, XCircle, User, Trash2, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import Papa from 'papaparse';


interface Withdrawal {
    id: string;
    userId: string;
    amount: number;
        fee?: number;
        withdrawalFeePercent?: number | null;
    method: string;
    status: 'pending' | 'completed' | 'rejected';
    createdAt: any;
    user?: { email: string };
    details?: { [key: string]: string };
}

interface UserData {
  id: string;
  email: string;
}

interface CurrencySettings {
  symbol: string;
  position: 'left' | 'right';
}

export default function AdminWithdrawHistoryPage() {
    const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
    const [loading, setLoading] = useState(true);
    const [currency, setCurrency] = useState<CurrencySettings>({ symbol: '$', position: 'left' });
    const { toast } = useToast();
    const [logoUrl, setLogoUrl] = useState('');

    const fetchHistory = async () => {
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

            const usersSnapshot = await getDocs(collection(db, 'users'));
            const usersMap = new Map<string, UserData>();
            usersSnapshot.forEach(doc => {
                usersMap.set(doc.id, { id: doc.id, ...doc.data() } as UserData);
            });

            const q = query(collection(db, "withdrawals"), orderBy("createdAt", "desc"));
            const querySnapshot = await getDocs(q);
            const withdrawalsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Withdrawal[];

            const withdrawalsWithUsers = withdrawalsData.map(w => {
                const user = usersMap.get(w.userId);
                return { ...w, user: user ? { email: user.email } : { email: 'Unknown User' } };
            });

            setWithdrawals(withdrawalsWithUsers);
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error fetching history', description: error.message });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchHistory();
    }, [toast]);
    
     const { pendingAmount, completedAmount, rejectedAmount } = useMemo(() => {
        return withdrawals.reduce((acc, w) => {
            if (w.status === 'pending') {
                acc.pendingAmount += w.amount;
            } else if (w.status === 'completed') {
                acc.completedAmount += w.amount;
            } else if (w.status === 'rejected') {
                acc.rejectedAmount += w.amount;
            }
            return acc;
        }, { pendingAmount: 0, completedAmount: 0, rejectedAmount: 0 });
    }, [withdrawals]);

    const handleDelete = async (withdrawalId: string) => {
        if (!db) return;
        try {
            await deleteDoc(doc(db, "withdrawals", withdrawalId));
            toast({ title: "Success", description: "Withdrawal record has been deleted." });
            fetchHistory();
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: `Failed to delete record: ${error.message}` });
        }
    }

    const getStatusProps = (status: Withdrawal['status']) => {
        switch (status) {
          case 'pending':
            return { icon: <Clock className="h-4 w-4 text-yellow-500" />, color: 'text-yellow-500 border-yellow-500/50 bg-yellow-500/10' };
          case 'completed':
            return { icon: <CheckCircle className="h-4 w-4 text-green-500" />, color: 'text-green-500 border-green-500/50 bg-green-500/10' };
          case 'rejected':
            return { icon: <XCircle className="h-4 w-4 text-red-500" />, color: 'text-red-500 border-red-500/50 bg-red-500/10' };
          default:
            return { icon: <Clock className="h-4 w-4" />, color: '' };
        }
    };
    
    const formatCurrency = (amount: number) => {
        const value = amount.toFixed(2);
        return currency.position === 'left' ? `${currency.symbol}${value}` : `${value}${currency.symbol}`;
    }

    const downloadCSV = () => {
        const data = withdrawals.map(w => ({
            'User': w.user?.email || w.userId,
            'Amount': formatCurrency(w.amount),
            'Fee': w.fee !== undefined ? formatCurrency(Number(w.fee)) : 'N/A',
            'Fee %': w.withdrawalFeePercent !== undefined && w.withdrawalFeePercent !== null ? `${w.withdrawalFeePercent}%` : 'Default (20%)',
            'Method': w.method,
            'Date': w.createdAt?.seconds ? format(new Date(w.createdAt.seconds * 1000), "PPp") : 'N/A',
            'Status': w.status,
            ...w.details
        }));
        const csv = Papa.unparse(data);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', 'withdrawal_history.csv');
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
        
        pdfDoc.setFontSize(12).setFont('helvetica', 'bold').text("Withdrawal History", 14, startY);
        autoTable(pdfDoc, {
            head: [['User', 'Amount', 'Fee', 'Fee %', 'Method', 'Date', 'Status', 'Details']],
            body: withdrawals.map(w => [
                w.user?.email || w.userId,
                formatCurrency(w.amount),
                w.fee !== undefined ? formatCurrency(Number(w.fee)) : 'N/A',
                w.withdrawalFeePercent !== undefined && w.withdrawalFeePercent !== null ? `${w.withdrawalFeePercent}%` : 'Default (20%)',
                w.method,
                w.createdAt?.seconds ? format(new Date(w.createdAt.seconds * 1000), "PPp") : 'N/A',
                w.status,
                w.details ? Object.entries(w.details).map(([key, value]) => `${key.replace(/_/g, ' ')}: ${value}`).join('\n') : 'N/A'
            ]),
            startY: startY + 6,
        });
        pdfDoc.save('withdrawal_history.pdf');
    };

  return (
    <AdminLayout>
      <div className="flex flex-col gap-8">
        <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold font-headline tracking-tight">Withdrawal History</h1>
              <p className="text-muted-foreground">View a complete history of all withdrawals.</p>
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
         <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Pending Withdrawals</CardTitle>
                    <Clock className="h-4 w-4 text-muted-foreground"/>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(pendingAmount)}</div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Completed Withdrawals</CardTitle>
                    <CheckCircle className="h-4 w-4 text-muted-foreground"/>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(completedAmount)}</div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Rejected Withdrawals</CardTitle>
                    <XCircle className="h-4 w-4 text-muted-foreground"/>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(rejectedAmount)}</div>
                </CardContent>
            </Card>
        </div>
        <Card>
            <CardHeader>
                <CardTitle>All Withdrawals</CardTitle>
                <CardDescription>
                   A log of every withdrawal made on the platform.
                </CardDescription>
            </CardHeader>
            <CardContent>
                 {loading ? (
                    <div className="flex justify-center items-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
                 ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>User</TableHead>
                                <TableHead>Amount</TableHead>
                                <TableHead>Fee</TableHead>
                                <TableHead>Fee %</TableHead>
                                <TableHead>Method</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Details</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {withdrawals.map(w => {
                                const statusProps = getStatusProps(w.status);
                                return (
                                <TableRow key={w.id}>
                                    <TableCell className="font-medium">{w.user?.email}</TableCell>
                                    <TableCell>{formatCurrency(w.amount)}</TableCell>
                                    <TableCell>{w.fee !== undefined ? formatCurrency(Number(w.fee)) : 'N/A'}</TableCell>
                                    <TableCell>{w.withdrawalFeePercent !== undefined && w.withdrawalFeePercent !== null ? `${w.withdrawalFeePercent}%` : 'Default'}</TableCell>
                                    <TableCell>{w.method}</TableCell>
                                    <TableCell>{w.createdAt?.seconds ? format(new Date(w.createdAt.seconds * 1000), "PPp") : 'N/A'}</TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={`capitalize ${statusProps.color} flex items-center justify-center gap-2`}>
                                            {statusProps.icon}
                                            {w.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        {w.details ? (
                                            <Dialog>
                                                <DialogTrigger asChild>
                                                    <Button variant="outline" size="sm">View</Button>
                                                </DialogTrigger>
                                                <DialogContent>
                                                    <DialogHeader>
                                                        <DialogTitle>Withdrawal Details</DialogTitle>
                                                    </DialogHeader>
                                                    <div className="text-sm bg-muted p-4 rounded-md space-y-2">
                                                    {typeof w.details === 'object' && w.details !== null ? (
                                                            Object.entries(w.details).map(([key, value]) => (
                                                                <div key={key} className="grid grid-cols-3 gap-2">
                                                                    <span className="text-muted-foreground capitalize col-span-1">{key.replace(/_/g, ' ')}:</span>
                                                                    <span className="font-medium col-span-2 break-all">{value}</span>
                                                                </div>
                                                            ))
                                                    ) : (
                                                        <p>{String(w.details)}</p>
                                                    )}
                                                    </div>
                                                </DialogContent>
                                            </Dialog>
                                        ) : (
                                            <span className="text-muted-foreground text-xs">N/A</span>
                                        )}
                                    </TableCell>
                                     <TableCell className="text-right">
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                    <AlertDialogDescription>This will permanently delete this withdrawal record. This action does not affect user balance and cannot be undone.</AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleDelete(w.id)}>Delete</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </TableCell>
                                </TableRow>
                            )})}
                        </TableBody>
                    </Table>
                 )}
            </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
