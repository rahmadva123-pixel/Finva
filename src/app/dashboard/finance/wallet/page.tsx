

"use client";

import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FinancialStatCard } from '@/components/ui/financial-stat-card';
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import { collection, doc, getDoc, onSnapshot, query, where, getDocs, orderBy, limit } from "firebase/firestore";
import React, { useEffect, useState, useMemo } from 'react';
import { Loader2, ArrowUp, ArrowDown, Wallet, TrendingUp, Banknote } from "lucide-react";
import { Bar, BarChart, Cell, Line, LineChart, ResponsiveContainer, Tooltip, Legend, XAxis, YAxis, CartesianGrid } from "recharts";
import { ChartConfig, ChartContainer } from "@/components/ui/chart";
import { addDays, format, startOfDay } from 'date-fns';

interface CurrencySettings {
  symbol: string;
  position: 'left' | 'right';
}

interface NavItem {
  key: 'investment' | 'staking' | 'finance' | 'referral' | 'bonus' | 'pool';
  enabled: boolean;
  label: string;
}

const defaultNavItems: NavItem[] = [
  { key: 'investment', enabled: true, label: 'Investment' },
  { key: 'staking', enabled: true, label: 'Staking' },
  { key: 'pool', enabled: true, label: 'Pool' },
  { key: 'finance', enabled: true, label: 'Finance' },
  { key: 'referral', enabled: true, label: 'Referral' },
  { key: 'bonus', enabled: true, label: 'Bonus' },
];

interface WalletPageConfig {
    investmentsChartColor1: string;
    investmentsChartColor2: string;
    investmentsChartColor3: string;
    returnsChartColor1: string;
    returnsChartColor2: string;
    returnsChartColor3: string;
    referralChartColor: string;
    bonusChartColor: string;
    depositsLineColor: string;
    investmentsLineColor: string;
    stakingLineColor: string;
    poolLineColor: string;
    investmentReturnLineColor: string;
    stakingReturnLineColor: string;
    poolReturnLineColor: string;
}

interface DailyData {
    name: string;
    Referral: number;
    Bonus: number;
    Deposits: number;
    Investments: number;
    Staking: number;
    Pool: number;
    'Inv. Return': number;
    'Staking Return': number;
    'Pool Return': number;
}

// Use `FinancialStatCard` for consistent trading-style stat presentation

const ChartCard = ({ title, data, currency, chartConfig, type = 'bar', description, loading, headerContent }: { title: string, data: any[], currency?: CurrencySettings, chartConfig: ChartConfig, type?: 'bar' | 'line', description?: React.ReactNode, loading: boolean, headerContent?: React.ReactNode }) => {
    
    const formatCurrency = (amount: number) => {
        if (!currency) return String(amount);
        const value = amount.toFixed(2);
        return currency.position === 'left' ? `${currency.symbol}${value}` : `${value}${currency.symbol}`;
    }

    const total = useMemo(() => {
        if (!data || data.length === 0) return 0;
        if (type === 'bar') {
            return data.reduce((acc, item) => acc + item.value, 0);
        }
        return data.reduce((acc, day) => {
            return acc + Object.keys(day).filter(key => key !== 'name').reduce((dayTotal, key) => dayTotal + day[key], 0);
        }, 0);
    }, [data, type]);
    
    if (loading) {
        return (
             <Card className="bg-card/50 border-border/50">
                <CardHeader>
                    <CardTitle>{title}</CardTitle>
                </CardHeader>
                <CardContent className="h-[250px] w-full flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin" />
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className="bg-card/50 border-border/50">
            <CardHeader>
                <CardTitle>{title}</CardTitle>
                {headerContent ? <div className="text-2xl font-bold">{headerContent}</div> : (
                    <CardDescription className="text-2xl font-bold">
                        {description || (currency ? `Total: ${formatCurrency(total)}` : `Total: ${total}`)}
                    </CardDescription>
                )}
            </CardHeader>
            <CardContent>
                <ChartContainer config={chartConfig} className="h-[250px] w-full">
                    {type === 'bar' ? (
                    <ResponsiveContainer>
                        <BarChart data={data}>
                            <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                            <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${currency?.symbol || ''}${value}`} />
                            <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }} formatter={(value: number) => currency ? formatCurrency(value) : value} />
                            <Bar dataKey="value" radius={8}>
                               {data.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                               ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                    ) : (
                    <ResponsiveContainer>
                        <LineChart data={data}>
                            <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                            <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${currency?.symbol || ''}${value}`} />
                            <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }} formatter={(value: number) => currency ? formatCurrency(value) : value} />
                            <Legend />
                             {Object.keys(chartConfig).map(key => (
                                <Line key={key} type="monotone" dataKey={key} name={chartConfig[key]?.label as string} stroke={chartConfig[key]?.color || '#8884d8'} strokeWidth={2} dot={{r: 4}} activeDot={{r: 8}} />
                            ))}
                        </LineChart>
                    </ResponsiveContainer>
                    )}
                </ChartContainer>
            </CardContent>
        </Card>
    );
};


