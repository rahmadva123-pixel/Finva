

"use client";

import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import React, { useState, useEffect } from 'react';
import { db } from "@/lib/firebase";
import { collection, getDocs, doc, getDoc, query, where } from 'firebase/firestore';
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import Image from "next/image";

interface PoolPlan {
  id: string;
  poolName: string;
  totalAmount: number;
  investTill: string;
  returnDate: string;
  minReturn: number;
  maxReturn: number;
  status: 'active' | 'inactive';
  investedAmount: number;
  featured: boolean;
  imageUrl?: string;
}

interface CurrencySettings {
  symbol: string;
  position: 'left' | 'right';
}

interface PoolTemplate {
    id: string;
    backgroundColor: string;
    backgroundColor2?: string;
    backgroundOverlayColor?: string;
    headerBackgroundColor: string;
    headerTextColor: string;
    returnRangeColor: string;
    returnRangeBackgroundColor: string;
    featureBackgroundColor: string;
    featureIconColor: string;
    featureTextColor: string;
    featureValueColor: string;
    progressBackgroundColor: string;
    progressIndicatorColor: string;
    buttonBackgroundColor: string;
    buttonTextColor: string;
    buttonText: string;
}

export default function PoolPlansPage() {
  const { toast } = useToast();
  const [plans, setPlans] = useState<PoolPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [currency, setCurrency] = useState<CurrencySettings>({ symbol: '$', position: 'left' });
  const [template, setTemplate] = useState<PoolTemplate | null>(null);

  useEffect(() => {
      const fetchPlans = async () => {
          if (!db) { setLoading(false); return; }
          try {
              const currencyDoc = await getDoc(doc(db, "settings", "currency"));
              if (currencyDoc.exists()) {
                setCurrency(currencyDoc.data() as CurrencySettings);
              }

              const templateDoc = await getDoc(doc(db, "settings", "poolTemplate"));
              if (templateDoc.exists()) {
                  setTemplate(templateDoc.data() as PoolTemplate);
              }

              const q = query(collection(db, 'poolPlans'), where('status', '==', 'active'));
              const querySnapshot = await getDocs(q);
              const plansData = await Promise.all(querySnapshot.docs.map(async (d) => {
                  const planData = d.data() as PoolPlan;
                  
                  // Get total invested amount for this plan
                  const investmentsQuery = query(collection(db, 'userPoolInvestments'), where('poolId', '==', d.id));
                  const investmentsSnapshot = await getDocs(investmentsQuery);
                  const totalInvested = investmentsSnapshot.docs.reduce((sum, doc) => sum + doc.data().amount, 0);

                  return {
                      ...planData,
                      id: d.id,
                      investedAmount: totalInvested,
                  };
              }));
              setPlans(plansData);

          } catch (error: any) {
              toast({ variant: 'destructive', title: 'Error', description: `Failed to fetch plans: ${error.message}` });
          } finally {
              setLoading(false);
          }
      };
      fetchPlans();
  }, [toast]);

  const formatCurrency = (amount: number) => {
    const value = amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2});
    return currency.position === 'left' ? `${currency.symbol}${value}` : `${value}${currency.symbol}`;
  };
  
  if(loading || !template) {
    return (
        <DashboardLayout>
            <div className="flex justify-center items-center h-full">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        </DashboardLayout>
    )
  }
  
  const progressIndicatorStyle = (template: PoolTemplate) => ({
    backgroundColor: template.progressIndicatorColor,
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
            <h1 className="text-3xl font-bold font-headline tracking-tight">Pool Plans</h1>
            <p className="text-muted-foreground">Invest in shared pools to earn returns.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plans.map((plan, index) => {
            const backgroundStyle = template.backgroundColor2 
                ? { background: `linear-gradient(to bottom right, ${template.backgroundColor}, ${template.backgroundColor2})`, position: 'relative' }
                : { backgroundColor: template.backgroundColor, position: 'relative' };

            return (
                <div 
                    key={plan.id} 
                    style={backgroundStyle as any} 
                    className="border border-green-500/20 rounded-2xl p-4 flex flex-col space-y-4"
                >
                    <div style={{position: 'absolute', inset: 0, backgroundColor: template.backgroundOverlayColor || 'transparent', borderRadius: 'inherit' }}></div>
                    <div className="relative z-10 flex flex-col space-y-4 h-full">
                        <div style={{ backgroundColor: template.headerBackgroundColor, color: template.headerTextColor }} className="text-center font-bold py-2 rounded-lg -mt-8 mx-8">
                            {plan.poolName}
                        </div>

                        {plan.imageUrl && plan.imageUrl.trim() !== '' && (
                            <div className="relative h-40 w-full rounded-lg overflow-hidden">
                                <Image src={plan.imageUrl} alt={plan.poolName} layout="fill" objectFit="cover" />
                            </div>
                        )}
                        
                        <div style={{ backgroundColor: template.returnRangeBackgroundColor, color: template.returnRangeColor }} className="text-center font-bold text-3xl py-3 rounded-lg">
                            {plan.minReturn}% - {plan.maxReturn}%
                        </div>
                        <div className="space-y-3 text-sm flex-grow">
                            <div style={{ backgroundColor: template.featureBackgroundColor }} className="flex items-center justify-between p-3 rounded-lg">
                            <span style={{ color: template.featureTextColor }} className="flex items-center gap-2"><CheckCircle style={{ color: template.featureIconColor }} className="h-4 w-4"/> Total Amount</span>
                            <span style={{ color: template.featureValueColor }} className="font-semibold">{formatCurrency(plan.totalAmount)}</span>
                            </div>
                            <div style={{ backgroundColor: template.featureBackgroundColor }} className="flex items-center justify-between p-3 rounded-lg">
                            <span style={{ color: template.featureTextColor }} className="flex items-center gap-2"><CheckCircle style={{ color: template.featureIconColor }} className="h-4 w-4"/> Invest till</span>
                            <span style={{ color: template.featureValueColor }} className="font-semibold">{plan.investTill}</span>
                            </div>
                            <div style={{ backgroundColor: template.featureBackgroundColor }} className="flex items-center justify-between p-3 rounded-lg">
                            <span style={{ color: template.featureTextColor }} className="flex items-center gap-2"><CheckCircle style={{ color: template.featureIconColor }} className="h-4 w-4"/> Return Date</span>
                            <span style={{ color: template.featureValueColor }} className="font-semibold">{plan.returnDate}</span>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <p className="text-sm text-center" style={{ color: template.featureTextColor }}>Invested Amount</p>
                            <p className="text-center font-semibold" style={{ color: template.featureValueColor }}>
                            {formatCurrency(plan.investedAmount)} / {formatCurrency(plan.totalAmount)}
                            </p>
                            <Progress 
                                value={(plan.investedAmount / plan.totalAmount) * 100} 
                                className="h-2"
                                style={{ backgroundColor: template.progressBackgroundColor }}
                                indicatorClassName={template.progressIndicatorColor}
                            />
                        </div>
                        <Button asChild style={{ backgroundColor: template.buttonBackgroundColor, color: template.buttonTextColor }} className="w-full font-bold">
                            <Link href={`/dashboard/pool/invest/${plan.id}`}>{template.buttonText}</Link>
                        </Button>
                    </div>
                </div>
            )
          })}
        </div>
      </div>
    </DashboardLayout>
  );
}
