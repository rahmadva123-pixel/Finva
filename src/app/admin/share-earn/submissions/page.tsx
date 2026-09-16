
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { AdminLayout } from "@/components/layout/admin-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Check, X, FileImage, Link as LinkIcon, User } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, getDoc, writeBatch, serverTimestamp, orderBy, runTransaction } from 'firebase/firestore';
import Image from 'next/image';
import { format } from 'date-fns';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { addEarning } from '@/lib/earnings';

type Proofs = {
    [key in 'facebook' | 'whatsapp' | 'telegram' | 'tiktok']?: {
        url?: string;
        screenshot?: string;
    }
}

interface ShareSubmission {
  id: string;
  userId: string;
  postId: string;
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: any;
  userEmail?: string;
  postTitle?: string;
  rewardAmount?: number;
  proofs: Proofs;
}

export default function ShareSubmissionsPage() {
    const { toast } = useToast();
    const [submissions, setSubmissions] = useState<ShareSubmission[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);

    const fetchSubmissions = useCallback(async () => {
        if (!db) { setLoading(false); return; }
        setLoading(true);
        try {
            const q = query(collection(db, 'shareSubmissions'), orderBy('submittedAt', 'desc'));
            const querySnapshot = await getDocs(q);
            
            const submissionsData = await Promise.all(querySnapshot.docs.map(async (d) => {
                const data = d.data();
                const userDoc = await getDoc(doc(db, 'users', data.userId));
                
                const postDoc = await getDoc(doc(db, 'shareablePosts', data.postId));

                return {
                    id: d.id,
                    ...data,
                    userEmail: userDoc.exists() ? userDoc.data().email : 'Unknown User',
                    postTitle: postDoc.exists() ? postDoc.data().title : 'Unknown Post',
                    rewardAmount: postDoc.exists() ? postDoc.data().rewardAmount : 0,
                } as ShareSubmission;
            }));

            setSubmissions(submissionsData);
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: `Failed to fetch submissions: ${error.message}` });
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        fetchSubmissions();
    }, [fetchSubmissions]);

    const handleAction = async (submission: ShareSubmission, newStatus: 'approved' | 'rejected') => {
        if (!db) return;
        setProcessingId(submission.id);

        try {
            await runTransaction(db, async (transaction) => {
                const submissionRef = doc(db, "shareSubmissions", submission.id);

                if (newStatus === 'approved' && submission.rewardAmount && submission.rewardAmount > 0) {
                    const userDoc = await getDoc(doc(db, 'users', submission.userId));
                    await addEarning(transaction, submission.userId, submission.rewardAmount, userDoc, null);
                    
                    const bonusTransactionRef = doc(collection(db, 'bonusTransactions'));
                    transaction.set(bonusTransactionRef, {
                        userId: submission.userId,
                        type: 'task', // Re-using 'task' type for this bonus
                        amount: submission.rewardAmount,
                        date: serverTimestamp(),
                        description: `Share & Earn: ${submission.postTitle}`
                    });
                }

                transaction.update(submissionRef, { status: newStatus });
            });
            
            toast({ title: 'Success', description: `Submission has been ${newStatus}.` });
            fetchSubmissions();

        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: `Failed to process submission: ${error.message}` });
        } finally {
            setProcessingId(null);
        }
    };

    const renderSubmissionList = (submissionsToShow: ShareSubmission[]) => {
        if(submissionsToShow.length === 0) {
            return <p className="text-center text-muted-foreground p-8">No submissions in this category.</p>
        }
        return (
            <div className="grid gap-6">
                {submissionsToShow.map(submission => (
                    <Card key={submission.id} className="bg-muted/30">
                        <CardHeader>
                            <div className="flex justify-between items-start">
                                <div>
                                    <CardTitle className="text-lg">{submission.postTitle}</CardTitle>
                                     <CardDescription>Reward: ${(submission.rewardAmount || 0).toFixed(2)}</CardDescription>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-semibold flex items-center gap-2"><User className="h-4 w-4" /> {submission.userEmail}</p>
                                    <p className="text-xs text-muted-foreground">
                                        Submitted on {format(submission.submittedAt.toDate(), "PPp")}
                                    </p>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                             <Accordion type="single" collapsible className="w-full">
                                <AccordionItem value="item-1">
                                    <AccordionTrigger>View Submitted Proofs</AccordionTrigger>
                                    <AccordionContent className="pt-4 space-y-4">
                                        {submission.proofs && Object.entries(submission.proofs).map(([platform, proof]) => (
                                            <div key={platform} className="p-3 border rounded-md">
                                                <h4 className="font-semibold capitalize mb-2">{platform} Proof</h4>
                                                <div className="flex items-center gap-4">
                                                    {proof.screenshot && (
                                                        <Button variant="outline" asChild>
                                                            <a href={proof.screenshot} target="_blank" rel="noopener noreferrer"><FileImage className="mr-2"/> View Screenshot</a>
                                                        </Button>
                                                    )}
                                                    {proof.url && (
                                                        <Button variant="outline" asChild>
                                                            <a href={proof.url} target="_blank" rel="noopener noreferrer"><LinkIcon className="mr-2" /> View Post URL</a>
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                        {!submission.proofs && <p className="text-sm text-muted-foreground">No proof was submitted for this entry.</p>}
                                    </AccordionContent>
                                </AccordionItem>
                            </Accordion>
                        </CardContent>
                        {submission.status === 'pending' && (
                             <CardFooter className="flex justify-end items-center bg-muted/50 p-4 gap-2">
                                <Button size="sm" variant="outline" className="bg-red-500/10 text-red-500 hover:bg-red-500/20" onClick={() => handleAction(submission, 'rejected')} disabled={processingId === submission.id}>
                                    {processingId === submission.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <X className="mr-1 h-4 w-4"/>} Reject
                                </Button>
                                <Button size="sm" variant="outline" className="bg-green-500/10 text-green-500 hover:bg-green-500/20" onClick={() => handleAction(submission, 'approved')} disabled={processingId === submission.id}>
                                    {processingId === submission.id ? <Loader2 className="mr-1 h-4 w-4 animate-spin"/> : <Check className="mr-1 h-4 w-4"/>} Approve
                                </Button>
                            </CardFooter>
                        )}
                         {submission.status !== 'pending' && (
                            <CardFooter>
                                <Badge variant={submission.status === 'approved' ? 'default' : 'destructive'} className="capitalize">{submission.status}</Badge>
                            </CardFooter>
                         )}
                    </Card>
                ))}
            </div>
        )
    }

    const pending = submissions.filter(s => s.status === 'pending');
    const approved = submissions.filter(s => s.status === 'approved');
    const rejected = submissions.filter(s => s.status === 'rejected');


    return (
        <AdminLayout>
            <div className="space-y-8">
                <div>
                    <h1 className="text-3xl font-bold font-headline tracking-tight">Share Submissions</h1>
                    <p className="text-muted-foreground">Review and approve user submissions for shared posts.</p>
                </div>
                <Card>
                    <CardHeader>
                        <Tabs defaultValue="pending" className="w-full">
                            <TabsList className="grid w-full grid-cols-3">
                                <TabsTrigger value="pending">Pending ({pending.length})</TabsTrigger>
                                <TabsTrigger value="approved">Approved ({approved.length})</TabsTrigger>
                                <TabsTrigger value="rejected">Rejected ({rejected.length})</TabsTrigger>
                            </TabsList>
                             <CardContent className="pt-6">
                                {loading ? (
                                    <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
                                ) : (
                                    <TabsContent value="pending" forceMount>
                                        {renderSubmissionList(pending)}
                                    </TabsContent>
                                )}
                                <TabsContent value="approved" forceMount>
                                    {loading ? <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div> : renderSubmissionList(approved)}
                                </TabsContent>
                                <TabsContent value="rejected" forceMount>
                                    {loading ? <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div> : renderSubmissionList(rejected)}
                                </TabsContent>
                            </CardContent>
                        </Tabs>
                    </CardHeader>
                </Card>
            </div>
        </AdminLayout>
    );
}
