
"use client";

import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import {
  doc,
  getDoc,
  runTransaction,
  collection,
  serverTimestamp,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { ArrowLeft, Loader2, Send as SendIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface CurrencySettings {
  symbol: string;
  position: 'left' | 'right';
}

interface P2PSettings {
    mainWalletMinTransfer: number;
}

export default function SendMainCurrencyPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [currency, setCurrency] = useState<CurrencySettings>({
    symbol: '$',
    position: 'left',
  });
  const [p2pSettings, setP2pSettings] = useState<P2PSettings>({ mainWalletMinTransfer: 1 });

  useEffect(() => {
    if (!db || !user) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          setBalance(userDoc.data().balance || 0);
        }
        const currencyDoc = await getDoc(doc(db, 'settings', 'currency'));
        if (currencyDoc.exists()) {
          setCurrency(currencyDoc.data() as CurrencySettings);
        }
        const p2pSettingsDoc = await getDoc(doc(db, 'settings', 'p2p'));
        if (p2pSettingsDoc.exists()) {
            setP2pSettings(p2pSettingsDoc.data() as P2PSettings);
        }

      } catch (e) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Failed to fetch user data.',
        });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user, toast]);

  const formatCurrency = (value: number) => {
    const formattedValue = value.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return currency.position === 'left'
      ? `${currency.symbol}${formattedValue}`
      : `${formattedValue}${currency.symbol}`;
  };

  const handleSend = async () => {
    if (!db || !user) return;

    const sendAmount = parseFloat(amount);
    if (isNaN(sendAmount) || sendAmount <= 0) {
      toast({ variant: 'destructive', title: 'Invalid Amount' });
      return;
    }
    
    if (sendAmount < p2pSettings.mainWalletMinTransfer) {
        toast({ variant: 'destructive', title: 'Amount Too Low', description: `Minimum transfer amount is ${formatCurrency(p2pSettings.mainWalletMinTransfer)}.` });
        return;
    }

    if (sendAmount > balance) {
      toast({ variant: 'destructive', title: 'Insufficient Funds' });
      return;
    }
    if (!recipientEmail) {
      toast({ variant: 'destructive', title: 'Recipient Required' });
      return;
    }
    if (recipientEmail.toLowerCase() === user.email?.toLowerCase()) {
      toast({
        variant: 'destructive',
        title: 'Invalid Recipient',
        description: 'You cannot send money to yourself.',
      });
      return;
    }
    setShowConfirm(true);
  };

  const confirmSend = async () => {
    if (!user) return;
    setSubmitting(true);
    try {
      await runTransaction(db, async (transaction) => {
        const sendAmount = parseFloat(amount);
        const senderRef = doc(db, 'users', user.uid);
        
        const recipientQuery = query(collection(db, 'users'), where('email', '==', recipientEmail.toLowerCase()));
        const recipientSnapshot = await getDocs(recipientQuery); // Use getDocs within transaction

        if (recipientSnapshot.empty) {
          throw new Error('Recipient with this email does not exist.');
        }
        const recipientDoc = recipientSnapshot.docs[0];
        const recipientRef = recipientDoc.ref;

        const senderDoc = await transaction.get(senderRef);
        if (!senderDoc.exists()) throw new Error('Sender not found.');
        const senderData = senderDoc.data();

        const senderBalance = senderData.balance || 0;
        if (senderBalance < sendAmount) throw new Error('Insufficient funds.');

        const recipientBalance = recipientDoc.data().balance || 0;

        transaction.update(senderRef, { balance: senderBalance - sendAmount });
        transaction.update(recipientRef, {
          balance: recipientBalance + sendAmount,
        });

        // Log transaction for sender
        const senderTxRef = doc(collection(db, 'transactions'));
        transaction.set(senderTxRef, {
          userId: senderDoc.id,
          type: 'send',
          amount: sendAmount,
          title: `Sent to ${recipientEmail}`,
          description: note,
          date: serverTimestamp(),
        });

        // Log transaction for recipient
        const recipientTxRef = doc(collection(db, 'transactions'));
        transaction.set(recipientTxRef, {
          userId: recipientDoc.id,
          type: 'receive',
          amount: sendAmount,
          title: `Received from ${senderData.email || 'a user'}`,
          description: note,
          date: serverTimestamp(),
        });
      });

      toast({ title: 'Success', description: 'Money sent successfully!' });
      router.push('/dashboard/finance/history');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Transfer Failed',
        description: error.message,
      });
    } finally {
      setSubmitting(false);
      setShowConfirm(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center items-center h-full">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-md mx-auto space-y-6">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="mr-2" /> Back
        </Button>
        <Card>
          <CardHeader>
            <CardTitle>Send Money</CardTitle>
            <CardDescription>
              Transfer funds from your main wallet to another user.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 rounded-lg bg-muted flex justify-between items-center">
              <span className="text-muted-foreground">Available to send</span>
              <span className="font-bold text-lg">{formatCurrency(balance)}</span>
            </div>
            <div className="space-y-2">
              <Label htmlFor="recipientEmail">Recipient's Email</Label>
              <Input
                id="recipientEmail"
                type="email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="name@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">Amount</Label>
              <Input
                id="amount"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
              <p className="text-xs text-muted-foreground">Minimum transfer: {formatCurrency(p2pSettings.mainWalletMinTransfer)}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="note">Note (Optional)</Label>
              <Input
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g., For lunch"
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button className="w-full" onClick={handleSend} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Send Money
            </Button>
          </CardFooter>
        </Card>
      </div>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Transfer</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to send{' '}
              {formatCurrency(parseFloat(amount) || 0)} to {recipientEmail}? This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmSend} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm & Send
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
