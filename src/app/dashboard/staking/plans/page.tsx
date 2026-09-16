

"use client";

import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where, doc, getDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { CheckCircle, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import Image from "next/image";

interface StakingPlan {
  id: string;
  planName: string;
  imageUrl?: string;
  minAmount: number;
  maxAmount: number;
  returnPercentage: number;
  durationDays: number;
  capitalBack: boolean;
  createdAt: any;
}

interface CurrencySettings {
  symbol: string;
  position: 'left' | 'right';
}

interface StakingTemplate {
    id: string;
    cardBackgroundColor: string;
    cardBackgroundColor2?: string;
    cardTextColor: string;
    planNameColor: string;
    returnPercentageColor: string;
    durationColor: string;
    detailsLabelColor: string;
    detailsValueColor: string;
    buttonBackgroundColor: string;
    buttonTextColor: string;
    badgeBackgroundColor: string;
    badgeTextColor: string;
    returnPercentageBackgroundColor?: string; // New
    durationBackgroundColor?: string; // New
}

export default function StakingPlansPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [plans, setPlans] = useState<StakingPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [currency, setCurrency] = useState<CurrencySettings>({ symbol: '$', position: 'left' });
  const [template, setTemplate] = useState<StakingTemplate | null>(null);

  useEffect(() => {
    const fetchPlans = async () => {
      if (!db) {
        setLoading(false);
        return;
      }
      try {
        const currencyDoc = await getDoc(doc(db, "settings", "currency"));
        if (currencyDoc.exists()) {
          setCurrency(currencyDoc.data() as CurrencySettings);
        }
        
        const templateDoc = await getDoc(doc(db, "settings", "stakingTemplate"));
        if (templateDoc.exists()) {
            setTemplate(templateDoc.data() as StakingTemplate);
        }

        const q = query(collection(db, "stakingPlans"), where("status", "==", "active"));
        const querySnapshot = await getDocs(q);
        const plansData = querySnapshot.docs
            .map(doc => ({ id: doc.id, ...(doc.data() as any) }))
            .sort((a, b) => (a as any).createdAt.seconds - (b as any).createdAt.seconds) as StakingPlan[];
        
        setPlans(plansData);
      } catch (error) {
        console.error("Error fetching staking plans: ", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPlans();
  }, [user]);
  
  const formatCurrency = (amount: number) => {
    const value = amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2});
    return currency.position === 'left' ? `${currency.symbol}${value}` : `${value}${currency.symbol}`;
  }

  const handleInvestClick = (plan: StakingPlan) => {
      router.push(`/dashboard/staking/invest/${plan.id}`);
  }
  
  if (loading || !template) {
    return (
        <DashboardLayout>
            <div className="flex justify-center items-center p-16">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
            <h1 className="text-3xl font-bold font-headline tracking-tight">Staking Plans</h1>
            <p className="text-muted-foreground">Stake your assets for a fixed term to earn rewards.</p>
        </div>
        
        {plans.length === 0 ? (
             <div className="flex justify-center items-center p-16 bg-card/50 rounded-lg">
                <p className="text-muted-foreground">No staking plans are available at the moment.</p>
            </div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 justify-center">
                {plans.map((plan) => {
                    const backgroundStyle = template.cardBackgroundColor2 
                        ? { background: `linear-gradient(to bottom right, ${template.cardBackgroundColor}, ${template.cardBackgroundColor2})` }
                        : { backgroundColor: template.cardBackgroundColor };
                    
                    return (
                        <div key={plan.id} style={backgroundStyle} className="rounded-lg flex flex-col border border-border/50">
                            <div className="relative h-40 w-full">
                                {plan.imageUrl && (
                                    <Image src={plan.imageUrl} alt={plan.planName} layout="fill" objectFit="cover" className="rounded-t-lg"/>
                                )}
                                <div 
                                    className="absolute top-4 right-4 px-3 py-1 rounded-md" 
                                    style={{backgroundColor: template.durationBackgroundColor || 'rgba(0,0,0,0.5)'}}
                                >
                                    <p className="text-sm font-semibold" style={{color: template.durationColor}}>{plan.durationDays} Days</p>
                                </div>
                            </div>

                            {/* This div is the key to correct positioning */}
                            <div className="relative h-12">
                                <div 
                                    className="absolute left-1/2 -translate-x-1/2 -top-12 h-24 w-24 rounded-full flex items-center justify-center border-4"
                                    style={{
                                        backgroundColor: template.returnPercentageBackgroundColor || 'rgba(0,0,0,0.3)',
                                        borderColor: template.cardBackgroundColor
                                    }}
                                >
                                    <p className="text-4xl font-bold" style={{color: template.returnPercentageColor}}>
                                        {plan.returnPercentage}<span className="text-2xl">%</span>
                                    </p>
                                </div>
                            </div>
                            
                            <div className="p-6 pt-0 flex-grow flex flex-col" style={{color: template.cardTextColor}}>
                                <div className="text-center mb-4">
                                    <h3 className="text-2xl font-bold font-headline" style={{color: template.planNameColor}}>{plan.planName}</h3>
                                    <p style={{color: template.durationColor}} className="text-sm mt-1">Total Return in {plan.durationDays} Days</p>
                                </div>
                                
                                <div className="space-y-4 flex-grow mb-6">
                                    <div className="flex justify-between items-center text-sm py-3 border-y" style={{borderColor: 'rgba(255,255,255,0.1)'}}>
                                        <span style={{color: template.detailsLabelColor}}>Staking Period</span>
                                        <span className="font-semibold" style={{color: template.detailsValueColor}}>{plan.durationDays} Days</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm pb-3 border-b" style={{borderColor: 'rgba(255,255,255,0.1)'}}>
                                        <span style={{color: template.detailsLabelColor}}>Capital Back</span>
                                        <Badge style={{backgroundColor: template.badgeBackgroundColor, color: template.badgeTextColor}}>{plan.capitalBack ? "Yes" : "No"}</Badge>
                                    </div>
                                    <div className="flex justify-between items-center text-sm pb-3 border-b" style={{borderColor: 'rgba(255,255,255,0.1)'}}>
                                        <span style={{color: template.detailsLabelColor}}>Min Stake</span>
                                        <span className="font-semibold" style={{color: template.detailsValueColor}}>{formatCurrency(plan.minAmount)}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm pb-3 border-b" style={{borderColor: 'rgba(255,255,255,0.1)'}}>
                                        <span style={{color: template.detailsLabelColor}}>Max Stake</span>
                                        <span className="font-semibold" style={{color: template.detailsValueColor}}>{formatCurrency(plan.maxAmount)}</span>
                                    </div>
                                </div>

                                <Button className="w-full mt-auto" onClick={() => handleInvestClick(plan)} style={{backgroundColor: template.buttonBackgroundColor, color: template.buttonTextColor}}>
                                   Stake Now
                                </Button>
                            </div>
                        </div>
                    )
                })}
            </div>
        )}
      </div>
    </DashboardLayout>
  );
}
