
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { AdminLayout } from "@/components/layout/admin-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Check, X, RefreshCw, FileImage } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, updateDoc, writeBatch, setDoc, serverTimestamp } from 'firebase/firestore';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { cn } from '@/lib/utils';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import Image from 'next/image';
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface UserVerification {
    id: string;
    userId: string;
    userEmail?: string;
    methodName: string;
    status: 'pending' | 'approved' | 'rejected';
    submittedAt: any;
    formData: { [key: string]: string };
}

const VerificationList = ({ submissions, onAction, processingId }: { submissions: UserVerification[], onAction: (sub: UserVerification, newStatus: 'approved' | 'rejected') => void, processingId: string | null }) => {
    if (submissions.length === 0) {
        return <p className="text-center text-muted-foreground p-8">No submissions in this category.</p>
    }
    
    return (
        <Accordion type="multiple" className="w-full space-y-4">
            {submissions.map(sub => (
                <AccordionItem value={sub.id} key={sub.id} className="border rounded-lg bg-muted/30">
                     <div className="flex items-center px-4 py-3">
                        <AccordionTrigger className="flex-1 hover:no-underline pr-4">
                             <div className="flex flex-wrap items-center gap-x-4 gap-y-1 w-full text-left">
                                <div className="font-medium text-base">{sub.userEmail || sub.userId}</div>
                                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                    <span className="font-semibold">{sub.methodName}</span>
                                    <span>{sub.submittedAt ? format(sub.submittedAt.toDate(), 'PPp') : 'N/A'}</span>
                                </div>
                            </div>
                        </AccordionTrigger>
                        <AlertDialog>
                           <AlertDialogTrigger asChild>
                               <Button size="sm" variant={sub.status === 'rejected' ? 'default' : 'destructive'} disabled={processingId === sub.id}>
                                   {processingId === sub.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : (sub.status === 'rejected' ? <Check className="mr-2 h-4 w-4"/> : <X className="mr-2 h-4 w-4"/>)}
                                   {sub.status === 'rejected' ? 'Approve' : 'Reject'}
                               </Button>
                           </AlertDialogTrigger>
                           <AlertDialogContent>
                               <AlertDialogHeader>
                                   <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                   <AlertDialogDescription>
                                       You are about to {sub.status === 'rejected' ? 'approve' : 'reject'} this user's verification. This will {sub.status === 'rejected' ? 'un-ban their account and grant access' : 'ban their account and revoke access'}.
                                   </AlertDialogDescription>
                               </AlertDialogHeader>
                               <AlertDialogFooter>
                                   <AlertDialogCancel>Cancel</AlertDialogCancel>
                                   <AlertDialogAction onClick={() => onAction(sub, sub.status === 'rejected' ? 'approved' : 'rejected')}>
                                       Yes, {sub.status === 'rejected' ? 'Approve' : 'Reject'}
                                   </AlertDialogAction>
                               </AlertDialogFooter>
                           </AlertDialogContent>
                       </AlertDialog>
                     </div>
                     <AccordionContent className="pt-4 px-4 pb-4 border-t space-y-4">
                        <h4 className="font-semibold">Submitted Information:</h4>
                        {sub.formData && Object.entries(sub.formData).map(([key, value]) => (
                            <div key={key}>
                                <p className="text-sm font-medium capitalize">{key.replace(/_/g, ' ')}</p>
                                {value.startsWith('data:image') ? (
                                     <Dialog>
                                        <DialogTrigger asChild>
                                            <Button variant="outline"><FileImage className="mr-2"/> View Uploaded Image</Button>
                                        </DialogTrigger>
                                        <DialogContent className="max-w-3xl">
                                            <DialogHeader>
                                                <DialogTitle>Verification Image</DialogTitle>
                                            </DialogHeader>
                                            <div className="my-4">
                                                <Image src={value} alt="Verification" width={800} height={600} className="rounded-md object-contain" />
                                            </div>
                                        </DialogContent>
                                    </Dialog>
                                ) : (
                                    <p className="text-sm text-muted-foreground bg-muted p-2 rounded-md">{value}</p>
                                )}
                            </div>
                        ))}
                         {!sub.formData && <p className="text-sm text-muted-foreground">No form data found for this submission.</p>}
                    </AccordionContent>
                </AccordionItem>
            ))}
        </Accordion>
    )
}

