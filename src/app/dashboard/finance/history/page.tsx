
"use client";

import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, getDoc, orderBy } from "firebase/firestore";
import { Loader2, CheckCircle, Clock, XCircle, Info, MessageSquare, ArrowUp, ArrowDown, Gift, TrendingUp, CircleDollarSign } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { TradingCard } from '@/components/ui/trading-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { format } from "date-fns";
import { Button } from "@/components/ui/button";

interface Transaction {
    id: string;
    amount: number;
    title: string;
    type: 'deposit' | 'withdraw' | 'bonus' | 'investment' | 'send' | 'receive';
    status: 'pending' | 'completed' | 'rejected' | 'other';
    date: any;
}


interface CurrencySettings {
  symbol: string;
  position: 'left' | 'right';
}

export default function FinanceHistoryPage() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [currency, setCurrency] = useState<CurrencySettings>({ symbol: '$', position: 'left' });

  useEffect(() => {
    const fetchHistory = async () => {
      if (!db || !user) {
        setLoading(false);
        return;
      }
      try {
        const currencyDoc = await getDoc(doc(db, "settings", "currency"));
        if (currencyDoc.exists()) {
          setCurrency(currencyDoc.data() as CurrencySettings);
        }

        const allTransactions: Transaction[] = [];

        // Deposits
        const depositsQuery = query(collection(db, "deposits"), where("userId", "==", user.uid));
        const depositsSnapshot = await getDocs(depositsQuery);
        depositsSnapshot.forEach(doc => {
            const data = doc.data();
            allTransactions.push({
                id: doc.id,
                amount: data.amount,
                title: `Deposit via ${data.method}`,
                type: 'deposit',
                status: data.status,
                date: data.createdAt,
            })
        });
        
        // Withdrawals
        const withdrawalsQuery = query(collection(db, "withdrawals"), where("userId", "==", user.uid));
        const withdrawalsSnapshot = await getDocs(withdrawalsQuery);
        withdrawalsSnapshot.forEach(doc => {
            const data = doc.data();
            allTransactions.push({
                id: doc.id,
                amount: Number(data.amount || 0),
                title: `Withdrawal via ${data.method}`,
                type: 'withdraw',
                status: data.status,
                date: data.createdAt,
            })
        });

        // Bonuses
        const bonusQuery = query(collection(db, "bonusTransactions"), where("userId", "==", user.uid));
        const bonusSnapshot = await getDocs(bonusQuery);
        bonusSnapshot.forEach(doc => {
            const data = doc.data();
            allTransactions.push({
                id: doc.id,
                amount: data.amount,
                title: data.description,
                type: 'bonus',
                status: 'completed',
                date: data.date,
            })
        });
        
        // Investment Transactions (Returns and Capital Back)
        const investmentTxQuery = query(collection(db, "investmentTransactions"), where("userId", "==", user.uid));
        const investmentTxSnapshot = await getDocs(investmentTxQuery);
        investmentTxSnapshot.forEach(doc => {
            const data = doc.data();
            allTransactions.push({
                id: doc.id,
                amount: data.amount,
                title: `${data.type} from ${data.planName}`,
                type: 'investment',
                status: 'completed',
                date: data.date,
            })
        });

        // P2P Transactions
        const p2pQuery = query(collection(db, "transactions"), where("userId", "==", user.uid));
        const p2pSnapshot = await getDocs(p2pQuery);
        p2pSnapshot.forEach(doc => {
            const data = doc.data();
            allTransactions.push({
                id: doc.id,
                amount: data.amount,
                title: data.title,
                type: data.type, // 'send' or 'receive'
                status: 'completed',
                date: data.date,
            })
        });
        
        // Sort all transactions by date
        allTransactions.sort((a, b) => b.date.seconds - a.date.seconds);

        setTransactions(allTransactions);

      } catch (error) {
        console.error("Error fetching financial history: ", error);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [user]);
  
  const getTransactionProps = (transaction: Transaction) => {
      switch (transaction.type) {
          case 'deposit':
          case 'receive':
            return { icon: <ArrowDown className="h-5 w-5 text-green-600" />, color: 'text-green-600', bg: 'bg-green-50' };
          case 'withdraw':
          case 'send':
            return { icon: <ArrowUp className="h-5 w-5 text-red-600" />, color: 'text-red-600', bg: 'bg-red-50' };
          case 'bonus':
            return { icon: <Gift className="h-5 w-5 text-yellow-600" />, color: 'text-yellow-600', bg: 'bg-yellow-50' };
          case 'investment':
            return { icon: <CircleDollarSign className="h-5 w-5 text-sky-600" />, color: 'text-sky-600', bg: 'bg-sky-50' };
          default:
            return { icon: <TrendingUp className="h-5 w-5" />, color: 'text-muted-foreground', bg: 'bg-muted/10' };
      }
  };

  const [postBalances, setPostBalances] = useState<Record<string, number>>({});
  const [balancesEstimated, setBalancesEstimated] = useState(false);

  useEffect(() => {
    if (!transactions || transactions.length === 0) { setPostBalances({}); return; }
    const getTimestamp = (d: any) => (d?.seconds ? d.seconds * 1000 : (typeof d === 'number' ? d : (d?.toDate ? d.toDate().getTime() : 0)));
    const signedAmount = (tx: Transaction) => {
      if (tx.status === 'pending') return 0;
      const props = getTransactionProps(tx);
      const sign = (tx.type === 'withdraw' || tx.type === 'send') ? -1 : 1;
      return sign * Number(tx.amount || 0);
    };

    const totalSigned = transactions.reduce((s, t) => s + signedAmount(t), 0);
    // try to read current balance from a user doc when available; fallback to 0 (estimated)
    // We don't have userData here; mark estimated if we can't access a reliable balance
    const currentBalance = 0;
    const estimated = true;
    setBalancesEstimated(estimated);
    const startingBalance = Math.round((currentBalance - totalSigned) * 100) / 100;

    const itemsAsc = [...transactions].sort((a,b) => getTimestamp(a.date) - getTimestamp(b.date));
    const balancesById: Record<string, number> = {};
    let running = startingBalance;
    itemsAsc.forEach(it => {
      running = Math.round((running + signedAmount(it)) * 100) / 100;
      balancesById[it.id] = running;
    });
    setPostBalances(balancesById);
  }, [transactions]);

  const getStatusBadge = (status: Transaction['status']) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="text-yellow-500 border-yellow-500/50 bg-yellow-500/10">Pending</Badge>;
      case 'completed':
        return <Badge variant="outline" className="text-green-500 border-green-500/50 bg-green-500/10">Completed</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="text-red-500 border-red-500/50 bg-red-500/10">Rejected</Badge>;
      default:
        return null;
    }
  };
  
  const formatCurrency = (amount: number) => {
    const value = amount.toFixed(2);
    return currency.position === 'left' ? `${currency.symbol}${value}` : `${value}${currency.symbol}`;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-full px-4 sm:px-6 mx-auto">
        <div>
          <h1 className="text-2xl font-semibold font-headline tracking-tight">Transactions</h1>
          <p className="text-sm text-muted-foreground">A concise list of your deposits, withdrawals and transfers.</p>
        </div>
        <Card>
            <CardHeader>
                <CardTitle>All Transactions</CardTitle>
                <CardDescription>
                   Your financial transaction history is listed below.
                </CardDescription>
            </CardHeader>
            <CardContent className="p-2 sm:p-4">
              {loading ? (
                <div className="flex justify-center items-center p-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : transactions.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8">
                  <div className="h-14 w-14 rounded-full bg-muted/30 flex items-center justify-center mb-4">
                  <Info className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium text-card-foreground mb-1">No transactions yet</p>
                  <p className="text-xs text-muted-foreground">Your financial activity will appear here once you make a deposit or withdrawal.</p>
                </div>
              ) : (
                  <div className="space-y-3">
                    {transactions.map(tx => {
                      const { icon, color, bg } = getTransactionProps(tx);
                      const amountSign = (tx.type === 'withdraw' || tx.type === 'send') ? '-' : '+';
                      const post = postBalances[tx.id];
                      return (
                        <div key={tx.id} className="p-2 sm:p-3 bg-card rounded-xl shadow-sm hover:shadow-md transition-shadow w-full">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 min-w-0">
                                  <div className={`${bg} flex items-center justify-center h-8 w-8 sm:h-10 sm:w-10 rounded-xl`}>
                                    {icon}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-sm sm:text-base font-semibold text-card-foreground">{tx.title}</p>
                                    <p className="text-[11px] sm:text-xs text-muted-foreground">{format(new Date((tx.date?.seconds || 0) * 1000), "PPpp")}</p>
                                  </div>
                                </div>

                                <div className="text-right flex flex-col items-end w-28 sm:w-auto gap-1 flex-shrink-0">
                                  <div className="flex items-baseline gap-2">
                                    <p className={`font-semibold text-sm sm:text-lg ${color}`}>{amountSign}{formatCurrency(tx.amount)}</p>
                                    {typeof post === 'number' && <p className="text-[11px] sm:text-xs text-muted-foreground">Bal {formatCurrency(post)}{balancesEstimated ? ' (est.)' : ''}</p>}
                                  </div>
                                  <div>
                                    {tx.status === 'pending' && <StatusBadge variant="warning">Pending</StatusBadge>}
                                    {tx.status === 'completed' && <StatusBadge variant="success">Completed</StatusBadge>}
                                    {tx.status === 'rejected' && <StatusBadge variant="danger">Rejected</StatusBadge>}
                                  </div>
                                </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
            </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
