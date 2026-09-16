

      
"use client";

import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, getDoc, writeBatch, serverTimestamp, addDoc, updateDoc, runTransaction, DocumentSnapshot } from "firebase/firestore";
import React, { useEffect, useState, useCallback } from "react";
import { Loader2, History } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { addHours, addDays, addWeeks, addMonths, addYears, differenceInSeconds } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { addEarning } from "@/lib/earnings";

interface UserInvestment {
    id: string;
    planName: string;
    amount: number;
    status: 'active' | 'completed';
    startDate: any;
    returnsCalculated: number;
    termDuration: number;
    interestRate: number;
    returnPeriod: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly';
    nextReturnDate: any;
    lastReturnDate: any;
    returnPayout: boolean;
    capitalBack: boolean;
}

interface CurrencySettings {
  symbol: string;
  position: 'left' | 'right';
}

interface CommissionLevel {
  id: string;
  value: number;
  type: 'fixed' | 'percentage';
}

function Countdown({ 
    nextReturn,
    lastReturn,
}: { 
    nextReturn: Date | null, 
    lastReturn: Date | null,
}) {
    const [timeLeft, setTimeLeft] = useState<string | null>(null);
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        if (!nextReturn || !lastReturn) {
            setTimeLeft(null);
            setProgress(100);
            return;
        };

        const totalDuration = differenceInSeconds(nextReturn, lastReturn);
        if (totalDuration <= 0) {
            setTimeLeft("Ready to claim");
            setProgress(100);
            return;
        }

        const timer = setInterval(() => {
            const now = new Date();
            const distance = differenceInSeconds(nextReturn, now);
            
            if (distance < 0) {
                setTimeLeft(null);
                setProgress(100);
                clearInterval(timer);
                return;
            }

            const elapsedSeconds = differenceInSeconds(now, lastReturn);
            const currentProgress = Math.min(100, (elapsedSeconds / totalDuration) * 100);
            setProgress(currentProgress);

            const days = Math.floor(distance / (3600 * 24));
            const hours = Math.floor((distance % (3600 * 24)) / 3600);
            const minutes = Math.floor((distance % 3600) / 60);
            const seconds = distance % 60;
            
            setTimeLeft(`${days}d ${hours}h ${minutes}m ${seconds}s`);

        }, 1000);

        return () => clearInterval(timer);
    }, [nextReturn, lastReturn]);

    return (
        <div className="text-center space-y-2">
            <div className="text-sm font-mono tracking-wider h-5">
                {timeLeft ? timeLeft : "..."}
            </div>
            <Progress value={progress} />
        </div>
    );
}

const InvestmentCard = ({ investment, currency, formatCurrency }: { investment: UserInvestment, currency: CurrencySettings, formatCurrency: (val: number) => string }) => {
    const profitPerReturn = (investment.amount * investment.interestRate) / 100;
    const isLifetime = investment.termDuration === -1;
    const investmentCompleted = investment.status === 'completed';

    const profitReceived = profitPerReturn * investment.returnsCalculated;
    let totalProfit = isLifetime ? 0 : profitPerReturn * investment.termDuration;

    let totalProfitLabel = "Total Potential Profit";
    if (investment.capitalBack && !isLifetime) {
        totalProfit += investment.amount;
        totalProfitLabel = "Cap.+Profit";
    }
    
    const nextReturnDate = investment.nextReturnDate?.seconds ? new Date(investment.nextReturnDate.seconds * 1000) : null;
    const lastReturnDate = investment.lastReturnDate?.seconds ? new Date(investment.lastReturnDate.seconds * 1000) : null;

    const canClaim = nextReturnDate && new Date() > nextReturnDate;
    
    const getStatusContent = () => {
        if (investmentCompleted) {
            return <p>Completed</p>;
        }
        if (canClaim) {
            return <p className="font-bold text-primary">Return is Due</p>
        }
        return <Countdown nextReturn={nextReturnDate} lastReturn={lastReturnDate} />;
    }

    return (
        <Card key={investment.id} className="bg-card/70 flex flex-col">
            <CardHeader>
                <CardTitle>{investment.planName}</CardTitle>
                <CardDescription>Invested: {formatCurrency(investment.amount)}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 flex-grow">
               <div className="space-y-2">
                    <div className="flex justify-between text-sm mb-2">
                        <span className="text-muted-foreground">Received</span>
                        <span>{investment.returnsCalculated} / {isLifetime ? 'Unlimited' : investment.termDuration}</span>
                    </div>
                     <div className="text-center text-sm font-semibold">
                        {getStatusContent()}
                    </div>
               </div>
               <div className="flex justify-between text-sm font-medium p-3 bg-muted rounded-md">
                    <span className="text-muted-foreground">Profit Received</span>
                    <span>{formatCurrency(profitReceived)}</span>
               </div>
                <div className="flex justify-between text-sm font-medium p-3 bg-muted/50 rounded-md">
                    <span className="text-muted-foreground">Profit Per Return</span>
                    <span>{formatCurrency(profitPerReturn)}</span>
                </div>
                {!isLifetime && (
                    <div className="flex justify-between text-sm font-bold p-3 bg-muted/80 rounded-md">
                        <span className="text-muted-foreground">{totalProfitLabel}</span>
                        <span>{formatCurrency(totalProfit)}</span>
                    </div>
                )}
            </CardContent>
            <CardFooter className="flex flex-col items-center justify-center gap-3 p-4">
                <Button className="w-full" variant="outline" asChild>
                    <Link href={`/dashboard/investment/return-history/${investment.id}`}>
                        <History className="mr-2 h-4 w-4" /> View Returns
                    </Link>
                </Button>
                <Button 
                    className="w-full" 
                    disabled={true}
                >
                  {investmentCompleted ? 'Plan Completed' : 
                   (canClaim ? 'Return is Due' : 'Next Return Pending')}
                </Button>
            </CardFooter>
        </Card>
    );
};

