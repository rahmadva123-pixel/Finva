
"use client";

import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where, orderBy, doc, getDoc, writeBatch, serverTimestamp, addDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { CheckCircle, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import Image from "next/image";
import Link from 'next/link';


interface InvestmentPlan {
  id: string;
  planName: string;
  minAmount: number;
  maxAmount: number;
  investmentType: 'fixed' | 'range';
  interestRate: number;
  returnPeriod: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'lifetime';
  termDuration: number;
  capitalBack: boolean;
  featured: boolean;
  returnPayout: boolean;
  createdAt: any;
  blockedDays: string[];
  imageUrl?: string;
}

interface PlanFeature {
    id: string;
    label: string;
    key: 'interest' | 'capitalBack' | 'payout' | 'recurrence' | 'blockedDays' | 'claimNeeded' | 'minAmount' | 'maxAmount' | 'totalReturn';
}

interface InvestmentTemplate {
    id: string;
    name: string;
    active: boolean;
    cardBackgroundColor: string;
    cardBackgroundColor2?: string;
    cardBackgroundOverlayColor?: string;
    planNameColor: string;
    amountColor: string;
    featureTextColor: string;
    featureValueColor: string;
    separatorColor: string;
    buttonBackgroundColor: string;
    buttonTextColor: string;
    buttonText: string;
    featureBackgroundColor?: string;
    features: PlanFeature[];
}

export default function InvestmentPlanPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [plans, setPlans] = useState<InvestmentPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [currency, setCurrency] = useState<CurrencySettings>({ symbol: '$', position: 'left' });
  const [investmentTemplate, setInvestmentTemplate] = useState<InvestmentTemplate | null>(null);

  useEffect(() => {
    const fetchPlans = async () => {
      if (!db) {
        setLoading(false);
        return;
      }
      try {
        const templateDoc = await getDoc(doc(db, "settings", "investmentTemplates"));
        if (templateDoc.exists()) {
          const templates = templateDoc.data().templates as InvestmentTemplate[];
          setInvestmentTemplate(templates.find(t => t.active) || templates[0] || null);
        }

        const currencyDoc = await getDoc(doc(db, "settings", "currency"));
        if (currencyDoc.exists()) {
          setCurrency(currencyDoc.data() as CurrencySettings);
        }

        const q = query(
            collection(db, "investmentPlans"), 
            where("status", "==", "active")
        );
        const querySnapshot = await getDocs(q);
        const plansData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as InvestmentPlan[];
        
         plansData.sort((a, b) => {
            if (a.featured && !b.featured) return -1;
            if (!a.featured && b.featured) return 1;
            if (a.createdAt && b.createdAt) {
                return b.createdAt.seconds - a.createdAt.seconds;
            }
            return 0;
        });
        
        setPlans(plansData);
      } catch (error) {
        console.error("Error fetching investment plans: ", error);
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

  const handleInvestClick = (plan: InvestmentPlan) => {
      router.push(`/dashboard/investment/invest/${plan.id}`);
  }
  
  const getFeatureValue = (plan: InvestmentPlan, key: PlanFeature['key'], templateId: string = 'default') => {
      const isGreenPluss = templateId === 'green_pluss';

      switch(key) {
          case 'interest':
              return <span className="font-medium">{plan.interestRate}% {plan.returnPeriod.charAt(0).toUpperCase() + plan.returnPeriod.slice(1)}</span>
          case 'capitalBack':
             return plan.capitalBack ? (
                <Badge variant="outline" className={isGreenPluss ? "bg-green-500/10 text-green-400 border-none" : "text-green-500 border-green-500/50 bg-green-500/10"}>YES</Badge>
            ) : (
                 <Badge variant="outline" className={isGreenPluss ? "bg-red-500/10 text-red-400 border-none" : "text-red-500 border-red-500/50 bg-red-500/10"}>NO</Badge>
            )
          case 'payout':
          case 'claimNeeded':
            return <Badge variant="outline" className={isGreenPluss ? "bg-blue-500/10 text-blue-400 border-none" : "text-blue-500 border-blue-500/50 bg-blue-500/10"}>{plan.returnPayout ? 'Automatic' : 'Manual'}</Badge>
          case 'recurrence':
            return <Badge variant="outline" className={isGreenPluss ? "bg-yellow-500/10 text-yellow-400 border-none" : "text-yellow-500 border-yellow-500/50 bg-yellow-500/10"}>
                        {plan.termDuration === -1 ? 'Lifetime' : `${plan.termDuration} Times`}
                   </Badge>
          case 'blockedDays':
              if (plan.blockedDays && plan.blockedDays.length > 0) {
                  return <Badge variant="outline" className={isGreenPluss ? "bg-red-500/10 text-red-400 border-none" : "text-red-500 border-red-500/50 bg-red-500/10"}>{plan.blockedDays.join(', ')}</Badge>
              }
              return <Badge variant="outline" className={isGreenPluss ? "bg-green-500/10 text-green-400 border-none" : "text-green-500 border-green-500/50 bg-green-500/10"}>None</Badge>
          case 'minAmount':
              return <span>{formatCurrency(plan.minAmount)}</span>
          case 'maxAmount':
              return <span>{formatCurrency(plan.maxAmount)}</span>
          case 'totalReturn':
              const profitPerReturn = (plan.minAmount * plan.interestRate) / 100;
              const totalProfit = profitPerReturn * plan.termDuration;
              return <span>{formatCurrency(totalProfit)} + <Badge variant="default">Capital</Badge></span>
          default:
            return null;
      }
  }

  const renderDefaultTemplate = (plan: InvestmentPlan, tpl: InvestmentTemplate) => (
     <div 
        key={plan.id} 
        style={{ backgroundColor: tpl.cardBackgroundColor, position: 'relative' }}
        className={`p-6 rounded-2xl border ${plan.featured ? 'border-primary shadow-lg shadow-primary/20' : 'border-border/50'} flex flex-col`}
    >
        <div style={{ position: 'absolute', inset: 0, backgroundColor: tpl.cardBackgroundOverlayColor || 'transparent', borderRadius: 'inherit' }}></div>
        <div className="relative z-10 flex flex-col h-full">
            {plan.imageUrl && plan.imageUrl.trim() !== '' && (
                <div className="relative h-40 w-full mb-4 rounded-lg overflow-hidden">
                    <Image src={plan.imageUrl} alt={plan.planName} layout="fill" objectFit="cover" />
                </div>
            )}
            <div className="text-center mb-6">
                <h3 className="text-xl font-bold font-headline mb-2" style={{color: tpl.planNameColor}}>{plan.planName}</h3>
                <p className="text-2xl font-bold" style={{color: tpl.amountColor}}>
                    {plan.investmentType === 'range' ? `${formatCurrency(plan.minAmount)} - ${formatCurrency(plan.maxAmount)}` : formatCurrency(plan.minAmount)}
                </p>
            </div>
            
            <div className="space-y-4 flex-grow">
                 {tpl.features.map((feature, index) => (
                     <div key={index} className="space-y-4">
                        <div className="flex justify-between items-center text-sm">
                            <span style={{ color: tpl.featureTextColor }}>{feature.label}</span>
                            <div style={{ color: tpl.featureValueColor }}>{getFeatureValue(plan, feature.key)}</div>
                        </div>
                        {index < tpl.features.length - 1 && <div style={{height: '1px', backgroundColor: tpl.separatorColor}}></div>}
                     </div>
                 ))}
            </div>

            <Button 
                className="w-full mt-6" 
                onClick={() => handleInvestClick(plan)}
                style={{ backgroundColor: tpl.buttonBackgroundColor, color: tpl.buttonTextColor }}
            >
               {tpl.buttonText}
            </Button>
        </div>
    </div>
  );

  const renderGreenPlussTemplate = (plan: InvestmentPlan, tpl: InvestmentTemplate) => {
    const interestText = `${plan.interestRate}%`;
    const backgroundStyle = tpl.cardBackgroundColor2 
        ? { background: `linear-gradient(to bottom right, ${tpl.cardBackgroundColor}, ${tpl.cardBackgroundColor2})`, color: tpl.featureTextColor }
        : { backgroundColor: tpl.cardBackgroundColor, color: tpl.featureTextColor };

    return (
        <div 
            key={plan.id} 
            style={{...backgroundStyle, position: 'relative'}}
            className={`p-4 rounded-2xl border-2 ${plan.featured ? 'border-primary' : 'border-gray-800'} flex flex-col w-full max-w-sm mx-auto`}
        >
             <div style={{ position: 'absolute', inset: 0, backgroundColor: tpl.cardBackgroundOverlayColor || 'transparent', borderRadius: 'inherit' }}></div>
             <div className="relative z-10 flex flex-col h-full">
                <div className="text-center font-bold py-2 rounded-t-lg -mx-4 -mt-4 mb-4" style={{ backgroundColor: tpl.buttonBackgroundColor, color: tpl.buttonTextColor }}>
                    {plan.planName}
                </div>

                {plan.imageUrl && plan.imageUrl.trim() !== '' && (
                    <div className="relative h-40 w-full mb-4 rounded-lg overflow-hidden">
                        <Image src={plan.imageUrl} alt={plan.planName} layout="fill" objectFit="cover" />
                    </div>
                )}
                
                <div className="text-center my-4">
                    <div className="inline-block font-bold text-4xl px-4 py-2 rounded-lg" style={{ backgroundColor: tpl.buttonBackgroundColor, color: tpl.buttonTextColor }}>
                       {interestText}
                    </div>
                    <p className="text-lg mt-2 capitalize">{plan.returnPeriod}</p>
                </div>
                
                <div className="space-y-3 flex-grow mb-6">
                    {tpl.features.map((feature, index) => (
                        <div key={index} className="flex items-center gap-3 bg-gray-900/50 p-3 rounded-lg text-sm">
                            <CheckCircle className="h-5 w-5" style={{ color: tpl.buttonBackgroundColor }}/>
                            <span>{feature.label}</span>
                            <div className="font-bold ml-auto">{getFeatureValue(plan, feature.key, tpl.id)}</div>
                        </div>
                    ))}
                </div>

                <Button 
                    className="w-full mt-auto font-bold" 
                    asChild
                    style={{ backgroundColor: tpl.buttonBackgroundColor, color: tpl.buttonTextColor }}
                >
                   <Link href={`/dashboard/investment/invest/${plan.id}`}>{tpl.buttonText}</Link>
                </Button>
            </div>
        </div>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
            <h1 className="text-3xl font-bold font-headline tracking-tight">Investment Plans</h1>
            <p className="text-muted-foreground">Choose a plan that best fits your financial goals.</p>
        </div>
        
        {loading || !investmentTemplate ? (
            <div className="flex justify-center items-center p-16">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        ) : plans.length === 0 ? (
             <div className="flex justify-center items-center p-16 bg-card/50 rounded-lg">
                <p className="text-muted-foreground">No investment plans are available at the moment.</p>
            </div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6 justify-center">
                {plans.map((plan) => {
                    if (investmentTemplate.id === 'green_pluss') {
                        return renderGreenPlussTemplate(plan, investmentTemplate);
                    }
                    return renderDefaultTemplate(plan, investmentTemplate);
                })}
            </div>
        )}
      </div>
    </DashboardLayout>
  );
}

interface CurrencySettings {
  symbol: string;
  position: 'left' | 'right';
}
