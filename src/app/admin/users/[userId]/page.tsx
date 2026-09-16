
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { AdminLayout } from "@/components/layout/admin-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, getDoc, query, where, orderBy, runTransaction, updateDoc, serverTimestamp } from 'firebase/firestore';
import { Loader2, ArrowLeft, Download, CheckCircle, XCircle } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { format, differenceInSeconds } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import Papa from 'papaparse';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";


// Interfaces
interface User {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    username?: string;
    createdAt?: any;
    balance?: number;
    photoURL?: string;
}

interface CurrencySettings {
  symbol: string;
  position: 'left' | 'right';
}

interface Transaction {
    id: string;
    amount: number;
    title: string;
    type: 'deposit' | 'withdraw' | 'bonus' | 'investment' | 'send' | 'receive' | 'capital_back';
    status: 'pending' | 'completed' | 'rejected' | 'other';
    date: any;
    collection: 'deposits' | 'withdrawals' | 'bonusTransactions' | 'investmentTransactions' | 'transactions';
}

interface Investment {
    id: string;
    planName: string;
    amount: number;
    status: 'active' | 'completed';
    startDate: any;
    returnsCalculated: number;
    termDuration: number;
    returnPeriod: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'lifetime';
    nextReturnDate?: any;
    lastReturnDate?: any;
}

interface Staking {
    id: string;
    planName: string;
    amount: number;
    status: 'active' | 'completed' | 'cancelled';
    startDate: any;
    endDate: any;
}

interface Pool {
    id: string;
    poolName: string;
    amount: number;
    status: 'active' | 'completed';
    investedAt: any;
    returnAmount?: number;
}

