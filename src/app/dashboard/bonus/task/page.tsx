
"use client";

import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle, ChevronRight, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, doc, getDoc, where } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";


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
}

interface CurrencySettings {
  symbol: string;
  position: 'left' | 'right';
}

interface TaskSubmission {
    id: string;
    campaignId: string;
    status: 'pending' | 'approved' | 'rejected';
}

export default function TaskAndEarnPage() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [allCampaigns, setAllCampaigns] = useState<TaskCampaign[]>([]);
    const [activeCampaigns, setActiveCampaigns] = useState<TaskCampaign[]>([]);
    const [completedCampaigns, setCompletedCampaigns] = useState<TaskCampaign[]>([]);
    const [loading, setLoading] = useState(true);
    const [currency, setCurrency] = useState<CurrencySettings>({ symbol: '$', position: 'left' });

    useEffect(() => {
        if (!db || !user) { setLoading(false); return; }

        const fetchTasks = async () => {
            try {
                // Fetch Currency
                const currencyDoc = await getDoc(doc(db, "settings", "currency"));
                if (currencyDoc.exists()) {
                  setCurrency(currencyDoc.data() as CurrencySettings);
                }

                // Fetch all task campaigns
                const campaignsQuery = query(collection(db, "taskCampaigns"));
                const campaignsSnapshot = await getDocs(campaignsQuery);
                const campaignsData = campaignsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as TaskCampaign[];
                
                // Fetch user's submissions
                const submissionsQuery = query(collection(db, "taskSubmissions"), where("userId", "==", user.uid));
                const submissionsSnapshot = await getDocs(submissionsQuery);
                const userSubmissions = submissionsSnapshot.docs.map(doc => doc.data() as TaskSubmission);
                const submittedCampaignIds = new Set(userSubmissions.map(s => s.campaignId));
                
                // Filter campaigns
                const active = campaignsData.filter(c => !submittedCampaignIds.has(c.id));
                const completed = campaignsData.filter(c => submittedCampaignIds.has(c.id));

                setActiveCampaigns(active);
                setCompletedCampaigns(completed);

            } catch (error) {
                toast({ variant: 'destructive', title: 'Error', description: 'Failed to fetch tasks.' });
            } finally {
                setLoading(false);
            }
        };

        fetchTasks();
    }, [toast, user]);

    const formatCurrency = (amount: number) => {
        const value = amount.toFixed(2);
        return currency.position === 'left' ? `${currency.symbol}${value}` : `${value}${currency.symbol}`;
    };
    
    if(loading) {
        return (
            <DashboardLayout>
                <div className="flex justify-center items-center h-full">
                    <Loader2 className="h-8 w-8 animate-spin" />
                </div>
            </DashboardLayout>
        )
    }
    
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
            <h1 className="text-3xl font-bold font-headline tracking-tight">Task & Earn</h1>
            <p className="text-muted-foreground">Complete tasks to earn rewards.</p>
        </div>

        <Tabs defaultValue="active">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="active">Active Campaigns</TabsTrigger>
                <TabsTrigger value="completed">Completed</TabsTrigger>
            </TabsList>
            <TabsContent value="active">
                {activeCampaigns.length > 0 ? (
                <div className="space-y-8 pt-6">
                    {activeCampaigns.map(campaign => (
                        <Card key={campaign.id} className="flex flex-col">
                            <CardHeader>
                                <CardTitle>{campaign.name}</CardTitle>
                                <CardDescription>{campaign.description}</CardDescription>
                            </CardHeader>
                            <CardContent className="flex-grow">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                                <div>
                                    <p className="text-sm text-muted-foreground mb-2">Tasks:</p>
                                    <ul className="list-disc list-inside space-y-1">
                                        {campaign.tasks.map(task => (
                                            <li key={task.id}>{task.name}</li>
                                        ))}
                                    </ul>
                                </div>
                                <div className="text-center p-6 bg-muted rounded-lg">
                                    <p className="text-sm text-muted-foreground">Total Reward</p>
                                    <p className="text-4xl font-bold text-primary">{formatCurrency(campaign.totalReward)}</p>
                                </div>
                            </div>
                            </CardContent>
                            <CardFooter>
                                <Button className="w-full" asChild>
                                    <Link href={`/dashboard/bonus/task/${campaign.id}`}>
                                        Start Campaign <ArrowRight className="ml-2"/>
                                    </Link>
                                </Button>
                            </CardFooter>
                        </Card>
                    ))}
                </div>
                ) : (
                    <Card className="mt-6">
                        <CardContent className="p-8 text-center text-muted-foreground">
                            There are no new tasks available at the moment.
                        </CardContent>
                    </Card>
                )}
            </TabsContent>
            <TabsContent value="completed">
                 {completedCampaigns.length > 0 ? (
                    <div className="space-y-8 pt-6">
                        {completedCampaigns.map(campaign => (
                             <Card key={campaign.id} className="flex flex-col bg-muted/50 border-dashed">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2 text-muted-foreground">
                                       {campaign.name}
                                    </CardTitle>
                                    <CardDescription>{campaign.description}</CardDescription>
                                </CardHeader>
                                <CardContent className="flex-grow">
                                     <div className="text-center p-6 bg-background rounded-lg">
                                        <CheckCircle className="h-10 w-10 text-green-500 mx-auto mb-2"/>
                                        <p className="text-sm text-muted-foreground">Campaign Completed</p>
                                        <p className="text-2xl font-bold text-green-500">{formatCurrency(campaign.totalReward)}</p>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                 ) : (
                     <Card className="mt-6">
                        <CardContent className="p-8 text-center text-muted-foreground">
                           You haven't completed any task campaigns yet.
                        </CardContent>
                    </Card>
                 )}
            </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
