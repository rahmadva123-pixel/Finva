
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useToast } from "@/hooks/use-toast";
import { AdminLayout } from "@/components/layout/admin-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from '@/lib/firebase';
import {
  collection,
  query,
  getDocs,
  doc,
  getDoc,
  orderBy,
  deleteDoc,
  updateDoc,
  runTransaction
} from "firebase/firestore";
import { Loader2, CheckCircle, Clock, XCircle, User, FileImage, Phone, Calendar, Globe, Wallet, Trash2, Download } from 'lucide-react';
import { format } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from "@/components/ui/button";
import Image from 'next/image';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import Papa from 'papaparse';


interface Deposit {
    id: string;
    userId: string;
    amount: number;
    method: string;
    status: 'pending' | 'completed' | 'rejected';
    createdAt: any;
    phone?: string;
    proof?: string;
    user?: UserData;
}

interface UserData {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  country?: string;
  createdAt?: any;
  balance?: number;
}

interface CurrencySettings {
  symbol: string;
  position: 'left' | 'right';
}

export default function AdminDepositHistoryPage() {
    const [deposits, setDeposits] = useState<Deposit[]>([]);
    const [loading, setLoading] = useState(true);
    const [currency, setCurrency] = useState<CurrencySettings>({ symbol: '$', position: 'left' });
    const { toast } = useToast();

    const handleApprove = async (depositId: string, userId: string) => {
        if (!db) return;

        try {
            const userRef = doc(db, "users", userId);
            const depositRef = doc(db, "deposits", depositId);

            await runTransaction(db, async (transaction) => {
                const userDoc = await transaction.get(userRef);
                const depositDoc = await transaction.get(depositRef);

                if (!userDoc.exists()) throw new Error("User not found");
                if (!depositDoc.exists()) throw new Error("Deposit not found");

                const userData = userDoc.data();
                const depositData = depositDoc.data();

                if (depositData.status === "completed") {
                    throw new Error("Already approved");
                }

                const currentBalance = Number(userData.balance) || 0;
                const amount = Number(depositData.amount) || 0;
                const newBalance = currentBalance + amount;

                transaction.update(userRef, { balance: newBalance });
                transaction.update(depositRef, { status: "completed" });
            });

            toast({ title: "Success", description: "Deposit approved" });
            fetchHistory();
        } catch (error: any) {
            toast({
                variant: "destructive",
                title: "Error",
                description: `Failed: ${error.message}`
            });
        }
    };

    const fetchHistory = async () => {
        if (!db) {
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const currencyDoc = await getDoc(doc(db, "settings", "currency"));
            if (currencyDoc.exists()) {
              setCurrency(currencyDoc.data() as CurrencySettings);
            }

            const usersSnapshot = await getDocs(collection(db, 'users'));
            const usersMap = new Map<string, UserData>();
            usersSnapshot.forEach(doc => {
                usersMap.set(doc.id.toLowerCase(), { id: doc.id, ...doc.data() } as UserData);
            });

            const q = query(collection(db, "deposits"), orderBy("createdAt", "desc"));
            const querySnapshot = await getDocs(q);
            const depositsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Deposit[];

            const depositsWithUsers = depositsData.map(deposit => {
                const user = usersMap.get(deposit.userId.toLowerCase());
                return { ...deposit, user };
            });

            setDeposits(depositsWithUsers);
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
        return deposits.reduce((acc, deposit) => {
            if (deposit.status === 'pending') {
                acc.pendingAmount += deposit.amount;
            } else if (deposit.status === 'completed') {
                acc.completedAmount += deposit.amount;
            } else if (deposit.status === 'rejected') {
                acc.rejectedAmount += deposit.amount;
            }
            return acc;
        }, { pendingAmount: 0, completedAmount: 0, rejectedAmount: 0 });
    }, [deposits]);

    const handleDelete = async (depositId: string) => {
        if (!db) return;
        try {
            await deleteDoc(doc(db, "deposits", depositId));
            toast({ title: "Success", description: "Deposit record has been deleted." });
            fetchHistory();
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: `Failed to delete record: ${error.message}` });
        }
    }

    const getStatusProps = (status: Deposit['status']) => {
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
        const value = amount?.toFixed(2) || '0.00';
        return currency.position === 'left' ? `${currency.symbol}${value}` : `${value}${currency.symbol}`;
    }

    const downloadCSV = () => {
        const data = deposits.map(d => ({
            'User': d.user?.email || d.userId,
            'Amount': formatCurrency(d.amount),
            'Method': d.method,
            'Date': d.createdAt?.seconds ? format(new Date(d.createdAt.seconds * 1000), "PPp") : 'N/A',
            'Status': d.status,
        }));
        const csv = Papa.unparse(data);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', 'deposit_history.csv');
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
    
        pdfDoc.setFontSize(12).setFont('helvetica', 'bold').text("Deposit History", 14, startY);
        autoTable(pdfDoc, {
            head: [['User', 'Amount', 'Method', 'Date', 'Status']],
            body: deposits.map(d => [
                d.user?.email || d.userId,
                formatCurrency(d.amount),
                d.method,
                d.createdAt?.seconds ? format(new Date(d.createdAt.seconds * 1000), "PPp") : 'N/A',
                d.status,
            ]),
            startY: startY + 6,
        });
        pdfDoc.save('deposit_history.pdf');
    };

  return (
    <AdminLayout>
      <div className="flex flex-col gap-8">
        <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold font-headline tracking-tight">Deposit History</h1>
              <p className="text-muted-foreground">View a complete history of all deposits.</p>
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
                    <CardTitle className="text-sm font-medium">Pending Deposits</CardTitle>
                    <Clock className="h-4 w-4 text-muted-foreground"/>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(pendingAmount)}</div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Completed Deposits</CardTitle>
                    <CheckCircle className="h-4 w-4 text-muted-foreground"/>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(completedAmount)}</div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Rejected Deposits</CardTitle>
                    <XCircle className="h-4 w-4 text-muted-foreground"/>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(rejectedAmount)}</div>
                </CardContent>
            </Card>
        </div>

         <Card>
            <CardHeader>
                <CardTitle>All Deposits</CardTitle>
                <CardDescription>
                   A log of every deposit made on the platform.
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
                                <TableHead>Method</TableHead>
                                <TableHead>Details</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {deposits.map(deposit => {
                                const statusProps = getStatusProps(deposit.status);
                                return (
                                <TableRow key={deposit.id}>
                                    <TableCell className="font-medium">
                                        {deposit.user ? (
                                            <Dialog>
                                                <DialogTrigger asChild>
                                                    <Button variant="link" className="p-0 h-auto font-semibold">
                                                        {deposit.user.firstName || deposit.user.lastName ? `${deposit.user.firstName} ${deposit.user.lastName}` : (deposit.user.username || 'Unnamed User')}
                                                    </Button>
                                                </DialogTrigger>
                                                <DialogContent>
                                                    <DialogHeader>
                                                        <DialogTitle>User Details</DialogTitle>
                                                    </DialogHeader>
                                                    <div className="space-y-4 py-4">
                                                        <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                                                            <div className="flex items-center gap-2 text-muted-foreground"><Wallet />Current Balance</div>
                                                            <div className="font-bold text-lg">{formatCurrency(deposit.user.balance || 0)}</div>
                                                        </div>
                                                        <p><span className="font-semibold">Email:</span> {deposit.user.email}</p>
                                                        <p><span className="font-semibold">Username:</span> {deposit.user.username || 'N/A'}</p>
                                                        <p><span className="font-semibold">Country:</span> {deposit.user.country || 'N/A'}</p>
                                                        <p><span className="font-semibold">Joined:</span> {deposit.user.createdAt ? format(deposit.user.createdAt.toDate(), 'PPp') : 'N/A'}</p>
                                                    </div>
                                                </DialogContent>
                                            </Dialog>
                                        ) : (
                                            <span>Unknown User</span>
                                        )}
                                    </TableCell>
                                    <TableCell>{formatCurrency(deposit.amount)}</TableCell>
                                    <TableCell>{deposit.method}</TableCell>
                                    <TableCell>
                                        {deposit.phone && <p className="text-xs flex items-center gap-1"><Phone className="h-3 w-3"/> {deposit.phone}</p>}
                                        {deposit.proof && (
                                            <Dialog>
                                                <DialogTrigger asChild>
                                                    <Button variant="outline" size="sm" className="mt-1">
                                                        <FileImage className="mr-2 h-3 w-3"/> View Slip
                                                    </Button>
                                                </DialogTrigger>
                                                <DialogContent className="max-w-2xl">
                                                    <DialogHeader>
                                                        <DialogTitle>Deposit Slip</DialogTitle>
                                                    </DialogHeader>
                                                    <div className="my-4">
                                                        <Image src={deposit.proof} alt="Deposit slip" width={800} height={600} className="rounded-md object-contain" />
                                                    </div>
                                                </DialogContent>
                                            </Dialog>
                                        )}
                                    </TableCell>
                                    <TableCell>{deposit.createdAt?.seconds ? format(new Date(deposit.createdAt.seconds * 1000), "PPp") : 'N/A'}</TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={`capitalize ${statusProps.color} flex items-center justify-center gap-2`}>
                                            {statusProps.icon}
                                            {deposit.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right flex gap-2 justify-end">
                                        {deposit.status === 'pending' && (
                                            <Button variant="default" size="sm" onClick={() => handleApprove(deposit.id, deposit.userId)}>
                                                <CheckCircle className="h-4 w-4 mr-1"/> Approve
                                            </Button>
                                        )}
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                    <AlertDialogDescription>This will permanently delete this deposit record. This action cannot be undone.</AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleDelete(deposit.id)}>Delete</AlertDialogAction>
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