export default function WalletPage() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        mainWallet: 0,
        totalEarning: 0,
        approvedDeposits: 0,
        totalInvestment: 0,
        totalStaking: 0,
        totalPool: 0,
        totalRefCommission: 0,
        totalInvestmentReturn: 0,
        totalStakingReturn: 0,
        totalPoolReturn: 0,
        totalBonus: 0,
    });
    const [currency, setCurrency] = useState<CurrencySettings | undefined>(undefined);
    const [walletConfig, setWalletConfig] = useState<WalletPageConfig | null>(null);
    const [chartColors, setChartColors] = useState<any>({});
    const [dailyChartData, setDailyChartData] = useState<DailyData[]>([]);
    const [navItems, setNavItems] = useState<NavItem[]>(defaultNavItems);
    const [pnlData, setPnlData] = useState({ pnl24h: 0, percentageChange: 0, isLoading: true });


    useEffect(() => {
        if (!user || !db) {
            setLoading(false);
            return;
        }

        const fetchData = async () => {
            try {
                const currencyDoc = await getDoc(doc(db, "settings", "currency"));
                if (currencyDoc.exists()) setCurrency(currencyDoc.data() as CurrencySettings);
                
                const navSettingsDoc = await getDoc(doc(db, "settings", "navigation"));
                if(navSettingsDoc.exists() && navSettingsDoc.data().items) {
                    setNavItems(navSettingsDoc.data().items as NavItem[]);
                }

                const templateDoc = await getDoc(doc(db, "template", "landingPage"));
                if (templateDoc.exists()) {
                    const data = templateDoc.data();
                    setWalletConfig(data.walletPageConfig);
                    setChartColors(data.chartColors || {});
                }

                const userDocRef = doc(db, "users", user.uid);
                const userDoc = await getDoc(userDocRef);
                const mainWallet = userDoc.exists() ? userDoc.data().balance : 0;
                
                const fifteenDaysAgo = startOfDay(addDays(new Date(), -15));
                
                const depositsQuery = query(collection(db, "deposits"), where("userId", "==", user.uid), where('status', '==', 'completed'));
                const depositsSnapshot = await getDocs(depositsQuery);
                const deposits = depositsSnapshot.docs.map(d => ({...(d.data() as any), id: d.id, date: d.data().createdAt.toDate() }));
                const approvedDeposits = deposits.reduce((sum, doc) => sum + ((doc as any).amount || 0), 0);

                const investmentsQuery = query(collection(db, "userInvestments"), where("userId", "==", user.uid));
                const investmentsSnapshot = await getDocs(investmentsQuery);
                const investments = investmentsSnapshot.docs.map(d => ({...(d.data() as any), id: d.id, date: d.data().startDate.toDate() }));
                const totalInvestment = investments.reduce((sum, doc) => sum + ((doc as any).amount || 0), 0);

                const stakingQuery = query(collection(db, "userStakes"), where("userId", "==", user.uid));
                const stakingSnapshot = await getDocs(stakingQuery);
                const stakes = stakingSnapshot.docs.map(d => ({...(d.data() as any), id: d.id, date: d.data().startDate.toDate() }));
                const totalStaking = stakes.reduce((sum, doc) => sum + ((doc as any).amount || 0), 0);

                const poolQuery = query(collection(db, "userPoolInvestments"), where("userId", "==", user.uid));
                const poolSnapshot = await getDocs(poolQuery);
                const pools = poolSnapshot.docs.map(d => ({...(d.data() as any), id: d.id, date: d.data().investedAt.toDate() }));
                const totalPool = pools.reduce((sum, doc) => sum + ((doc as any).amount || 0), 0);

                const investmentTxQuery = query(collection(db, "investmentTransactions"), where("userId", "==", user.uid), where("type", "in", ["Profit Return (Auto)", "Profit Return (Manual)"]));
                const investmentTxSnapshot = await getDocs(investmentTxQuery);
                const investmentReturns = investmentTxSnapshot.docs.map(d => ({...(d.data() as any), id: d.id, date: d.data().date.toDate() }));
                const totalInvestmentReturn = investmentReturns.reduce((sum, doc) => sum + ((doc as any).amount || 0), 0);
                
                const completedStakesQuery = query(collection(db, "userStakes"), where("userId", "==", user.uid), where("status", "==", "completed"));
                const completedStakesSnapshot = await getDocs(completedStakesQuery);
                const stakingReturns = completedStakesSnapshot.docs.map(s => ({amount: s.data().amount * s.data().returnPercentage / 100, date: s.data().endDate.toDate()}));
                const totalStakingReturn = stakingReturns.reduce((sum, s) => sum + s.amount, 0);
                
                const completedPoolsQuery = query(collection(db, "userPoolInvestments"), where("userId", "==", user.uid), where("status", "==", "completed"));
                const completedPoolsSnapshot = await getDocs(completedPoolsQuery);
                const poolReturns = completedPoolsSnapshot.docs.map(p => {
                    const data = p.data();
                    return { 
                        returnAmount: data.returnAmount || 0, 
                        investedAmount: data.amount || 0,
                        date: data.returnDate ? new Date(data.returnDate) : new Date() 
                    }
                });
                const totalPoolReturn = poolReturns.reduce((sum, item) => sum + Math.max(0, item.returnAmount - item.investedAmount), 0);
                
                 const bonusQuery = query(collection(db, "bonusTransactions"), where("userId", "==", user.uid));
                const bonusSnapshot = await getDocs(bonusQuery);
                const bonuses = bonusSnapshot.docs.map(d => ({...(d.data() as any), id: d.id, date: d.data().date.toDate()}));
                const totalBonus = bonuses.reduce((sum, doc) => sum + ((doc as any).amount || 0), 0);

                const commissionsQuery = query(collection(db, "referralCommissions"), where("referrerId", "==", user.uid));
                const commissionsSnapshot = await getDocs(commissionsQuery);
                const allCommissions = commissionsSnapshot.docs.map(d => ({...(d.data() as any), id: d.id, date: d.data().date.toDate()}));
                const totalRefCommission = allCommissions.reduce((sum, c) => sum + ((c as any).amount || 0), 0);
                
                const calculatedTotalEarning = totalInvestmentReturn + totalStakingReturn + totalPoolReturn + totalBonus + totalRefCommission;

                setStats({
                    mainWallet,
                    totalEarning: calculatedTotalEarning,
                    approvedDeposits,
                    totalInvestment,
                    totalStaking,
                    totalPool,
                    totalRefCommission,
                    totalInvestmentReturn,
                    totalStakingReturn,
                    totalPoolReturn,
                    totalBonus
                });

                const dailyDataMap = new Map<string, DailyData>();

                for (let i = 0; i < 15; i++) {
                    const date = startOfDay(addDays(new Date(), -(14 - i)));
                    const dayKey = format(date, 'MMM d');
                    dailyDataMap.set(dayKey, { name: dayKey, Referral: 0, Bonus: 0, Deposits: 0, Investments: 0, Staking: 0, Pool: 0, 'Inv. Return': 0, 'Staking Return': 0, 'Pool Return': 0 });
                }

                const processItems = (items: any[], key: keyof DailyData) => {
                    items.forEach(item => {
                        if (item.date && item.date >= fifteenDaysAgo) {
                            const dayKey = format(startOfDay(item.date), 'MMM d');
                            const dayData = dailyDataMap.get(dayKey);
                            if (dayData) {
                                (dayData[key] as number) += item.amount;
                            }
                        }
                    });
                };
                
                processItems(allCommissions, 'Referral');
                processItems(bonuses, 'Bonus');
                processItems(deposits, 'Deposits');
                processItems(investments, 'Investments');
                processItems(stakes, 'Staking');
                processItems(pools, 'Pool');
                processItems(investmentReturns, 'Inv. Return');
                processItems(stakingReturns, 'Staking Return');
                processItems(poolReturns.map(pr => ({ amount: Math.max(0, pr.returnAmount - pr.investedAmount), date: pr.date })), 'Pool Return');
                
                const dailyData = Array.from(dailyDataMap.values());
                setDailyChartData(dailyData);

                // PNL Calculation
                const now = new Date();
                const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                const prev48h = new Date(now.getTime() - 48 * 60 * 60 * 1000);

                let earningsLast24h = 0;
                let earningsPrev24h = 0;
                
                const allEarningsSources = [...investmentReturns, ...stakingReturns, ...poolReturns.map(pr => ({ amount: Math.max(0, pr.returnAmount - pr.investedAmount), date: pr.date })), ...bonuses, ...allCommissions];

                allEarningsSources.forEach(item => {
                    if (item.date >= last24h) {
                        earningsLast24h += item.amount;
                    } else if (item.date >= prev48h) {
                        earningsPrev24h += item.amount;
                    }
                });

                const percentageChange = earningsPrev24h > 0 ? ((earningsLast24h - earningsPrev24h) / earningsPrev24h) * 100 : (earningsLast24h > 0 ? 100 : 0);
                setPnlData({ pnl24h: earningsLast24h, percentageChange, isLoading: false });

            } catch (error) {
                console.error("Error fetching wallet data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [user]);
    
    const isNavEnabled = (key: NavItem['key']) => (navItems || []).find(item => item.key === key)?.enabled ?? true;


    const investmentsChartData = useMemo(() => {
        const data = [];
        if(isNavEnabled('investment')) data.push({ name: 'Investment', value: stats.totalInvestment, color: walletConfig?.investmentsChartColor1 || '#8b5cf6' });
        if(isNavEnabled('staking')) data.push({ name: 'Staking', value: stats.totalStaking, color: walletConfig?.investmentsChartColor2 || '#f59e0b' });
        if(isNavEnabled('pool')) data.push({ name: 'Pool', value: stats.totalPool, color: walletConfig?.investmentsChartColor3 || '#0ea5e9' });
        return data;
    }, [stats, walletConfig, navItems]);
    
    const returnsChartData = useMemo(() => {
        const data = [];
        if(isNavEnabled('investment')) data.push({ name: 'Investment', value: stats.totalInvestmentReturn, color: walletConfig?.returnsChartColor1 || '#8b5cf6' });
        if(isNavEnabled('staking')) data.push({ name: 'Staking', value: stats.totalStakingReturn, color: walletConfig?.returnsChartColor2 || '#f59e0b' });
        if(isNavEnabled('pool')) data.push({ name: 'Pool', value: stats.totalPoolReturn, color: walletConfig?.returnsChartColor3 || '#ec4899' });
        return data;
    }, [stats, walletConfig, navItems]);
    
    const earningChartData = useMemo(() => {
        const data = [];
        if(isNavEnabled('investment')) data.push({ name: "Investment", value: stats.totalInvestmentReturn, color: chartColors.investment });
        if(isNavEnabled('staking')) data.push({ name: "Staking", value: stats.totalStakingReturn, color: chartColors.staking });
        if(isNavEnabled('pool')) data.push({ name: "Pool", value: stats.totalPoolReturn, color: chartColors.pool });
        if(isNavEnabled('referral')) data.push({ name: "Referral", value: stats.totalRefCommission, color: chartColors.referral });
        if(isNavEnabled('bonus')) data.push({ name: "Bonus", value: stats.totalBonus, color: chartColors.bonus });
        return data;
    }, [stats, chartColors, navItems]);

    const dailyChartConfig = useMemo(() => {
        const config: ChartConfig = {};
        if (isNavEnabled('referral')) config['Referral'] = { label: "Referral", color: walletConfig?.referralChartColor };
        if (isNavEnabled('bonus')) config['Bonus'] = { label: "Bonus", color: walletConfig?.bonusChartColor };
        if (isNavEnabled('finance')) config['Deposits'] = { label: "Deposits", color: walletConfig?.depositsLineColor };
        if (isNavEnabled('investment')) {
            config['Investments'] = { label: "Investments", color: walletConfig?.investmentsLineColor };
            config['Inv. Return'] = { label: "Inv. Return", color: walletConfig?.investmentReturnLineColor };
        }
        if (isNavEnabled('staking')) {
            config['Staking'] = { label: "Staking", color: walletConfig?.stakingLineColor };
            config['Staking Return'] = { label: "Staking Return", color: walletConfig?.stakingReturnLineColor };
        }
        if (isNavEnabled('pool')) {
            config['Pool'] = { label: "Pool", color: walletConfig?.poolLineColor };
            config['Pool Return'] = { label: "Pool Return", color: walletConfig?.poolReturnLineColor };
        }
        return config;
    }, [navItems, walletConfig]);

    const formatCurrency = (value: number) => {
        if (!currency) return `${value}`;
        const amount = value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        return currency.position === 'left' ? `${currency.symbol}${amount}` : `${amount}${currency.symbol}`;
    };

    return (
        <DashboardLayout>
            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold font-headline tracking-tight">Wallet Overview & Statistics</h1>
                    <p className="text-muted-foreground">A detailed overview of your balances, investments, and earnings.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <FinancialStatCard title="Main Wallet" value={formatCurrency(stats.mainWallet)} hint="Available balance" />
                    <FinancialStatCard title="Total Earnings" value={formatCurrency(stats.totalEarning)} hint="All sources" />
                    <FinancialStatCard title="Total Deposits" value={formatCurrency(stats.approvedDeposits)} hint="Completed deposits" />
                    <FinancialStatCard title="Today's PNL" value={`${pnlData.pnl24h >= 0 ? '+' : ''}${formatCurrency(pnlData.pnl24h)}`} hint={`${pnlData.percentageChange >= 0 ? '+' : ''}${Math.abs(pnlData.percentageChange).toFixed(2)}% vs yesterday`} />
                </div>
                
                 <div className="grid grid-cols-1 gap-6">
                    <ChartCard 
                        title="Last 15 Days Activity" 
                        data={dailyChartData} 
                        currency={currency} 
                        chartConfig={dailyChartConfig} 
                        type="line"
                        loading={loading} 
                    />
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <ChartCard title="Total Earnings by Source" data={earningChartData} currency={currency} chartConfig={{}} loading={loading} />
                    <ChartCard title="Total Investments by Type" data={investmentsChartData} currency={currency} chartConfig={{}} loading={loading}/>
                </div>
                
                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <ChartCard title="Total Returns by Type" data={returnsChartData} currency={currency} chartConfig={{}} loading={loading}/>
                </div>

            </div>
        </DashboardLayout>
    );
}
