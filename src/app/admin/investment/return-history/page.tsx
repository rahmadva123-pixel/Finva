
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { AdminLayout } from "@/components/layout/admin-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from '@/lib/firebase';
import { collection, query, getDocs, doc, getDoc, orderBy, runTransaction, updateDoc, deleteDoc } from 'firebase/firestore';
import { Loader2, Trash2, XCircle, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';


interface InvestmentReturn {
    id: string;
    userId: string;
    userEmail?: string;
    planName: string;
    amount: number;
    type: 'Profit Return (Auto)' | 'Profit Return (Manual)' | 'Capital Back (Auto)' | 'Capital Back (Manual)' | string;
    date: any;
    status?: 'completed' | 'rejected';
}

interface CurrencySettings {
  symbol: string;
  position: 'left' | 'right';
}

export default function AdminReturnHistoryPage() {
    const [completedReturns, setCompletedReturns] = useState<InvestmentReturn[]>([]);
    const [rejectedReturns, setRejectedReturns] = useState<InvestmentReturn[]>([]);
    const [loading, setLoading] = useState(true);
    const [currency, setCurrency] = useState<CurrencySettings>({ symbol: '$', position: 'left' });
    const { toast } = useToast();

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

            const q = query(collection(db, "investmentTransactions"), orderBy("date", "desc"));
            const querySnapshot = await getDocs(q);
            const returnsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InvestmentReturn));

            const returnsWithUsers = await Promise.all(returnsData.map(async (r) => {
                const userDoc = await getDoc(doc(db, "users", r.userId));
                return { ...r, userEmail: userDoc.exists() ? userDoc.data().email : 'Unknown User' };
            }));

            setCompletedReturns(returnsWithUsers.filter(r => r.status !== 'rejected'));
            setRejectedReturns(returnsWithUsers.filter(r => r.status === 'rejected'));

        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error fetching history', description: error.message });
        } finally {
            setLoading(false);
        }
    };
    
    useEffect(() => {
        fetchHistory();
    }, [toast]);
    
    const formatCurrency = (amount: number) => {
        const value = amount.toFixed(2);
        return currency.position === 'left' ? `${currency.symbol}${value}` : `${value}${currency.symbol}`;
    }
    
    const handleRejectReturn = async (item: InvestmentReturn) => {
        if(!db) return;
        try {
            await runTransaction(db, async (transaction) => {
                const userRef = doc(db, 'users', item.userId);
                const userDoc = await transaction.get(userRef);

                if(!userDoc.exists()) throw new Error("User not found.");

                const currentBalance = userDoc.data().balance || 0;
                transaction.update(userRef, { balance: currentBalance - item.amount });

                const returnRef = doc(db, 'investmentTransactions', item.id);
                transaction.update(returnRef, { status: 'rejected' });
            });
             toast({ title: 'Success', description: 'Return has been rejected and amount deducted from user balance.' });
             fetchHistory();
        } catch (error: any) {
             toast({ variant: 'destructive', title: 'Error', description: `Failed to reject return: ${error.message}` });
        }
    }
    
    const handleApproveReturn = async (item: InvestmentReturn) => {
        if(!db) return;
        try {
            await runTransaction(db, async (transaction) => {
                const userRef = doc(db, 'users', item.userId);
                const userDoc = await transaction.get(userRef);

                if(!userDoc.exists()) throw new Error("User not found.");

                const currentBalance = userDoc.data().balance || 0;
                transaction.update(userRef, { balance: currentBalance + item.amount });

                const returnRef = doc(db, 'investmentTransactions', item.id);
                transaction.update(returnRef, { status: 'completed' });
            });
             toast({ title: 'Success', description: 'Return has been re-approved and amount added back to user balance.' });
             fetchHistory();
        } catch (error: any) {
             toast({ variant: 'destructive', title: 'Error', description: `Failed to approve return: ${error.message}` });
        }
    }

    const handleDeleteReturn = async (id: string) => {
        if(!db) return;
        try {
            await deleteDoc(doc(db, 'investmentTransactions', id));
            toast({ title: 'Success', description: 'Return record has been deleted.' });
            fetchHistory();
        } catch (error: any) {
             toast({ variant: 'destructive', title: 'Error', description: `Failed to delete record: ${error.message}` });
        }
    }

    const { totalCompleted, totalRejected } = useMemo(() => {
        return {
            totalCompleted: completedReturns.reduce((sum, item) => sum + item.amount, 0),
            totalRejected: rejectedReturns.reduce((sum, item) => sum + item.amount, 0),
        }
    }, [completedReturns, rejectedReturns]);

    const renderTable = (data: InvestmentReturn[], isCompletedTable: boolean) => (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {data.map(r => (
                    <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.userEmail}</TableCell>
                        <TableCell>{r.planName}</TableCell>
                        <TableCell><Badge variant="secondary">{r.type}</Badge></TableCell>
                        <TableCell>{formatCurrency(r.amount)}</TableCell>
                        <TableCell>{format(new Date(r.date.seconds * 1000), "PPp")}</TableCell>
                         <TableCell>
                            <Badge variant={r.status === 'rejected' ? 'destructive' : 'default'}>
                                {r.status === 'rejected' ? 'Rejected' : 'Completed'}
                            </Badge>
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                            {isCompletedTable ? (
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="outline" size="sm" className="text-destructive border-destructive/50 hover:bg-destructive/10 hover:text-destructive"><XCircle className="mr-2 h-4 w-4"/> Reject</Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                            <AlertDialogDescription>This will deduct {formatCurrency(r.amount)} from {r.userEmail}'s balance and mark this return as rejected. This action can be reversed.</AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => handleRejectReturn(r)}>Yes, Reject</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            ) : (
                                 <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="outline" size="sm" className="text-green-500 border-green-500/50 hover:bg-green-500/10 hover:text-green-500"><CheckCircle className="mr-2 h-4 w-4"/> Re-Approve</Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                            <AlertDialogDescription>This will add {formatCurrency(r.amount)} back to {r.userEmail}'s balance and mark this return as completed again.</AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => handleApproveReturn(r)}>Yes, Re-Approve</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            )}
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4"/></Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                     <AlertDialogHeader>
                                        <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This will only delete the historical record. It will not affect the user's balance. This action cannot be undone. Are you sure you want to proceed?
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleDeleteReturn(r.id)}>Delete Record</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );

  return (
    <AdminLayout>
      <div className="flex flex-col gap-8">
        <div>
          <h1 className="text-3xl font-bold font-headline tracking-tight">Return History</h1>
          <p className="text-muted-foreground">View a complete history of all investment returns.</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Total Completed Returns</CardTitle>
                    <CheckCircle className="h-4 w-4 text-green-500"/>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(totalCompleted)}</div>
                </CardContent>
            </Card>
             <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Total Rejected Returns</CardTitle>
                    <XCircle className="h-4 w-4 text-red-500"/>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(totalRejected)}</div>
                </CardContent>
            </Card>
        </div>

        <Tabs defaultValue="completed">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="completed">Completed Returns</TabsTrigger>
                <TabsTrigger value="rejected">Rejected Returns</TabsTrigger>
            </TabsList>
            <TabsContent value="completed">
                <Card>
                    <CardHeader>
                        <CardTitle>Completed Investment Returns</CardTitle>
                        <CardDescription>
                           A log of all successfully paid investment returns.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                         {loading ? (
                            <div className="flex justify-center items-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
                         ) : completedReturns.length > 0 ? (
                            renderTable(completedReturns, true)
                         ) : (
                            <p className="text-center text-muted-foreground p-8">No completed returns found.</p>
                         )}
                    </CardContent>
                </Card>
            </TabsContent>
            <TabsContent value="rejected">
                 <Card>
                    <CardHeader>
                        <CardTitle>Rejected Investment Returns</CardTitle>
                        <CardDescription>
                           A log of all returns that have been rejected and reversed.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                         {loading ? (
                            <div className="flex justify-center items-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
                         ) : rejectedReturns.length > 0 ? (
                            renderTable(rejectedReturns, false)
                         ) : (
                            <p className="text-center text-muted-foreground p-8">No rejected returns found.</p>
                         )}
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
