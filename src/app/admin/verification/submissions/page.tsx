
"use client";

import React, { useState, useEffect } from 'react';
import { AdminLayout } from "@/components/layout/admin-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { Loader2, Check, X, User, FileImage } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import Image from 'next/image';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

interface UserVerification {
    id: string;
    userId: string;
    userEmail?: string;
    methodName: string;
    status: 'pending' | 'approved' | 'rejected';
    submittedAt: any;
    formData: { [key: string]: string };
}

export default function VerificationSubmissionsPage() {
    const [submissions, setSubmissions] = useState<UserVerification[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const { toast } = useToast();

    const fetchSubmissions = async () => {
        if (!db) { setLoading(false); return; }
        setLoading(true);
        try {
            const q = query(collection(db, "userVerifications"), where("status", "==", "pending"));
            const querySnapshot = await getDocs(q);
            const subsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as UserVerification[];
            setSubmissions(subsData);
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error fetching submissions', description: error.message });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSubmissions();
    }, []);

    const handleAction = async (submission: UserVerification, newStatus: 'approved' | 'rejected') => {
        if (!db) return;
        setProcessingId(submission.id);

        try {
            const batch = writeBatch(db);
            const userRef = doc(db, 'users', submission.userId);
            const verificationRef = doc(db, 'userVerifications', submission.id);

            if (newStatus === 'approved') {
                batch.update(userRef, { verificationStatus: 'verified', disabled: false });
                batch.update(verificationRef, { status: 'approved' });
            } else { // 'rejected'
                batch.update(userRef, { verificationStatus: 'rejected' });
                batch.update(verificationRef, { status: 'rejected' });
            }

            await batch.commit();
            toast({ title: 'Success', description: `Submission has been ${newStatus}.` });
            fetchSubmissions();
        } catch (error: any) {
             toast({ variant: 'destructive', title: 'Error', description: `Failed to update submission: ${error.message}` });
        } finally {
            setProcessingId(null);
        }
    }

  return (
    <AdminLayout>
      <div className="flex flex-col gap-8">
        <div>
          <h1 className="text-3xl font-bold font-headline tracking-tight">Pending Verifications</h1>
          <p className="text-muted-foreground">Review and process new user identity verification requests.</p>
        </div>
        <Card>
            <CardHeader>
                <CardTitle>Submission Queue</CardTitle>
            </CardHeader>
            <CardContent>
                 {loading ? (
                    <div className="flex justify-center items-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
                ) : submissions.length === 0 ? (
                    <p className="text-center text-muted-foreground p-8">No pending submissions.</p>
                ) : (
                    <Accordion type="multiple" className="w-full space-y-4">
                        {submissions.map(sub => (
                             <AccordionItem value={sub.id} key={sub.id} className="border rounded-lg bg-muted/30">
                                <div className="flex items-center px-4 py-3">
                                    <AccordionTrigger className="flex-1 hover:no-underline pr-4">
                                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 w-full text-left">
                                            <div className="font-medium text-base">{sub.userEmail || sub.userId}</div>
                                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                                <span className="font-semibold">{sub.methodName}</span>
                                                <span>{format(sub.submittedAt.toDate(), 'PPp')}</span>
                                            </div>
                                        </div>
                                    </AccordionTrigger>
                                     <div className="flex gap-2 shrink-0">
                                        <Button size="sm" variant="outline" className="bg-red-500/10 text-red-500 hover:bg-red-500/20" onClick={() => handleAction(sub, 'rejected')} disabled={processingId === sub.id}>
                                            {processingId === sub.id ? <Loader2 className="mr-1 h-4 w-4 animate-spin"/> : <X className="mr-1 h-4 w-4"/>} Reject
                                        </Button>
                                        <Button size="sm" variant="outline" className="bg-green-500/10 text-green-500 hover:bg-green-500/20" onClick={() => handleAction(sub, 'approved')} disabled={processingId === sub.id}>
                                            {processingId === sub.id ? <Loader2 className="mr-1 h-4 w-4 animate-spin"/> : <Check className="mr-1 h-4 w-4"/>} Approve
                                        </Button>
                                    </div>
                                </div>
                                <AccordionContent className="pt-4 px-4 pb-4 border-t space-y-4">
                                    <h4 className="font-semibold">Submitted Information:</h4>
                                    {Object.entries(sub.formData).map(([key, value]) => (
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
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                )}
            </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
