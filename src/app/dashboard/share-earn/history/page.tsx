
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { useAuth } from '@/hooks/use-auth';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { useRouter } from 'next/navigation';

interface ShareSubmission {
  id: string;
  postId: string;
  postTitle?: string;
  rewardAmount?: number;
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: any;
}

interface CurrencySettings {
  symbol: string;
  position: 'left' | 'right';
}

export default function ShareHistoryPage() {
    const { toast } = useToast();
    const { user } = useAuth();
    const router = useRouter();
    const [submissions, setSubmissions] = useState<ShareSubmission[]>([]);
    const [loading, setLoading] = useState(true);
    const [currency, setCurrency] = useState<CurrencySettings>({ symbol: '$', position: 'left' });

    const fetchHistory = useCallback(async () => {
        if (!db || !user) { setLoading(false); return; }
        setLoading(true);
        try {
             const currencyDoc = await getDoc(doc(db, 'settings', 'currency'));
            if (currencyDoc.exists()) {
                setCurrency(currencyDoc.data() as CurrencySettings);
            }

            const q = query(collection(db, 'shareSubmissions'), where('userId', '==', user.uid));
            const querySnapshot = await getDocs(q);
            
            const submissionsData = await Promise.all(querySnapshot.docs.map(async (d) => {
                const data = d.data();
                const postDoc = await getDoc(doc(db, 'shareablePosts', data.postId));
                return {
                    id: d.id,
                    ...data,
                    postTitle: postDoc.exists() ? postDoc.data().title : 'Unknown Post',
                    rewardAmount: postDoc.exists() ? postDoc.data().rewardAmount : 0,
                } as ShareSubmission;
            }));

            submissionsData.sort((a,b) => b.submittedAt.seconds - a.submittedAt.seconds);
            setSubmissions(submissionsData);
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: `Failed to fetch submission history: ${error.message}` });
        } finally {
            setLoading(false);
        }
    }, [toast, user]);

    useEffect(() => {
        fetchHistory();
    }, [fetchHistory]);
    
    const formatCurrency = (amount: number) => {
        const value = amount.toFixed(2);
        return currency.position === 'left' ? `${currency.symbol}${value}` : `${value}${currency.symbol}`;
    };

    const getStatusBadge = (status: ShareSubmission['status']) => {
        switch (status) {
            case 'pending': return <Badge variant="secondary">Pending</Badge>;
            case 'approved': return <Badge>Approved</Badge>;
            case 'rejected': return <Badge variant="destructive">Rejected</Badge>;
            default: return <Badge variant="outline">{status}</Badge>;
        }
    }


    if (loading) {
        return (
            <DashboardLayout>
                <div className="flex justify-center items-center h-full">
                    <Loader2 className="h-8 w-8 animate-spin" />
                </div>
            </DashboardLayout>
        );
    }
    
    return (
        <DashboardLayout>
            <div className="space-y-6">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.back()}>
                        <ArrowLeft />
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold font-headline tracking-tight">Submission History</h1>
                        <p className="text-muted-foreground">Track the status of your "Share & Earn" submissions.</p>
                    </div>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>My Submissions</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {submissions.length === 0 ? (
                            <p className="text-center text-muted-foreground py-8">You have not made any submissions yet.</p>
                        ) : (
                             <div className="space-y-4">
                                {submissions.map(sub => (
                                    <div key={sub.id} className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
                                        <div>
                                            <p className="font-semibold">{sub.postTitle}</p>
                                            <p className="text-sm text-muted-foreground">
                                                Submitted on {format(sub.submittedAt.toDate(), 'PP')}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-bold text-lg text-primary">{formatCurrency(sub.rewardAmount || 0)}</p>
                                            {getStatusBadge(sub.status)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    );
}