const Countdown = ({ nextReturn, lastReturn }: { nextReturn?: any; lastReturn?: any }) => {
    const [timeLeft, setTimeLeft] = useState<string | null>(null);
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        if (!nextReturn?.seconds || !lastReturn?.seconds) {
            setTimeLeft(null);
            setProgress(100);
            return;
        };

        const nextReturnDate = new Date(nextReturn.seconds * 1000);
        const lastReturnDate = new Date(lastReturn.seconds * 1000);
        
        const totalDuration = differenceInSeconds(nextReturnDate, lastReturnDate);
        if (totalDuration <= 0) {
            setTimeLeft("Ready to claim");
            setProgress(100);
            return;
        }

        const timer = setInterval(() => {
            const now = new Date();
            const distance = differenceInSeconds(nextReturnDate, now);
            
            if (distance < 0) {
                setTimeLeft("Ready to claim");
                setProgress(100);
                clearInterval(timer);
                return;
            }

            const elapsedSeconds = differenceInSeconds(now, lastReturnDate);
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

    if (timeLeft === null && progress === 100) return null;

    return (
        <div className="text-xs font-mono text-muted-foreground mt-2 space-y-1">
            <Progress value={progress} className="h-1"/>
            <span>{timeLeft || "Ready to claim"}</span>
        </div>
    );
};

export default function UserDetailPage() {
  const { toast } = useToast();
    const { user: currentUser } = useAuth();
  const router = useRouter();
  const params = useParams();
  const userId = params.userId as string;

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [currency, setCurrency] = useState<CurrencySettings>({ symbol: '$', position: 'left' });
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [investments, setInvestments] = useState<{ active: Investment[], completed: Investment[] }>({ active: [], completed: [] });
  const [stakes, setStakes] = useState<{ active: Staking[], completed: Staking[] }>({ active: [], completed: [] });
  const [pools, setPools] = useState<{ active: Pool[], completed: Pool[] }>({ active: [], completed: [] });
  const [totalEarning, setTotalEarning] = useState(0);
        // per-user withdrawal fee overrides removed — platform enforces flat 20% fee
    const [withdrawAllowedWithoutReferral, setWithdrawAllowedWithoutReferral] = useState<boolean>(false);
    const [withdrawalFeePercent, setWithdrawalFeePercent] = useState<number | null>(null);
    const [logoUrl, setLogoUrl] = useState('');

  const formatCurrency = (amount: number) => {
    const value = (amount || 0).toFixed(2);
    return currency.position === 'left' ? `${currency.symbol}${value}` : `${value}${currency.symbol}`;
  }

  const fetchUserData = useCallback(async () => {
    if (!userId || !db) return;
    setLoading(true);
    try {
        const generalSettingsDoc = await getDoc(doc(db, 'settings', 'general'));
        if (generalSettingsDoc.exists()) {
            setLogoUrl(generalSettingsDoc.data().logoUrl || '');
        }

        const userDoc = await getDoc(doc(db, "users", userId));
        if (!userDoc.exists()) {
            toast({ variant: 'destructive', title: 'Error', description: 'User not found.' });
            router.push('/admin/users');
            return;
        }
        const userData = { id: userDoc.id, ...userDoc.data() } as User & { withdrawalFeePercent?: number };
        setUser(userData);
        setWithdrawalFeePercent(typeof userData.withdrawalFeePercent === 'number' ? userData.withdrawalFeePercent : null);

        const currencyDoc = await getDoc(doc(db, "settings", "currency"));
        if (currencyDoc.exists()) setCurrency(currencyDoc.data() as CurrencySettings);

        // Fetch Transactions
        const depositsQuery = query(collection(db, "deposits"), where("userId", "==", userId));
        const withdrawalsQuery = query(collection(db, "withdrawals"), where("userId", "==", userId));
        const bonusQuery = query(collection(db, "bonusTransactions"), where("userId", "==", userId));
        const investmentTxQuery = query(collection(db, "investmentTransactions"), where("userId", "==", userId));
        
        const [depositsSnap, withdrawalsSnap, bonusSnap, investmentTxSnap] = await Promise.all([
            getDocs(depositsQuery), getDocs(withdrawalsQuery), getDocs(bonusQuery), getDocs(investmentTxQuery)
        ]);
        
        const allTransactions: Transaction[] = [];
        let earnings = 0;
        depositsSnap.forEach(d => allTransactions.push({ id: d.id, ...d.data(), title: `Deposit via ${d.data().method}`, type: 'deposit', date: d.data().createdAt, collection: 'deposits' } as Transaction));
        withdrawalsSnap.forEach(d => allTransactions.push({ id: d.id, ...d.data(), title: `Withdrawal via ${d.data().method}`, type: 'withdraw', date: d.data().createdAt, collection: 'withdrawals' } as Transaction));
        bonusSnap.forEach(d => { 
            const data = d.data();
            allTransactions.push({ id: d.id, ...data, title: data.description, type: 'bonus', status: 'completed', date: data.date, collection: 'bonusTransactions' } as Transaction);
            earnings += data.amount;
        });
        investmentTxSnap.forEach(d => {
            const data = d.data();
            allTransactions.push({ id: d.id, ...data, title: `${data.type} from ${data.planName}`, type: data.type.includes('Capital') ? 'capital_back' : 'investment', status: data.status || 'completed', date: data.date, collection: 'investmentTransactions' } as Transaction);
            if (!data.type.includes('Capital')) earnings += data.amount;
        });
        setTransactions(allTransactions.sort((a,b) => b.date.seconds - a.date.seconds));
        
        // Fetch Investments
        const investmentsQuery = query(collection(db, 'userInvestments'), where('userId', '==', userId));
        const investmentsSnap = await getDocs(investmentsQuery);
        const allInvestments = investmentsSnap.docs.map(d => ({id: d.id, ...d.data()} as Investment));
        setInvestments({ active: allInvestments.filter(i => i.status === 'active'), completed: allInvestments.filter(i => i.status === 'completed')});
        
        // Fetch Stakes
        const stakesQuery = query(collection(db, 'userStakes'), where('userId', '==', userId));
        const stakesSnap = await getDocs(stakesQuery);
        const allStakes = stakesSnap.docs.map(d => ({id: d.id, ...d.data()} as Staking));
        setStakes({ active: allStakes.filter(s => s.status === 'active'), completed: allStakes.filter(s => s.status === 'completed')});
        
        // Fetch Pools
        const poolsQuery = query(collection(db, 'userPoolInvestments'), where('userId', '==', userId));
        const poolsSnap = await getDocs(poolsQuery);
        const allPools = poolsSnap.docs.map(d => ({id: d.id, ...d.data()} as Pool));
        setPools({ active: allPools.filter(p => p.status === 'active'), completed: allPools.filter(p => p.status === 'completed')});

        setTotalEarning(earnings);
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Error fetching data', description: e.message });
    } finally {
        setLoading(false);
    }
  }, [userId, router, toast]);

    // per-user fee saving removed — admin API will delete any custom fee

  const handleToggleWithdrawOverride = async () => {
      if (!userId || !currentUser) return;
      try {
          const idToken = await currentUser.getIdToken();
          const res = await fetch(`/api/admin/users/${userId}/withdraw-override`, {
              method: 'POST',
              headers: { 'content-type': 'application/json', authorization: `Bearer ${idToken}` },
              body: JSON.stringify({ allow: !withdrawAllowedWithoutReferral }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data?.error || 'Failed to update');
          toast({ title: 'Updated', description: withdrawAllowedWithoutReferral ? 'Override revoked.' : 'Override granted.' });
          fetchUserData();
      } catch (e: any) {
          toast({ variant: 'destructive', title: 'Error', description: e.message });
      }
  }

  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  const handleReturnAction = async (tx: Transaction, newStatus: 'rejected' | 'completed') => {
      if (!db || !user) return;
      
      const isRejecting = newStatus === 'rejected';
      const amount = isRejecting ? -tx.amount : tx.amount;
      const actionText = isRejecting ? 'rejected' : 're-approved';
      
      try {
          await runTransaction(db, async (transaction) => {
              const userRef = doc(db, 'users', userId);
              const userDoc = await transaction.get(userRef);

              if(!userDoc.exists()) throw new Error("User not found.");

              const currentBalance = userDoc.data().balance || 0;
              transaction.update(userRef, { balance: currentBalance + amount });

              const returnRef = doc(db, 'investmentTransactions', tx.id);
              transaction.update(returnRef, { status: newStatus });
          });
           toast({ title: 'Success', description: `Return has been ${actionText} and user balance updated.` });
           fetchUserData();
      } catch (error: any) {
           toast({ variant: 'destructive', title: 'Error', description: `Failed to ${actionText} return: ${error.message}` });
      }
  }

  const getBase64FromUrl = (url: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                return reject(new Error('Canvas context not available'));
            }
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => reject(new Error(`Failed to load image for PDF: ${url}`));
        img.src = url;
    });
};
  
  const downloadPDF = async () => {
    if (!user) return;
    const pdfDoc = new jsPDF();
    let startY = 15;
    
    const generalSettingsDoc = await getDoc(doc(db, 'settings', 'general'));
    const brandingData = generalSettingsDoc.exists() ? generalSettingsDoc.data() : {};
    const { 
        companyName = 'My App', 
        companySlogan = '', 
        logoUrl = '',
        pdfHeaderType = 'logo_and_text',
        pdfHeaderTextColor = '#000000',
        pdfSloganTextColor = '#555555'
    } = brandingData;

    if ((pdfHeaderType === 'logo_and_text' || pdfHeaderType === 'logo_only') && logoUrl) {
        try {
            const logoBase64 = await getBase64FromUrl(logoUrl);
            const imgProps = pdfDoc.getImageProperties(logoBase64);
            const imgWidth = 40;
            const imgHeight = (imgProps.height * imgWidth) / imgProps.width;
            pdfDoc.addImage(logoBase64, 'PNG', 14, startY, imgWidth, imgHeight);
            startY += imgHeight + 2;
        } catch (e) {
            console.error("Error adding logo to PDF", e);
        }
    }
    
    if (pdfHeaderType === 'logo_and_text' || pdfHeaderType === 'text_only') {
        if (pdfHeaderType === 'text_only' && !logoUrl) startY = 22;
         pdfDoc.setTextColor(pdfHeaderTextColor);
         pdfDoc.setFontSize(16).setFont('helvetica', 'bold').text(companyName, 14, startY);
         startY += 8;
         if (companySlogan) {
             pdfDoc.setTextColor(pdfSloganTextColor);
             pdfDoc.setFontSize(10).setFont('helvetica', 'normal').text(companySlogan, 14, startY);
             startY += 6;
         }
    }
    
    startY += 5;
    pdfDoc.setTextColor(0,0,0);
    const pageTitle = `${user.firstName || ''} ${user.lastName || user.username || user.email}'s Report`;
    pdfDoc.setFontSize(12).setFont('helvetica', 'bold').text(pageTitle, 14, startY);
    startY += 6;

    autoTable(pdfDoc, {
        startY: startY,
        head: [['Field', 'Value']],
        body: [
            ['Email', user.email],
            ['Username', user.username || 'N/A'],
            ['Joined', user.createdAt ? format(user.createdAt.toDate(), 'PPp') : 'N/A'],
            ['Main Balance', formatCurrency(user.balance || 0)],
            ['Total Earnings', formatCurrency(totalEarning)],
        ],
        theme: 'striped',
        headStyles: { fillColor: [34, 41, 57] },
    });

    let finalY = (pdfDoc as any).lastAutoTable.finalY + 10;

    const addSection = (title: string, head: string[][], body: any[][]) => {
        if (body.length > 0) {
            if (finalY > 250) {
                pdfDoc.addPage();
                finalY = 20;
            }
            pdfDoc.text(title, 14, finalY);
            autoTable(pdfDoc, { startY: finalY + 6, head: head, body: body, theme: 'grid' });
            finalY = (pdfDoc as any).lastAutoTable.finalY + 10;
        }
    }

    addSection('Active Investments', 
        [['Plan', 'Amount', 'Progress', 'Next Return']], 
        investments.active.map(inv => [
            inv.planName, 
            formatCurrency(inv.amount),
            `${inv.returnsCalculated}/${inv.termDuration === -1 ? 'Life' : inv.termDuration}`,
            inv.nextReturnDate ? format(inv.nextReturnDate.toDate(), 'PPp') : 'N/A'
        ])
    );
     addSection('Completed Investments', 
        [['Plan', 'Amount', 'Start Date']], 
        investments.completed.map(inv => [
            inv.planName, 
            formatCurrency(inv.amount),
            inv.startDate ? format(inv.startDate.toDate(), 'PPp') : 'N/A'
        ])
    );

    addSection('Active Stakes', 
        [['Plan', 'Amount', 'End Date']],
        stakes.active.map(s => [s.planName, formatCurrency(s.amount), format(s.endDate.toDate(), 'PPp')])
    );
     addSection('Completed Stakes', 
        [['Plan', 'Amount', 'End Date']],
        stakes.completed.map(s => [s.planName, formatCurrency(s.amount), format(s.endDate.toDate(), 'PPp')])
    );

    addSection('Active Pools', 
        [['Pool', 'Amount', 'Invested On']],
        pools.active.map(p => [p.poolName, formatCurrency(p.amount), format(p.investedAt.toDate(), 'PPp')])
    );
     addSection('Completed Pools', 
        [['Pool', 'Amount', 'Return', 'Invested On']],
        pools.completed.map(p => [p.poolName, formatCurrency(p.amount), formatCurrency(p.returnAmount || 0), format(p.investedAt.toDate(), 'PPp')])
    );

    addSection('All Transactions',
        [['Title', 'Amount', 'Status', 'Date']],
        transactions.map(tx => [
            tx.title,
            `${tx.type === 'deposit' || tx.type === 'investment' || tx.type === 'bonus' ? '+' : '-'} ${formatCurrency(tx.amount)}`,
            tx.status,
            format(tx.date.toDate(), 'PPp')
        ])
    );

    pdfDoc.save(`${user.username || user.id}_report.pdf`);
  };
  
  const downloadCSV = () => {
    if (!user) return;
    let csvContent = "User Profile\n";
    csvContent += Papa.unparse([
        { Field: 'Email', Value: user.email },
        { Field: 'Username', Value: user.username || 'N/A' },
        { Field: 'Joined', Value: user.createdAt ? format(user.createdAt.toDate(), 'PPp') : 'N/A' },
        { Field: 'Main Balance', Value: formatCurrency(user.balance || 0) },
        { Field: 'Total Earnings', Value: formatCurrency(totalEarning) },
    ]);
    csvContent += "\n\n";

    const addSectionToCsv = (title: string, data: any[], columns: string[]) => {
        if (data.length > 0) {
            csvContent += `${title}\n`;
            csvContent += Papa.unparse(data, { columns });
            csvContent += "\n\n";
        }
    };
    
    addSectionToCsv('Active Investments', 
        investments.active.map(inv => ({
            Plan: inv.planName, Amount: formatCurrency(inv.amount), Progress: `${inv.returnsCalculated}/${inv.termDuration === -1 ? 'Life' : inv.termDuration}`,
            'Next Return': inv.nextReturnDate ? format(inv.nextReturnDate.toDate(), 'PPp') : 'N/A'
        })),
        ['Plan', 'Amount', 'Progress', 'Next Return']
    );
     addSectionToCsv('Completed Investments', 
        investments.completed.map(inv => ({
            Plan: inv.planName, Amount: formatCurrency(inv.amount),
            'Start Date': inv.startDate ? format(inv.startDate.toDate(), 'PPp') : 'N/A'
        })),
        ['Plan', 'Amount', 'Start Date']
    );
    addSectionToCsv('Active Stakes', 
        stakes.active.map(s => ({ Plan: s.planName, Amount: formatCurrency(s.amount), 'End Date': format(s.endDate.toDate(), 'PPp') })),
        ['Plan', 'Amount', 'End Date']
    );
     addSectionToCsv('Completed Stakes', 
        stakes.completed.map(s => ({ Plan: s.planName, Amount: formatCurrency(s.amount), 'End Date': format(s.endDate.toDate(), 'PPp') })),
        ['Plan', 'Amount', 'End Date']
    );
    addSectionToCsv('Active Pools', 
        pools.active.map(p => ({ Pool: p.poolName, Amount: formatCurrency(p.amount), 'Invested On': format(p.investedAt.toDate(), 'PPp') })),
        ['Pool', 'Amount', 'Invested On']
    );
    addSectionToCsv('Completed Pools',
        pools.completed.map(p => ({
            Pool: p.poolName,
            Amount: formatCurrency(p.amount),
            Return: formatCurrency(p.returnAmount || 0),
            'Invested On': p.investedAt ? format(p.investedAt.toDate(), 'PPp') : 'N/A'
        })),
        ['Pool', 'Amount', 'Return', 'Invested On']
    );
    addSectionToCsv('All Transactions',
        transactions.map(tx => ({
            Title: tx.title, Amount: `${tx.type === 'deposit' || tx.type === 'investment' || tx.type === 'bonus' ? '+' : '-'} ${formatCurrency(tx.amount)}`,
            Status: tx.status, Date: format(tx.date.toDate(), 'PPp')
        })),
        ['Title', 'Amount', 'Status', 'Date']
    );
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `${user.username || user.id}_report.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  if (loading || !user) {
      return (
          <AdminLayout>
              <div className="flex justify-center items-center h-full"><Loader2 className="h-10 w-10 animate-spin"/></div>
          </AdminLayout>
      )
  }

  return (
    <AdminLayout>
        <div className="space-y-8">
            <div className="flex justify-between items-start">
                <div className="flex items-center gap-4">
                    <Button variant="outline" size="icon" onClick={() => router.back()}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold font-headline">{user.firstName || ''} {user.lastName || user.username || user.email}</h1>
                        <p className="text-muted-foreground">{user.email}</p>
                    </div>
                </div>
                 <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button><Download className="mr-2 h-4 w-4"/> Export User Data</Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                        <DropdownMenuItem onSelect={() => downloadPDF()}>Download as PDF</DropdownMenuItem>
                        <DropdownMenuItem onSelect={downloadCSV}>Download as CSV</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
            
            <div className="mt-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Admin Withdrawal Override</CardTitle>
                        <CardDescription>Allow this user to withdraw without meeting referral requirements.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-semibold">{withdrawAllowedWithoutReferral ? 'Allowed' : 'Not Allowed'}</p>
                                <p className="text-sm text-muted-foreground">{withdrawAllowedWithoutReferral ? 'User can withdraw without referring anyone.' : 'User must meet referral requirements to withdraw.'}</p>
                            </div>
                            <div>
                                <Button variant={withdrawAllowedWithoutReferral ? 'destructive' : 'default'} onClick={handleToggleWithdrawOverride}>
                                    {withdrawAllowedWithoutReferral ? 'Revoke Override' : 'Allow Withdraw Without Referral'}
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                    <CardHeader><CardTitle>Main Wallet Balance</CardTitle></CardHeader>
                    <CardContent><p className="text-3xl font-bold">{formatCurrency(user.balance || 0)}</p></CardContent>
                </Card>
                <Card>
                    <CardHeader><CardTitle>Total Earnings</CardTitle></CardHeader>
                    <CardContent><p className="text-3xl font-bold">{formatCurrency(totalEarning)}</p></CardContent>
                </Card>
                 <Card>
                    <CardHeader><CardTitle>Joined</CardTitle></CardHeader>
                    <CardContent><p className="text-3xl font-bold">{user.createdAt ? format(user.createdAt.toDate(), 'PP') : 'N/A'}</p></CardContent>
                </Card>
            </div>
            
            <div className="mt-6">
                <Card>
                    <CardHeader>
                            <CardTitle>Per-user Withdrawal Fee</CardTitle>
                            <CardDescription>Per-user custom fees have been disabled. Platform uses a flat 20% fee.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="p-4 text-sm text-muted-foreground">All withdrawals use the platform default fee: <strong>20%</strong>.</div>
                    </CardContent>
                </Card>
            </div>

            <Tabs defaultValue="investments">
                <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="investments">Investments</TabsTrigger>
                    <TabsTrigger value="staking">Staking</TabsTrigger>
                    <TabsTrigger value="pools">Pools</TabsTrigger>
                    <TabsTrigger value="transactions">Transactions</TabsTrigger>
                </TabsList>
                <TabsContent value="investments">
                    <Card>
                        <CardHeader><CardTitle>Active Investments</CardTitle></CardHeader>
                        <CardContent>
                            {investments.active.length > 0 ? (
                               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {investments.active.map(inv => (
                                    <Card key={inv.id}>
                                        <CardHeader>
                                            <CardTitle className="text-lg">{inv.planName}</CardTitle>
                                            <CardDescription>Invested: {formatCurrency(inv.amount)}</CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="text-xs text-muted-foreground flex justify-between">
                                                <span>Progress: {inv.returnsCalculated}/{inv.termDuration === -1 ? 'Lifetime' : inv.termDuration} returns</span>
                                            </div>
                                            <Countdown nextReturn={inv.nextReturnDate} lastReturn={inv.lastReturnDate} />
                                        </CardContent>
                                    </Card>
                                ))}
                               </div>
                            ) : <p className="text-muted-foreground text-center p-8">No active investments.</p>}
                        </CardContent>
                    </Card>
                    <Card className="mt-6">
                        <CardHeader><CardTitle>Completed Investments</CardTitle></CardHeader>
                        <CardContent>
                             {investments.completed.length > 0 ? (
                                <Table>
                                    <TableBody>
                                        {investments.completed.map(inv => (
                                            <TableRow key={inv.id}>
                                                <TableCell>{inv.planName}</TableCell>
                                                <TableCell>{formatCurrency(inv.amount)}</TableCell>
                                                <TableCell>{format(inv.startDate.toDate(), 'PP')}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                             ) : <p className="text-muted-foreground text-center p-8">No completed investments.</p>}
                        </CardContent>
                    </Card>
                </TabsContent>
                 <TabsContent value="staking">
                    <Card>
                        <CardHeader><CardTitle>Active Stakes</CardTitle></CardHeader>
                        <CardContent>
                             {stakes.active.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {stakes.active.map(s => (
                                    <Card key={s.id}>
                                        <CardHeader>
                                            <CardTitle className="text-lg">{s.planName}</CardTitle>
                                            <CardDescription>Staked: {formatCurrency(s.amount)}</CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            <Countdown nextReturn={s.endDate} lastReturn={s.startDate} />
                                        </CardContent>
                                    </Card>
                                ))}
                               </div>
                             ) : <p className="text-muted-foreground text-center p-8">No active stakes.</p>}
                        </CardContent>
                    </Card>
                     <Card className="mt-6">
                        <CardHeader><CardTitle>Completed Stakes</CardTitle></CardHeader>
                        <CardContent>
                             {stakes.completed.length > 0 ? (
                                <Table>
                                    <TableHeader><TableRow><TableHead>Plan</TableHead><TableHead>Amount</TableHead><TableHead>End Date</TableHead></TableRow></TableHeader>
                                    <TableBody>
                                        {stakes.completed.map(s => (
                                            <TableRow key={s.id}>
                                                <TableCell>{s.planName}</TableCell>
                                                <TableCell>{formatCurrency(s.amount)}</TableCell>
                                                <TableCell>{format(s.endDate.toDate(), 'PP')}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                             ) : <p className="text-muted-foreground text-center p-8">No completed stakes.</p>}
                        </CardContent>
                    </Card>
                 </TabsContent>
                 <TabsContent value="pools">
                     <Card>
                        <CardHeader><CardTitle>Active Pool Investments</CardTitle></CardHeader>
                        <CardContent>
                            {pools.active.length > 0 ? (
                                <Table>
                                    <TableHeader><TableRow><TableHead>Pool</TableHead><TableHead>Amount</TableHead><TableHead>Invested On</TableHead></TableRow></TableHeader>
                                    <TableBody>
                                        {pools.active.map(p => (
                                            <TableRow key={p.id}>
                                                <TableCell>{p.poolName}</TableCell>
                                                <TableCell>{formatCurrency(p.amount)}</TableCell>
                                                <TableCell>{format(p.investedAt.toDate(), 'PP')}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            ) : <p className="text-muted-foreground text-center p-8">No active pool investments.</p>}
                        </CardContent>
                    </Card>
                    <Card className="mt-6">
                        <CardHeader><CardTitle>Completed Pool Investments</CardTitle></CardHeader>
                        <CardContent>
                             {pools.completed.length > 0 ? (
                                <Table>
                                    <TableHeader><TableRow><TableHead>Pool</TableHead><TableHead>Amount</TableHead><TableHead>Return</TableHead></TableRow></TableHeader>
                                    <TableBody>
                                        {pools.completed.map(p => (
                                            <TableRow key={p.id}>
                                                <TableCell>{p.poolName}</TableCell>
                                                <TableCell>{formatCurrency(p.amount)}</TableCell>
                                                <TableCell>{formatCurrency(p.returnAmount || 0)}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                             ) : <p className="text-muted-foreground text-center p-8">No completed pool investments.</p>}
                        </CardContent>
                    </Card>
                 </TabsContent>
                <TabsContent value="transactions">
                     <Card>
                        <CardHeader><CardTitle>Transaction History</CardTitle></CardHeader>
                        <CardContent>
                            {transactions.length > 0 ? (
                                <Table>
                                    <TableHeader><TableRow><TableHead>Title</TableHead><TableHead>Amount</TableHead><TableHead>Status</TableHead><TableHead>Date</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                                    <TableBody>
                                        {transactions.map(tx => (
                                            <TableRow key={tx.id}>
                                                <TableCell>{tx.title}</TableCell>
                                                <TableCell className={tx.type === 'deposit' || tx.type === 'investment' || tx.type === 'bonus' ? 'text-green-500' : 'text-red-500'}>
                                                    {tx.type === 'deposit' || tx.type === 'investment' || tx.type === 'bonus' ? '+' : '-'}
                                                    {formatCurrency(tx.amount)}
                                                </TableCell>
                                                <TableCell><Badge variant={tx.status === 'completed' ? 'default' : tx.status === 'pending' ? 'secondary' : 'destructive'}>{tx.status}</Badge></TableCell>
                                                <TableCell>{format(tx.date.toDate(), 'PPp')}</TableCell>
                                                <TableCell className="text-right">
                                                    {tx.collection === 'investmentTransactions' && (
                                                        <>
                                                            {tx.status === 'completed' && (
                                                                <AlertDialog>
                                                                    <AlertDialogTrigger asChild>
                                                                        <Button variant="outline" size="sm" className="text-destructive border-destructive/50 hover:bg-destructive/10 hover:text-destructive">
                                                                            <XCircle className="mr-2 h-4 w-4"/> Reject
                                                                        </Button>
                                                                    </AlertDialogTrigger>
                                                                    <AlertDialogContent>
                                                                        <AlertDialogHeader>
                                                                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                                            <AlertDialogDescription>
                                                                                This will deduct {formatCurrency(tx.amount)} from this user's balance and mark the return as rejected.
                                                                            </AlertDialogDescription>
                                                                        </AlertDialogHeader>
                                                                        <AlertDialogFooter>
                                                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                            <AlertDialogAction onClick={() => handleReturnAction(tx, 'rejected')}>Yes, Reject</AlertDialogAction>
                                                                        </AlertDialogFooter>
                                                                    </AlertDialogContent>
                                                                </AlertDialog>
                                                            )}
                                                             {tx.status === 'rejected' && (
                                                                <AlertDialog>
                                                                    <AlertDialogTrigger asChild>
                                                                        <Button variant="outline" size="sm" className="text-green-500 border-green-500/50 hover:bg-green-500/10 hover:text-green-500">
                                                                            <CheckCircle className="mr-2 h-4 w-4"/> Re-Approve
                                                                        </Button>
                                                                    </AlertDialogTrigger>
                                                                    <AlertDialogContent>
                                                                        <AlertDialogHeader>
                                                                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                                            <AlertDialogDescription>
                                                                                 This will add {formatCurrency(tx.amount)} back to the user's balance and mark the return as completed.
                                                                            </AlertDialogDescription>
                                                                        </AlertDialogHeader>
                                                                        <AlertDialogFooter>
                                                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                            <AlertDialogAction onClick={() => handleReturnAction(tx, 'completed')}>Yes, Re-Approve</AlertDialogAction>
                                                                        </AlertDialogFooter>
                                                                    </AlertDialogContent>
                                                                </AlertDialog>
                                                            )}
                                                        </>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            ) : <p className="text-muted-foreground text-center p-8">No transactions found.</p>}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    </AdminLayout>
  );
}
