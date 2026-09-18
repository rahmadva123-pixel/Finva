
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
            return { icon: <ArrowDown className="h-5 w-5 text-green-500" />, color: 'text-green-500' };
          case 'withdraw':
          case 'send':
            return { icon: <ArrowUp className="h-5 w-5 text-red-500" />, color: 'text-red-500' };
          case 'bonus':
            return { icon: <Gift className="h-5 w-5 text-yellow-500" />, color: 'text-yellow-500' };
          case 'investment':
            return { icon: <CircleDollarSign className="h-5 w-5 text-blue-500" />, color: 'text-blue-500' };
          default:
            return { icon: <TrendingUp className="h-5 w-5" />, color: 'text-muted-foreground' };
      }
  };

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
      <div className="space-y-6">
        <div>
            <h1 className="text-3xl font-bold font-headline tracking-tight">Transaction History</h1>
            <p className="text-muted-foreground">A complete log of all your deposits and withdrawals.</p>
        </div>
        <Card>
            <CardHeader>
                <CardTitle>All Transactions</CardTitle>
                <CardDescription>
                   Your financial transaction history is listed below.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="flex justify-center items-center p-8">
                        <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                ) : transactions.length === 0 ? (
                    <p className="text-center text-muted-foreground p-8">Your transaction history is empty.</p>
                ) : (
                  <div className="space-y-3">
                    {transactions.map(tx => {
                      const { icon, color } = getTransactionProps(tx);
                      const amountSign = (tx.type === 'withdraw' || tx.type === 'send') ? '-' : '+';
                      return (
                        <TradingCard key={tx.id} className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-4">
                            <div className="p-3 rounded-full bg-muted/20">
                              {icon}
                            </div>
                            <div>
                              <p className="font-semibold text-card-foreground">{tx.title}</p>
                              <p className="text-sm text-muted-foreground">{format(new Date(tx.date.seconds * 1000), "PPpp")}</p>
                            </div>
                          </div>
                          <div className="text-right flex flex-col items-end gap-1">
                            <p className={`font-semibold text-lg ${color}`}>{amountSign}{formatCurrency(tx.amount)}</p>
                            <div>
                              {tx.status === 'pending' && <StatusBadge variant="warning">Pending</StatusBadge>}
                              {tx.status === 'completed' && <StatusBadge variant="success">Completed</StatusBadge>}
                              {tx.status === 'rejected' && <StatusBadge variant="danger">Rejected</StatusBadge>}
                            </div>
                          </div>
                        </TradingCard>
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
