
"use client";

import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { doc, getDoc, addDoc, collection, serverTimestamp, query, where, getDocs, runTransaction } from "firebase/firestore";
import { ArrowLeft, CheckCircle, ExternalLink, Loader2 } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { addEarning } from "@/lib/earnings";

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

interface Answer {
    taskId: string;
    answer: string;
}

export default function CampaignDetailPage() {
    const { user } = useAuth();
    const { toast } = useToast();
    const router = useRouter();
    const params = useParams();
    const campaignId = params.campaignId as string;
    
    const [campaign, setCampaign] = useState<TaskCampaign | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [currentTaskIndex, setCurrentTaskIndex] = useState(0);
    const [answers, setAnswers] = useState<Answer[]>([]);
    const [currentAnswer, setCurrentAnswer] = useState("");
    const [completed, setCompleted] = useState(false);
    const [alreadyCompleted, setAlreadyCompleted] = useState(false);

    useEffect(() => {
        if(!db || !campaignId || !user) {
            setLoading(false);
            return;
        };
        const fetchData = async () => {
            try {
                // Check if user has already completed this campaign
                const submissionQuery = query(
                    collection(db, 'taskSubmissions'), 
                    where('userId', '==', user.uid), 
                    where('campaignId', '==', campaignId)
                );
                const submissionSnapshot = await getDocs(submissionQuery);
                if (!submissionSnapshot.empty) {
                    setAlreadyCompleted(true);
                    setLoading(false);
                    return;
                }

                // Fetch Campaign data
                const campaignDoc = await getDoc(doc(db, 'taskCampaigns', campaignId));
                if(campaignDoc.exists()) {
                    setCampaign({ id: campaignDoc.id, ...campaignDoc.data() } as TaskCampaign);
                } else {
                    toast({ variant: 'destructive', title: 'Error', description: 'Campaign not found.'});
                    router.push('/dashboard/bonus/task');
                }
            } catch (error: any) {
                toast({ variant: 'destructive', title: 'Error', description: `Failed to fetch campaign: ${error.message}`});
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [campaignId, user, router, toast]);

    const handleNextTask = (e: React.FormEvent) => {
        e.preventDefault();
        if(!campaign) return;
        
        const currentTask = campaign.tasks[currentTaskIndex];
        setAnswers(prev => [...prev, { taskId: currentTask.id, answer: currentAnswer }]);
        setCurrentAnswer("");

        if (currentTaskIndex < campaign.tasks.length - 1) {
            setCurrentTaskIndex(prev => prev + 1);
        } else {
            setCompleted(true);
        }
    }
    
    const handleSubmitCampaign = async () => {
        if(!db || !user || !campaign) return;
        setSubmitting(true);
        
        const finalAnswers = [...answers, { taskId: campaign.tasks[currentTaskIndex].id, answer: currentAnswer }];

        try {
            if(campaign.payoutMethod === 'automatic') {
                 await runTransaction(db, async (transaction) => {
                    const userRef = doc(db, 'users', user.uid);
                    const earningRulesDocRef = doc(db, 'settings', 'earningRules');
                    
                    const userDoc = await transaction.get(userRef);
                    const earningRulesDoc = await transaction.get(earningRulesDocRef);

                    if (!userDoc.exists()) {
                        throw new Error("User not found");
                    }
    
                    await addEarning(transaction, user.uid, campaign.totalReward, userDoc, earningRulesDoc);
    
                    const submissionRef = doc(collection(db, 'taskSubmissions'));
                    transaction.set(submissionRef, {
                       userId: user.uid,
                       campaignId: campaign.id,
                       campaignName: campaign.name,
                       answers: finalAnswers,
                       status: 'approved',
                       submittedAt: serverTimestamp(),
                    });
   
                    const bonusTransactionRef = doc(collection(db, 'bonusTransactions'));
                    transaction.set(bonusTransactionRef, {
                        userId: user.uid,
                        type: 'task',
                        amount: campaign.totalReward,
                        date: serverTimestamp(),
                        description: `Task Bonus: ${campaign.name}`
                    });
                });

            } else { // Manual
                 await addDoc(collection(db, 'taskSubmissions'), {
                    userId: user.uid,
                    campaignId: campaign.id,
                    campaignName: campaign.name,
                    answers: finalAnswers,
                    status: 'pending',
                    submittedAt: serverTimestamp(),
                });
            }
            
            toast({ title: 'Success', description: 'Campaign submitted successfully!'});
            router.push('/dashboard/bonus/task');

        } catch (error: any) {
             toast({ variant: 'destructive', title: 'Error', description: `Failed to submit campaign: ${error.message}`});
        } finally {
            setSubmitting(false);
        }
    }

    if (loading) {
        return (
            <DashboardLayout>
                 <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin"/></div>
            </DashboardLayout>
        );
    }
    
    if (alreadyCompleted) {
        return (
             <DashboardLayout>
                <div className="max-w-md mx-auto text-center space-y-4">
                    <CheckCircle className="h-16 w-16 text-green-500 mx-auto"/>
                    <h1 className="text-2xl font-bold">Campaign Already Completed</h1>
                    <p className="text-muted-foreground">You have already submitted this task campaign. Your submission is being processed.</p>
                     <Button onClick={() => router.push('/dashboard/bonus/task')}>
                        <ArrowLeft className="mr-2" /> Back to Tasks
                    </Button>
                </div>
            </DashboardLayout>
        )
    }
    
    if (!campaign) {
        return (
             <DashboardLayout>
                 <div className="flex justify-center items-center h-full"><p>Campaign not found.</p></div>
            </DashboardLayout>
        )
    }
    
    const currentTask = campaign.tasks[currentTaskIndex];

    return (
        <DashboardLayout>
            <div className="max-w-2xl mx-auto space-y-6">
                 <Button variant="ghost" onClick={() => router.back()}>
                    <ArrowLeft className="mr-2" /> Back to Task List
                </Button>
                
                 <Card>
                    <CardHeader>
                        <CardTitle>{campaign.name}</CardTitle>
                        <CardDescription>{campaign.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                            <h3 className="font-semibold text-lg">Task {currentTaskIndex + 1} of {campaign.tasks.length}</h3>
                             <p className="font-bold text-primary">Reward: ${campaign.totalReward.toFixed(2)}</p>
                        </div>
                        
                        <div className="p-4 border rounded-lg space-y-4">
                            <h4 className="font-semibold">{currentTask.name}</h4>
                            <Button asChild style={{ backgroundColor: currentTask.buttonColor }}>
                                <a href={currentTask.url} target="_blank" rel="noopener noreferrer">
                                    {currentTask.buttonText} <ExternalLink className="ml-2"/>
                                </a>
                            </Button>
                        </div>

                        <form onSubmit={handleNextTask} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="verification">{currentTask.verificationQuestion}</Label>
                                <Textarea 
                                    id="verification"
                                    value={currentAnswer}
                                    onChange={(e) => setCurrentAnswer(e.target.value)}
                                    placeholder="Your answer here..."
                                    required
                                />
                            </div>
                            
                           {completed ? (
                               <Button onClick={handleSubmitCampaign} className="w-full" disabled={submitting}>
                                   {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                                   Submit Campaign for Review
                               </Button>
                           ) : (
                               <Button type="submit" className="w-full">
                                    Next Task <ArrowLeft className="ml-2 transform rotate-180"/>
                               </Button>
                           )}
                        </form>
                    </CardContent>
                </Card>

            </div>
        </DashboardLayout>
    )
}