export default function VerificationHistoryPage() {
    const { toast } = useToast();
    const [approved, setApproved] = useState<UserVerification[]>([]);
    const [rejected, setRejected] = useState<UserVerification[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);

    const fetchHistory = useCallback(async () => {
        if (!db) { setLoading(false); return; }
        setLoading(true);
        try {
            const approvedQuery = query(collection(db, "userVerifications"), where("status", "==", "approved"));
            const approvedSnapshot = await getDocs(approvedQuery);
            const approvedData = approvedSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as UserVerification));
            setApproved(approvedData.sort((a,b) => (b.submittedAt?.seconds || 0) - (a.submittedAt?.seconds || 0)));

            const rejectedQuery = query(collection(db, "userVerifications"), where("status", "==", "rejected"));
            const rejectedSnapshot = await getDocs(rejectedQuery);
            const rejectedData = rejectedSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as UserVerification));
            setRejected(rejectedData.sort((a,b) => (b.submittedAt?.seconds || 0) - (a.submittedAt?.seconds || 0)));
            
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: `Failed to fetch history: ${error.message}` });
        } finally {
            setLoading(false);
        }
    }, [toast]);
    
    useEffect(() => {
        fetchHistory();
    }, [fetchHistory]);

    const handleAction = async (submission: UserVerification, newStatus: 'approved' | 'rejected') => {
        if (!db) return;
        setProcessingId(submission.id);

        try {
            const batch = writeBatch(db);
            const userRef = doc(db, 'users', submission.userId);

            const verificationsQuery = query(collection(db, 'userVerifications'), where('userId', '==', submission.userId));
            const verificationSnapshot = await getDocs(verificationsQuery);

            let verificationRef;
            if (verificationSnapshot.empty) {
                verificationRef = doc(collection(db, 'userVerifications'));
                batch.set(verificationRef, {
                    userId: submission.userId,
                    userEmail: submission.userEmail,
                    methodName: 'Manual Admin Action',
                    status: newStatus,
                    submittedAt: serverTimestamp(),
                    formData: submission.formData || {},
                });
            } else {
                verificationRef = verificationSnapshot.docs[0].ref;
                batch.update(verificationRef, { status: newStatus });
            }

            if (newStatus === 'approved') {
                batch.update(userRef, { verificationStatus: 'verified', disabled: false });
            } else { // 'rejected'
                batch.update(userRef, { verificationStatus: 'rejected', disabled: true });
            }

            await batch.commit();
            toast({ title: 'Success', description: `User status has been updated to ${newStatus}.` });
            fetchHistory();
        } catch (error: any) {
             toast({ variant: 'destructive', title: 'Error', description: `Failed to update status: ${error.message}` });
        } finally {
            setProcessingId(null);
        }
    };


    return (
        <AdminLayout>
            <div className="space-y-8">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold font-headline tracking-tight">Verification History</h1>
                        <p className="text-muted-foreground">Review past verification decisions and make changes.</p>
                    </div>
                    <Button variant="outline" onClick={() => fetchHistory()} disabled={loading}>
                        <RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />
                        Refresh
                    </Button>
                </div>
                
                <Card>
                    <CardHeader>
                        <Tabs defaultValue="approved">
                             <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="approved">Approved ({approved.length})</TabsTrigger>
                                <TabsTrigger value="rejected">Rejected ({rejected.length})</TabsTrigger>
                            </TabsList>
                             <CardContent className="pt-6">
                                {loading ? (
                                    <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
                                ) : (
                                <>
                                    <TabsContent value="approved">
                                        <VerificationList submissions={approved} onAction={handleAction} processingId={processingId} />
                                    </TabsContent>
                                    <TabsContent value="rejected">
                                         <VerificationList submissions={rejected} onAction={handleAction} processingId={processingId} />
                                    </TabsContent>
                                </>
                                )}
                            </CardContent>
                        </Tabs>
                    </CardHeader>
                </Card>
            </div>
        </AdminLayout>
    );
}
