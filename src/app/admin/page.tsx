
"use client";

import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import React, { useEffect, useState, useMemo } from "react";
import { AdminLayout } from "@/components/layout/admin-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ExternalLink, Wallet, LayoutTemplate, DollarSign, Users, TrendingUp, TrendingDown, Package, Gift, HandCoins, ArrowUp, ArrowDown, Banknote, Star } from "lucide-react";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, Timestamp, orderBy, limit, doc, getDoc } from 'firebase/firestore';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { addDays, startOfDay, format } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Preloader } from '@/components/ui/preloader';

interface Transaction {
    type: 'deposit' | 'withdraw' | 'investment' | 'bonus' | 'referral' | 'return';
    amount: number;
    date: Date;
    userEmail?: string;
    status?: 'completed' | 'pending' | 'rejected';
}

interface CurrencySettings {
  symbol: string;
  position: 'left' | 'right';
}

export default function AdminDashboardPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        totalDeposits: 0,
        totalWithdrawals: 0,
        totalInvestments: 0,
        totalReturns: 0,
        totalBonus: 0,
        totalReferralCommissions: 0,
        deposits24h: 0,
        withdrawals24h: 0,
        investments24h: 0,
        bonus24h: 0,
        referralCommissions24h: 0,
        totalUsers: 0,
        newUsers24h: 0,
    });
    const [chartData, setChartData] = useState<any[]>([]);
    const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
    const [currency, setCurrency] = useState<CurrencySettings>({ symbol: '$', position: 'left' });


    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/admin/login');
        } else if (user) {
            fetchData();
        }
    }, [user, authLoading, router]);
    
    const fetchData = async () => {
        if (!db) { setLoading(false); return; }
        setLoading(true);

        try {
            const currencyDoc = await getDoc(doc(db, "settings", "currency"));
            if (currencyDoc.exists()) {
              setCurrency(currencyDoc.data() as CurrencySettings);
            }

            const now = new Date();
            const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            
            // --- Fetch all data for stats ---
            const depositsSnapshot = await getDocs(query(collection(db, "deposits"), where('status', '==', 'completed')));
            const withdrawalsSnapshot = await getDocs(query(collection(db, "withdrawals"), where('status', '==', 'completed')));
            const investmentsSnapshot = await getDocs(collection(db, "userInvestments"));
            const stakingSnapshot = await getDocs(collection(db, "userStakes"));
            const poolSnapshot = await getDocs(collection(db, "userPoolInvestments"));
            const bonusSnapshot = await getDocs(collection(db, "bonusTransactions"));
            const commissionSnapshot = await getDocs(collection(db, "referralCommissions"));
            const investmentTxSnapshot = await getDocs(query(collection(db, "investmentTransactions"), where("type", "in", ["Profit Return (Auto)", "Profit Return (Manual)"])));
            const completedStakesSnapshot = await getDocs(query(collection(db, "userStakes"), where("status", "==", "completed")));
            const completedPoolsSnapshot = await getDocs(query(collection(db, "userPoolInvestments"), where("status", "==", "completed")));

            const usersSnapshot = await getDocs(collection(db, 'users'));
            const usersMap = new Map(usersSnapshot.docs.map(doc => [doc.id, doc.data().email]));
            const totalUsers = usersSnapshot.size;
            const newUsers24h = usersSnapshot.docs.filter(doc => doc.data().createdAt && doc.data().createdAt.toDate() > twentyFourHoursAgo).length;

            // --- Process All-Time and 24h Stats ---
            let totalDeposits = 0, totalWithdrawals = 0, totalInvestments = 0, totalBonus = 0, totalReferralCommissions = 0, totalReturns = 0;
            let deposits24h = 0, withdrawals24h = 0, investments24h = 0, bonus24h = 0, referralCommissions24h = 0;

            const allTransactions: Transaction[] = [];

            depositsSnapshot.forEach(doc => {
                const data = doc.data();
                totalDeposits += data.amount;
                if(data.createdAt.toDate() > twentyFourHoursAgo) deposits24h += data.amount;
                allTransactions.push({type: 'deposit', amount: data.amount, date: data.createdAt.toDate(), userEmail: usersMap.get(data.userId), status: data.status });
            });
            withdrawalsSnapshot.forEach(doc => {
                const data = doc.data();
                totalWithdrawals += data.amount;
                if(data.createdAt.toDate() > twentyFourHoursAgo) withdrawals24h += data.amount;
                allTransactions.push({type: 'withdraw', amount: data.amount, date: data.createdAt.toDate(), userEmail: usersMap.get(data.userId), status: data.status });
            });
            investmentsSnapshot.forEach(doc => {
                const data = doc.data();
                totalInvestments += data.amount;
                if(data.startDate.toDate() > twentyFourHoursAgo) investments24h += data.amount;
                allTransactions.push({type: 'investment', amount: data.amount, date: data.startDate.toDate(), userEmail: usersMap.get(data.userId) });
            });
             stakingSnapshot.forEach(doc => {
                const data = doc.data();
                totalInvestments += data.amount;
                if(data.startDate.toDate() > twentyFourHoursAgo) investments24h += data.amount;
                 allTransactions.push({type: 'investment', amount: data.amount, date: data.startDate.toDate(), userEmail: usersMap.get(data.userId) });
            });
             poolSnapshot.forEach(doc => {
                const data = doc.data();
                totalInvestments += data.amount;
                if(data.investedAt.toDate() > twentyFourHoursAgo) investments24h += data.amount;
                 allTransactions.push({type: 'investment', amount: data.amount, date: data.investedAt.toDate(), userEmail: usersMap.get(data.userId) });
            });
            bonusSnapshot.forEach(doc => {
                const data = doc.data();
                totalBonus += data.amount;
                if(data.date.toDate() > twentyFourHoursAgo) bonus24h += data.amount;
                allTransactions.push({type: 'bonus', amount: data.amount, date: data.date.toDate(), userEmail: usersMap.get(data.userId) });
            });
            commissionSnapshot.forEach(doc => {
                const data = doc.data();
                totalReferralCommissions += data.amount;
                if(data.date.toDate() > twentyFourHoursAgo) referralCommissions24h += data.amount;
                allTransactions.push({type: 'referral', amount: data.amount, date: data.date.toDate(), userEmail: usersMap.get(data.userId) });
            });
             investmentTxSnapshot.forEach(doc => {
                const data = doc.data();
                totalReturns += data.amount;
                allTransactions.push({type: 'return', amount: data.amount, date: data.date.toDate(), userEmail: usersMap.get(data.userId) });
            });
            completedStakesSnapshot.forEach(doc => {
                const data = doc.data();
                const profit = data.amount * data.returnPercentage / 100;
                totalReturns += profit;
                allTransactions.push({type: 'return', amount: profit, date: data.endDate.toDate(), userEmail: usersMap.get(data.userId) });
            });
            completedPoolsSnapshot.forEach(doc => {
                const data = doc.data();
                const profit = data.returnAmount || 0;
                totalReturns += profit;
                allTransactions.push({type: 'return', amount: profit, date: new Date(data.returnDate), userEmail: usersMap.get(data.userId) });
            });


            setStats({
                totalDeposits, totalWithdrawals, totalInvestments, totalReturns, totalBonus, totalReferralCommissions,
                deposits24h, withdrawals24h, investments24h, bonus24h, referralCommissions24h,
                totalUsers, newUsers24h
            });

            setRecentTransactions(allTransactions.sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 10));

            // --- Process Chart Data ---
            const thirtyDaysAgo = startOfDay(addDays(now, -29));
            const dailyData: { [key: string]: any } = {};

            for (let i = 0; i < 30; i++) {
                const date = format(addDays(thirtyDaysAgo, i), 'yyyy-MM-dd');
                dailyData[date] = { 
                    date: format(new Date(date), 'MMM d'), 
                    investment: 0, 
                    pool: 0, 
                    staking: 0, 
                    deposit: 0, 
                    withdraw: 0, 
                    'referral commissions': 0, 
                    bonus: 0, 
                    'investment return': 0, 
                    'staking return': 0, 
                    'pool return': 0 
                };
            }

            const aggregate = (docs: any[], amountField: string, dateField: string, key: string, isTimestamp = true) => {
                docs.forEach(doc => {
                    const data = doc.data();
                    const date = isTimestamp ? data[dateField]?.toDate() : new Date(data[dateField]);
                    if (date && date >= thirtyDaysAgo) {
                        const dateStr = format(startOfDay(date), 'yyyy-MM-dd');
                        if (dailyData[dateStr]) {
                            dailyData[dateStr][key] = (dailyData[dateStr][key] || 0) + (data[amountField] || 0);
                        }
                    }
                });
            };
            
            aggregate(depositsSnapshot.docs, 'amount', 'createdAt', 'deposit');
            aggregate(withdrawalsSnapshot.docs, 'amount', 'createdAt', 'withdraw');
            aggregate(investmentsSnapshot.docs, 'amount', 'startDate', 'investment');
            aggregate(stakingSnapshot.docs, 'amount', 'startDate', 'staking');
            aggregate(poolSnapshot.docs, 'amount', 'investedAt', 'pool');
            aggregate(commissionSnapshot.docs, 'amount', 'date', 'referral commissions');
            aggregate(bonusSnapshot.docs, 'amount', 'date', 'bonus');
            aggregate(investmentTxSnapshot.docs, 'amount', 'date', 'investment return');

            completedStakesSnapshot.docs.forEach(doc => {
                const data = doc.data();
                const date = data.endDate?.toDate();
                if (date && date >= thirtyDaysAgo) {
                    const dateStr = format(startOfDay(date), 'yyyy-MM-dd');
                    if (dailyData[dateStr]) {
                        const profit = data.amount * data.returnPercentage / 100;
                        dailyData[dateStr]['staking return'] = (dailyData[dateStr]['staking return'] || 0) + profit;
                    }
                }
            });

            completedPoolsSnapshot.docs.forEach(doc => {
                const data = doc.data();
                const date = data.returnDate ? new Date(data.returnDate) : null;
                if (date && date >= thirtyDaysAgo) {
                    const dateStr = format(startOfDay(date), 'yyyy-MM-dd');
                    if (dailyData[dateStr]) {
                        dailyData[dateStr]['pool return'] = (dailyData[dateStr]['pool return'] || 0) + (data.returnAmount || 0);
                    }
                }
            });

            setChartData(Object.values(dailyData));

        } catch (error) {
            console.error("Error fetching dashboard data:", error);
        } finally {
            setLoading(false);
        }
    };
    
    const formatCurrency = (amount: number) => {
        const value = amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        return currency.position === 'left' ? `${currency.symbol}${value}` : `${value}${currency.symbol}`;
    };

    const StatCard = ({ title, value, icon, subValue }: { title: string, value: string, icon: React.ReactNode, subValue?: string }) => (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                {icon}
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{value}</div>
                {subValue && <p className="text-xs text-muted-foreground">{subValue}</p>}
            </CardContent>
        </Card>
    );

    if (authLoading || loading) {
        return (
            <AdminLayout>
                <div className="flex items-center justify-center min-h-[calc(100vh-8rem)]">
                    <Preloader />
                </div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout>
            <div className="flex flex-col gap-8">
                <div>
                    <h1 className="text-3xl font-bold font-headline tracking-tight">Admin Dashboard</h1>
                    <p className="text-muted-foreground">Welcome, {user?.email}</p>
                </div>

                 <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                    <StatCard title="Total Users" value={stats.totalUsers.toString()} icon={<Users className="h-5 w-5 text-muted-foreground" />} subValue={`${stats.newUsers24h} new users in last 24h`} />
                    <StatCard title="Total Deposits" value={formatCurrency(stats.totalDeposits)} icon={<ArrowDown className="h-5 w-5 text-green-500" />} />
                    <StatCard title="Total Withdrawals" value={formatCurrency(stats.totalWithdrawals)} icon={<ArrowUp className="h-5 w-5 text-red-500" />} />
                    <StatCard title="Total Investments" value={formatCurrency(stats.totalInvestments)} icon={<Banknote className="h-5 w-5 text-blue-500" />} />
                </div>
                
                <Card>
                    <CardHeader>
                        <CardTitle>Last 30 Days Activity</CardTitle>
                        <CardDescription>An overview of key platform activities.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[400px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="date" />
                                <YAxis tickFormatter={(val) => formatCurrency(val)} />
                                <Tooltip formatter={(val: number) => formatCurrency(val)} contentStyle={{ backgroundColor: 'hsl(var(--background))' }} />
                                <Legend />
                                <Line type="monotone" dataKey="investment" stroke="#8884d8" name="Investment" />
                                <Line type="monotone" dataKey="pool" stroke="#82ca9d" name="Pool" />
                                <Line type="monotone" dataKey="staking" stroke="#ffc658" name="Staking" />
                                <Line type="monotone" dataKey="deposit" stroke="#4ade80" name="Deposit" />
                                <Line type="monotone" dataKey="withdraw" stroke="#f87171" name="Withdraw" />
                                <Line type="monotone" dataKey="referral commissions" stroke="#fb923c" name="Referrals" />
                                <Line type="monotone" dataKey="bonus" stroke="#60a5fa" name="Bonus" />
                                <Line type="monotone" dataKey="investment return" stroke="#a78bfa" name="Inv. Return" />
                                <Line type="monotone" dataKey="staking return" stroke="#facc15" name="Staking Return" />
                                <Line type="monotone" dataKey="pool return" stroke="#38bdf8" name="Pool Return" />
                            </LineChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                 <div>
                    <h2 className="text-xl font-bold font-headline mb-4">Totals</h2>
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                        <StatCard title="Total Returns" value={formatCurrency(stats.totalReturns)} icon={<TrendingUp className="h-5 w-5 text-indigo-500" />} />
                        <StatCard title="Total Bonuses" value={formatCurrency(stats.totalBonus)} icon={<Gift className="h-5 w-5 text-yellow-500" />} />
                        <StatCard title="Total Referral Commissions" value={formatCurrency(stats.totalReferralCommissions)} icon={<HandCoins className="h-5 w-5 text-orange-500" />} />
                    </div>
                </div>
                
                <div>
                    <h2 className="text-xl font-bold font-headline mb-4">Last 24 Hours</h2>
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
                       <StatCard title="Deposits" value={formatCurrency(stats.deposits24h)} icon={<ArrowDown className="h-4 w-4 text-muted-foreground" />} />
                       <StatCard title="Withdrawals" value={formatCurrency(stats.withdrawals24h)} icon={<ArrowUp className="h-4 w-4 text-muted-foreground" />} />
                       <StatCard title="Investments" value={formatCurrency(stats.investments24h)} icon={<Banknote className="h-4 w-4 text-muted-foreground" />} />
                       <StatCard title="Bonuses" value={formatCurrency(stats.bonus24h)} icon={<Gift className="h-4 w-4 text-muted-foreground" />} />
                       <StatCard title="Referral Commissions" value={formatCurrency(stats.referralCommissions24h)} icon={<HandCoins className="h-4 w-4 text-muted-foreground" />} />
                    </div>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Recent Transactions</CardTitle>
                        <CardDescription>A log of the most recent platform activities.</CardDescription>
                    </CardHeader>
                    <CardContent>
                         <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>User</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Amount</TableHead>
                                    <TableHead>Date</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {recentTransactions.map((tx, index) => (
                                <TableRow key={index}>
                                    <TableCell className="font-medium">{tx.userEmail || 'N/A'}</TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className="capitalize">{tx.type}</Badge>
                                    </TableCell>
                                    <TableCell className={cn(tx.type === 'deposit' || tx.type === 'bonus' || tx.type === 'referral' || tx.type === 'return' ? 'text-green-500' : 'text-red-500')}>
                                        {formatCurrency(tx.amount)}
                                    </TableCell>
                                    <TableCell>{format(tx.date, 'PPp')}</TableCell>
                                </TableRow>
                                ))}
                            </TableBody>
                         </Table>
                    </CardContent>
                </Card>
            </div>
        </AdminLayout>
    );
}