export default function MyInvestmentPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [investments, setInvestments] = useState<UserInvestment[]>([]);
  const [loading, setLoading] = useState(true);
  const [currency, setCurrency] = useState<CurrencySettings>({ symbol: '$', position: 'left' });

  const formatCurrency = useCallback((amount: number) => {
    const value = amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return currency.position === 'left' ? `${currency.symbol}${value}` : `${value}${currency.symbol}`;
  }, [currency]);
  
  const fetchInvestments = useCallback(async (showLoading = true) => {
    if (!user || !db) {
      if(showLoading) setLoading(false);
      return;
    }
    if(showLoading) setLoading(true);
    try {
      const currencyDoc = await getDoc(doc(db, "settings", "currency"));
      if (currencyDoc.exists()) {
        setCurrency(currencyDoc.data() as CurrencySettings);
      }

      const q = query(
        collection(db, "userInvestments"),
        where("userId", "==", user.uid)
      );
      const querySnapshot = await getDocs(q);
      const investmentsData = querySnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as UserInvestment))
          .sort((a,b) => b.startDate.seconds - a.startDate.seconds);
      
      setInvestments(investmentsData);

    } catch (error) {
      console.error("Error fetching investments: ", error);
    } finally {
      if(showLoading) setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchInvestments();
  }, [fetchInvestments]);
  
  const activeInvestments = investments.filter(inv => inv.status === 'active');
  const completedInvestments = investments.filter(inv => inv.status === 'completed');

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
            <h1 className="text-3xl font-bold font-headline tracking-tight">My Investments</h1>
            <p className="text-muted-foreground">An overview of all your active and completed investment plans.</p>
        </div>
        
        <Tabs defaultValue="active" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="active">Active Plans ({activeInvestments.length})</TabsTrigger>
                <TabsTrigger value="completed">Completed Plans ({completedInvestments.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="active" className="pt-6">
                {loading ? (
                    <div className="flex justify-center items-center p-16"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>
                ) : activeInvestments.length === 0 ? (
                    <Card><CardContent className="p-8 text-center text-muted-foreground">You have no active investments.</CardContent></Card>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                        {activeInvestments.map(investment => (
                            <InvestmentCard 
                                key={investment.id}
                                investment={investment}
                                currency={currency}
                                formatCurrency={formatCurrency}
                            />
                        ))}
                    </div>
                )}
            </TabsContent>
            <TabsContent value="completed" className="pt-6">
                 {loading ? (
                    <div className="flex justify-center items-center p-16"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>
                ) : completedInvestments.length === 0 ? (
                    <Card><CardContent className="p-8 text-center text-muted-foreground">You have no completed investments.</CardContent></Card>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                        {completedInvestments.map(investment => (
                             <InvestmentCard 
                                key={investment.id}
                                investment={investment}
                                currency={currency}
                                formatCurrency={formatCurrency}
                            />
                        ))}
                    </div>
                )}
            </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
