
"use client";

import { useState, useEffect, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TradingCard } from '@/components/ui/trading-card';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, CheckCircle, Copy, Loader2, Upload, XCircle, Info, Image as ImageIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { collection, getDocs, doc, getDoc, addDoc, serverTimestamp, query, where } from "firebase/firestore";
import Image from "next/image";
import { useAuth } from "@/hooks/use-auth";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";

interface Network {
  id: string;
  name: string;
  address: string;
}

interface BankDetail {
  id: string;
  label: string;
  value: string;
}

interface FormField {
    id: string;
    label: string;
    type: 'text' | 'textarea' | 'number' | 'image';
    required: boolean;
}

interface DepositMethod {
  id: string;
  name: string;
  type: 'bank' | 'crypto';
  bankDetails?: BankDetail[];
  minAmount: number;
  maxAmount: number;
  unlimited: boolean;
  fields: FormField[];
  iconUrl: string;
  instructions: string;
  networks?: Network[];
  status: 'active' | 'inactive';
  currency: string;
  rate: number;
  fixedCharge: number;
  percentCharge: number;
}

interface CurrencySettings {
  symbol: string;
  position: 'left' | 'right';
  usdtRate: number;
  whatsappUrl: string;
  telegramUrl: string;
}

interface SpecialDepositSettings {
    isEnabled: boolean;
    specialUserIds: string[];
    methodOverrides: Record<string, Record<string, string[]>>;
}

async function resizeAndCompressImage(file: File, maxWidth: number = 800, quality: number = 0.7): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = document.createElement('img');
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let { width, height } = img;

                if (width > maxWidth) {
                    height = (height * maxWidth) / width;
                    width = maxWidth;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    return reject(new Error('Could not get canvas context'));
                }
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.onerror = reject;
        };
        reader.onerror = reject;
    });
}

export default function DepositPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [amount, setAmount] = useState("");
  const [selectedMethod, setSelectedMethod] = useState<DepositMethod | null>(null);
  const [selectedNetwork, setSelectedNetwork] = useState<Network | null>(null);
  const [formValues, setFormValues] = useState<{[key: string]: string}>({});
  const [loading, setLoading] = useState(true);
  const [uploadingField, setUploadingField] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [methods, setMethods] = useState<DepositMethod[]>([]);
  const [currency, setCurrency] = useState<CurrencySettings>({ symbol: "$", position: 'left', usdtRate: 1, whatsappUrl: '', telegramUrl: '' });
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);

  const [specialSettings, setSpecialSettings] = useState<SpecialDepositSettings | null>(null);
  const [isSpecialUser, setIsSpecialUser] = useState(false);
  const [randomizedDetail, setRandomizedDetail] = useState<any>(null);
  const [isIdentityVerified, setIsIdentityVerified] = useState<boolean | null>(null);


  useEffect(() => {
    const fetchData = async () => {
      if (!db) {
        toast({ variant: "destructive", title: "Error", description: "Firestore not initialized." });
        setLoading(false);
        return;
      }
      try {
        const userDoc = user ? await getDoc(doc(db, "users", user.uid)) : null;
        const userData = userDoc?.exists() ? userDoc.data() : null;
        setIsIdentityVerified(userData?.verificationStatus === 'verified');

        const methodsQuery = query(collection(db, "depositMethods"), where("status", "==", "active"));
        const methodsSnapshot = await getDocs(methodsQuery);
        const methodsData = methodsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as DepositMethod[];
        setMethods(methodsData);

        const currencyDoc = await getDoc(doc(db, "settings", "currency"));
        if (currencyDoc.exists()) {
          setCurrency(currencyDoc.data() as CurrencySettings);
        }

        const specialSettingsDoc = await getDoc(doc(db, 'settings', 'specialDeposits'));
        if (specialSettingsDoc.exists()) {
            const data = specialSettingsDoc.data() as SpecialDepositSettings;
            setSpecialSettings(data);
            if (user && data.isEnabled && data.specialUserIds.includes(user.uid)) {
                setIsSpecialUser(true);
            }
        }

      } catch (error) {
        console.error("Error fetching deposit data:", error);
        toast({ variant: "destructive", title: "Error", description: "Could not fetch deposit data." });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [toast, user]);

    useEffect(() => {
        if (step === 4 && isSpecialUser && selectedMethod && specialSettings) {
            if (selectedMethod.type === 'crypto' && selectedNetwork) {
                const originalAddress = selectedNetwork.address;
                const overrideAddresses = specialSettings.methodOverrides[selectedMethod.id]?.[selectedNetwork.name] || [];
                const pool = [originalAddress, ...overrideAddresses].filter(Boolean); // Filter out empty strings
                
                if (pool.length > 0) {
                    const randomIndex = Math.floor(Math.random() * pool.length);
                    setRandomizedDetail({ ...selectedNetwork, address: pool[randomIndex] });
                } else {
                    setRandomizedDetail(selectedNetwork);
                }
            } else if (selectedMethod.type === 'bank' && selectedMethod.bankDetails) {
                const randomizedBankDetails: BankDetail[] = [];

                selectedMethod.bankDetails.forEach(detail => {
                    const overrideValues = specialSettings.methodOverrides[selectedMethod.id]?.[detail.label] || [];
                    const pool = [detail.value, ...overrideValues].filter(Boolean);

                    const randomIndex = Math.floor(Math.random() * pool.length);
                    
                    randomizedBankDetails.push({
                        ...detail,
                        value: pool.length > 0 ? pool[randomIndex] : detail.value,
                    });
                });
                setRandomizedDetail({ bankDetails: randomizedBankDetails });
            }
        } else {
            setRandomizedDetail(null);
        }
    }, [step, isSpecialUser, selectedMethod, selectedNetwork, specialSettings]);
  
  const formatCurrency = (value: number, symbol?: string, position?: 'left'|'right') => {
    const sym = symbol || currency.symbol;
    const pos = position || currency.position;
    const formattedValue = value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return pos === 'left' ? `${sym}${formattedValue}` : `${formattedValue}${sym}`;
  }
  
  const handleAmountSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const depositAmount = parseFloat(amount);
    if (isNaN(depositAmount) || depositAmount <= 0) {
      toast({ variant: "destructive", title: "Invalid Amount", description: "Please enter a valid amount." });
      return;
    }
    const availableMethod = methods.find(m => depositAmount >= m.minAmount && (m.unlimited || depositAmount <= m.maxAmount));
    if (!availableMethod) {
        toast({ variant: "destructive", title: "No Method Available", description: "No deposit method available for this amount." });
        return;
    }
    setStep(2);
  };

  const handleSelectMethod = (method: DepositMethod) => {
    setSelectedMethod(method);
    if (method.type === 'crypto' && method.networks && method.networks.length > 1) {
      setSelectedNetwork(null);
    } else if (method.type === 'crypto' && method.networks && method.networks.length === 1) {
        setSelectedNetwork(method.networks[0]);
    } else {
        setSelectedNetwork(null);
    }
    setStep(1);
  };

  const handleSelectNetwork = (network: Network) => {
      setSelectedNetwork(network);
  }

    const handleSinglePageSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      const depositValue = parseFloat(amount);
      if (isNaN(depositValue) || depositValue <= 0) {
        toast({ variant: 'destructive', title: 'Invalid Amount', description: 'Please enter a valid amount.' });
        return;
      }
      const availableMethod = methods.find(method => depositValue >= method.minAmount && (method.unlimited || depositValue <= method.maxAmount));
      if (!availableMethod) {
        toast({ variant: 'destructive', title: 'No Method Available', description: 'No deposit method is available for this amount.' });
        return;
      }
      if (!selectedMethod || selectedMethod.id !== availableMethod.id) {
        toast({ variant: 'destructive', title: 'Select a payment method' });
        return;
      }
      if (selectedMethod.type === 'crypto' && selectedMethod.networks?.length && !selectedNetwork) {
        toast({ variant: 'destructive', title: 'Select a network' });
        return;
      }
      handleInitialSubmit(e);
    };
  
  const handleInitialSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedMethod) return;

      for (const field of (selectedMethod.fields || [])) {
        const fieldName = field.label.replace(/\s+/g, '_').toLowerCase();
        if (field.required && !formValues[fieldName]) {
            toast({ variant: 'destructive', title: "Missing Information", description: `Please provide: ${field.label}.` });
            return;
        }
      }
      setShowConfirmDialog(true);
  }

  const handleConfirmAndSubmit = async () => {
    if (!db || !user || !selectedMethod) {
      toast({ variant: "destructive", title: "Error", description: "An unexpected error occurred." });
      return;
    }

    if (!isIdentityVerified) {
      toast({
        variant: "destructive",
        title: "Identity verification required",
        description: "Please verify your identity before making a deposit.",
      });
      router.push('/verification');
      return;
    }

    setSubmitting(true);
    try {
      await addDoc(collection(db, "deposits"), {
        userId: user.uid,
        amount: parseFloat(amount),
        method: selectedMethod.name,
        network: selectedNetwork?.name || null,
        methodId: selectedMethod.id,
        details: formValues,
        status: "pending",
        createdAt: serverTimestamp(),
      });
      setShowConfirmDialog(false);
      setShowSuccessDialog(true);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Submission Failed", description: error.message });
    } finally {
      setSubmitting(false);
    }
  };

  const copyToClipboard = (text: string) => {
      navigator.clipboard.writeText(text).then(() => {
          toast({ title: 'Copied!', description: 'Copied to clipboard.'})
      });
  }
  
  const goBack = () => {
      if (step > 1) {
        if (step === 4 && selectedMethod?.type === 'crypto' && selectedMethod.networks && selectedMethod.networks.length > 1) {
            setStep(3);
        } else if (step === 4 || step === 3) {
            setStep(2);
        } else {
            setStep(step - 1);
        }
      }
  }

  const handleFormValueChange = (fieldName: string, value: string) => {
    setFormValues(prev => ({ ...prev, [fieldName]: value }));
  }

  const handleImageUpload = async (fieldName: string, file: File) => {
    if (!file) return;
    setUploadingField(fieldName);
    try {
        const compressedImage = await resizeAndCompressImage(file);
        handleFormValueChange(fieldName, compressedImage);
        toast({ title: 'Success', description: 'Image uploaded and compressed.' });
    } catch (error) {
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to process image.' });
    } finally {
        setUploadingField(null);
    }
  };
  
  const depositAmount = parseFloat(amount);
  const fee = selectedMethod ? selectedMethod.fixedCharge + (depositAmount * (selectedMethod.percentCharge / 100)) : 0;
  const amountToReceive = depositAmount - fee;
  const amountToSend = selectedMethod ? depositAmount * selectedMethod.rate : 0;

  const renderStep = () => {
    const finalAddress = randomizedDetail?.address || selectedNetwork?.address;
    const finalBankDetails = randomizedDetail?.bankDetails || selectedMethod?.bankDetails;

    return (
      <Card className="overflow-hidden rounded-3xl border-border/80 shadow-sm">
        <CardHeader className="border-b bg-[var(--topbar-background)] px-5 py-6 text-white sm:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary">Wallet</p>
          <CardTitle className="mt-2 text-2xl tracking-tight">Deposit funds</CardTitle>
        </CardHeader>
        <CardContent className="p-5 sm:p-8">
          <form onSubmit={handleSinglePageSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="deposit-amount" className="text-sm font-semibold">Amount</Label>
              <div className="relative">
                <Input id="deposit-amount" type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" className="h-14 rounded-xl border-border pr-16 text-xl font-semibold shadow-none focus-visible:ring-primary" required />
                <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm font-semibold text-muted-foreground">{currency.symbol}</span>
              </div>
            </div>

            <div className="space-y-3 border-t pt-5">
              <div><Label className="text-sm font-semibold">Payment method</Label></div>
              <div className="grid gap-3 sm:grid-cols-2">
                {methods.map(method => {
                  const available = !amount || (parseFloat(amount) >= method.minAmount && (method.unlimited || parseFloat(amount) <= method.maxAmount));
                  return <button key={method.id} type="button" disabled={!available} onClick={() => handleSelectMethod(method)} className={cn('flex items-center justify-between gap-3 rounded-2xl border p-4 text-left transition-all', selectedMethod?.id === method.id ? 'border-primary bg-primary/10 ring-2 ring-primary/20' : available ? 'border-border/80 hover:border-primary hover:bg-primary/5' : 'cursor-not-allowed border-border/50 opacity-40')}>
                    <span className="flex min-w-0 items-center gap-3">{method.iconUrl ? <Image src={method.iconUrl} alt={method.name} width={40} height={40} className="rounded-xl" /> : <span className="h-10 w-10 shrink-0 rounded-xl bg-[var(--topbar-background)]" />}<span><span className="block text-sm font-semibold">{method.name}</span><span className="mt-1 block text-xs text-muted-foreground">{formatCurrency(method.minAmount, currency.symbol)} min</span></span></span>
                    {selectedMethod?.id === method.id && <CheckCircle className="h-5 w-5 text-primary" />}
                  </button>;
                })}
              </div>
            </div>

            {selectedMethod?.type === 'crypto' && (selectedMethod.networks || []).length > 0 && <div className="space-y-3 border-t pt-5"><Label className="text-sm font-semibold">Network</Label><div className="grid gap-2 sm:grid-cols-2">{selectedMethod.networks?.map(network => <button key={network.id} type="button" onClick={() => handleSelectNetwork(network)} className={cn('rounded-xl border p-3 text-left text-sm transition-colors', selectedNetwork?.id === network.id ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary')}>{network.name}</button>)}</div></div>}

            {selectedMethod && (selectedMethod.type === 'crypto' ? selectedNetwork : true) && <div className="space-y-5 border-t pt-5">
              {selectedMethod.type === 'crypto' && finalAddress && <div className="rounded-2xl bg-muted/40 p-4 text-center"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Send to</p><p className="mt-2 break-all font-mono text-sm">{finalAddress}</p><Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => copyToClipboard(finalAddress)}><Copy className="mr-2 h-4 w-4" />Copy address</Button></div>}
              {selectedMethod.type === 'bank' && finalBankDetails && <div className="space-y-2 rounded-2xl bg-muted/40 p-4">{finalBankDetails.map((detail: BankDetail) => <div key={detail.id} className="flex items-center justify-between gap-3"><div><p className="text-xs text-muted-foreground">{detail.label}</p><p className="font-mono text-sm font-semibold">{detail.value}</p></div><Button type="button" variant="ghost" size="icon" onClick={() => copyToClipboard(detail.value)}><Copy className="h-4 w-4" /></Button></div>)}</div>}
              <div className="grid gap-3 rounded-2xl border p-4 text-sm sm:grid-cols-3"><div><p className="text-xs text-muted-foreground">Amount</p><p className="font-semibold">{formatCurrency(depositAmount, currency.symbol)}</p></div><div><p className="text-xs text-muted-foreground">Fee</p><p className="font-semibold">{formatCurrency(fee, currency.symbol)}</p></div><div><p className="text-xs text-muted-foreground">You receive</p><p className="font-semibold text-primary">{formatCurrency(amountToReceive, currency.symbol)}</p></div></div>
              {(selectedMethod.fields || []).map(field => { const fieldName = field.label.replace(/\s+/g, '_').toLowerCase(); return <div key={field.id} className="space-y-2"><Label htmlFor={fieldName}>{field.label}{field.required && <span className="text-destructive">*</span>}</Label>{field.type === 'image' ? <div className="flex items-center gap-3"><Input id={fieldName} type="file" accept="image/*" onChange={e => e.target.files && handleImageUpload(fieldName, e.target.files[0])} className="hidden" /><Label htmlFor={fieldName} className="flex-1 cursor-pointer"><div className="flex min-h-20 items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 p-3 text-sm text-primary">{uploadingField === fieldName ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}{formValues[fieldName] ? 'Image selected' : 'Upload image'}</div></Label>{formValues[fieldName] && <Image src={formValues[fieldName]} alt="preview" width={56} height={56} className="rounded-xl object-cover" />}</div> : field.type === 'textarea' ? <Textarea id={fieldName} value={formValues[fieldName] || ''} onChange={e => handleFormValueChange(fieldName, e.target.value)} placeholder={`Enter ${field.label}`} required={field.required} /> : <Input id={fieldName} type={field.type === 'number' ? 'number' : 'text'} value={formValues[fieldName] || ''} onChange={e => handleFormValueChange(fieldName, e.target.value)} placeholder={`Enter ${field.label}`} required={field.required} />}</div>; })}
            </div>}

            <Button type="submit" className="h-12 w-full rounded-xl bg-[var(--topbar-background)] text-white hover:bg-primary dark:bg-secondary dark:text-secondary-foreground" disabled={submitting || !!uploadingField}>{submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Review deposit</Button>
          </form>
        </CardContent>
      </Card>
    );

    /* Legacy multi-step renderer retained below for reference.
    switch (step) {
      case 1:
        return (
          <TradingCard>
            <CardHeader>
              <CardTitle>Deposit Funds</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAmountSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount to Receive ({currency.symbol})</Label>
                   <Input id="amount" type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" required />
                </div>
                 {methods.length > 0 && (
                    <div className="space-y-3 pt-4">
                        <Label>Available Methods</Label>
                        {methods.map(method => (
                             <div key={method.id} className="flex items-center gap-4 p-3 border rounded-lg bg-muted/50">
                                {method.iconUrl && <Image src={method.iconUrl} alt={method.name} width={40} height={40} className="rounded-md" />}
                                <div>
                                    <p className="font-semibold text-sm">{method.name}</p>
                                    <p className="text-xs text-muted-foreground">Limit: {formatCurrency(method.minAmount, currency.symbol)} - {method.unlimited ? 'Unlimited' : formatCurrency(method.maxAmount, currency.symbol)}</p>
                                </div>
                             </div>
                        ))}
                    </div>
                )}
                <Button type="submit" className="w-full">Continue</Button>
              </form>
            </CardContent>
          </TradingCard>
        );
      case 2:
        return (
          <TradingCard>
            <CardHeader>
               <div className="flex items-center gap-4">
                 <Button variant="ghost" size="icon" onClick={() => setStep(1)}><ArrowLeft /></Button>
                 <div>
                    <CardTitle>Select Payment Method</CardTitle>
                    <CardDescription>{formatCurrency(depositAmount, currency.symbol)}</CardDescription>
                 </div>
               </div>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {methods.map(method => {
                        const isAvailable = depositAmount >= method.minAmount && (method.unlimited || depositAmount <= method.maxAmount);
                        return (
                            <button 
                                key={method.id} 
                                onClick={() => isAvailable && handleSelectMethod(method)} 
                                disabled={!isAvailable}
                                className={cn(
                                    "w-full flex items-center justify-between gap-4 p-4 border rounded-lg text-left transition-all",
                                    isAvailable ? "hover:bg-muted cursor-pointer" : "opacity-50 cursor-not-allowed bg-muted/50"
                                )}
                            >
                                <div className="flex items-center gap-4">
                                    {method.iconUrl && (
                                    <Image src={method.iconUrl} alt={method.name} width={48} height={48} className="rounded-md" />
                                    )}
                                    <div>
                                        <p className="font-semibold">{method.name}</p>
                                        <p className="text-sm text-muted-foreground">
                                            Limit: {formatCurrency(method.minAmount, currency.symbol)} - {method.unlimited ? 'Unlimited' : formatCurrency(method.maxAmount, currency.symbol)}
                                        </p>
                                    </div>
                                </div>
                                {isAvailable ? <CheckCircle className="h-5 w-5 text-green-500" /> : <XCircle className="h-5 w-5 text-red-500" />}
                            </button>
                        )
                    })}
                </div>
            </CardContent>
          </TradingCard>
        );
      case 3: // Network selection for crypto
        if (!selectedMethod || selectedMethod.type !== 'crypto') return null;
        return (
          <TradingCard>
             <CardHeader>
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" onClick={() => setStep(2)}><ArrowLeft /></Button>
                        <div>
                        <CardTitle>Choose Network</CardTitle>
                        <CardDescription>{selectedMethod.name}</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-3">
                    {selectedMethod.networks?.map(network => (
                        <button key={network.id} onClick={() => handleSelectNetwork(network)} className="w-full flex items-center justify-between gap-4 p-4 border rounded-lg hover:bg-muted transition-colors text-left">
                            <div>
                                <p className="font-semibold">{network.name}</p>
                            </div>
                        </button>
                    ))}
                </CardContent>
              </TradingCard>
        );
       case 4:
        if (!selectedMethod) return null;
        
        const finalAddress = randomizedDetail?.address || selectedNetwork?.address;
        const finalBankDetails = randomizedDetail?.bankDetails || selectedMethod.bankDetails;

           return (
             <TradingCard>
              <CardHeader>
                   <div className="flex items-center gap-4">
                     <Button variant="ghost" size="icon" onClick={goBack}><ArrowLeft /></Button>
                     <div>
                        <div className="flex items-center gap-2">
                           {selectedMethod.iconUrl && <Image src={selectedMethod.iconUrl} alt={selectedMethod.name} width={24} height={24} />}
                           <CardTitle className="text-xl">{selectedMethod.name} {selectedNetwork ? `(${selectedNetwork.name})` : ''}</CardTitle>
                        </div>
                        <CardDescription>{selectedMethod.name}</CardDescription>
                     </div>
                   </div>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleInitialSubmit} className="space-y-6">
                        
                         <div className="bg-card-foreground/5 p-4 rounded-lg text-center space-y-4">
                            <p className="font-bold">You need to send:</p>
                             <div className="flex items-center justify-center gap-2">
                                <p className="text-3xl font-bold text-primary">{amountToSend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}</p>
                                <span className="text-xl font-semibold text-muted-foreground">{selectedMethod.currency}</span>
                                <Button type="button" variant="ghost" size="icon" onClick={() => copyToClipboard(amountToSend.toString())}>
                                    <Copy className="h-5 w-5"/>
                                </Button>
                            </div>
                            { selectedMethod.type === 'crypto' && finalAddress ? (
                                <>
                                <Image 
                                    src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${finalAddress}`} 
                                    alt="Wallet QR Code" 
                                    width={150}
                                    height={150}
                                    className="mx-auto rounded-md"
                                />
                                <div>
                                    <p className="font-bold mb-1">Wallet Address:</p>
                                    <div className="relative">
                                        <Input value={finalAddress} readOnly className="bg-background text-center pr-10"/>
                                        <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8" onClick={() => copyToClipboard(finalAddress)}>
                                            <Copy className="h-4 w-4"/>
                                        </Button>
                                    </div>
                                </div>
                                </>
                            ) : selectedMethod.type === 'bank' ? (
                                <div className="text-left space-y-2">
                                    {finalBankDetails?.map((detail: BankDetail) => (
                                        <div key={detail.id} className="flex justify-between items-center bg-background/50 p-2 rounded-md">
                                            <div>
                                                <p className="text-xs text-muted-foreground">{detail.label}</p>
                                                <p className="font-mono font-semibold">{detail.value}</p>
                                            </div>
                                            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => copyToClipboard(detail.value)}>
                                                <Copy className="h-4 w-4"/>
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            ) : null }
                        </div>
                        
                        <div className="text-sm space-y-2 border p-4 rounded-lg">
                            <div className="flex justify-between"><span className="text-muted-foreground">Request Amount:</span> <span>{formatCurrency(depositAmount, currency.symbol)}</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">Deposit Fee:</span> <span>{formatCurrency(fee, currency.symbol)}</span></div>
                            <div className="flex justify-between font-bold text-lg"><span >You will receive:</span> <span className="text-primary">{formatCurrency(amountToReceive, currency.symbol)}</span></div>
                        </div>

                         {(selectedMethod.fields || []).map(field => {
                            const fieldName = field.label.replace(/\s+/g, '_').toLowerCase();
                            return (
                                <div key={field.id} className="space-y-2">
                                    <Label htmlFor={fieldName}>{field.label}{field.required && <span className="text-destructive">*</span>}</Label>
                                    {field.type === 'image' ? (
                                        <div className="flex items-center gap-4">
                                            <Input id={fieldName} type="file" accept="image/*" onChange={(e) => e.target.files && handleImageUpload(fieldName, e.target.files[0])} className="hidden"/>
                                            <Label htmlFor={fieldName} className="flex-grow cursor-pointer">
                                            <div className="flex items-center justify-center gap-2 p-4 border-2 border-dashed rounded-lg text-muted-foreground hover:bg-muted/50">
                                                {uploadingField === fieldName ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5"/>}
                                                <span>{formValues[fieldName] ? "Image Selected" : "Click to upload"}</span>
                                            </div>
                                            </Label>
                                            {formValues[fieldName] && <Image src={formValues[fieldName]} alt="preview" width={48} height={48} className="rounded-md object-cover" />}
                                        </div>
                                    ) : field.type === 'textarea' ? (
                                        <Textarea
                                            id={fieldName}
                                            value={formValues[fieldName] || ''}
                                            onChange={e => handleFormValueChange(fieldName, e.target.value)}
                                            placeholder={`Enter your ${field.label}`}
                                            required={field.required}
                                        />
                                    ) : (
                                        <Input
                                            id={fieldName}
                                            type={field.type === 'number' ? 'number' : 'text'}
                                            value={formValues[fieldName] || ''}
                                            onChange={e => handleFormValueChange(fieldName, e.target.value)}
                                            placeholder={`Enter your ${field.label}`}
                                            required={field.required}
                                        />
                                    )}
                                </div>
                            )
                        })}

                        <Button type="submit" className="w-full" disabled={submitting || !!uploadingField}>
                            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                            Confirm Deposit
                        </Button>
                    </form>
                 </CardContent>
               </TradingCard>
        )
      default:
        return null;
    }
    */
  };

  if (loading || isIdentityVerified === null) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center p-16">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!isIdentityVerified) {
    return (
      <DashboardLayout>
        <div className="max-w-xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>Identity verification required</CardTitle>
              <CardDescription>You must verify your identity before making a deposit.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
                Deposits are locked for accounts that have not completed identity verification yet.
              </div>
              <Button className="w-full" onClick={() => router.push('/verification')}>Verify Identity Now</Button>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-2xl mx-auto">
        {renderStep()}
      </div>
      
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    Please ensure you have made the payment correctly. Submitting false information may result in account suspension.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleConfirmAndSubmit} disabled={submitting}>
                    {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                    Yes, I have paid
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
          <AlertDialogContent>
              <AlertDialogHeader className="items-center text-center">
                  <CheckCircle className="h-16 w-16 text-green-500 mb-4" />
                  <AlertDialogTitle className="text-2xl">Your deposit request has been taken.</AlertDialogTitle>
                  <AlertDialogDescription className="text-base">
                      {selectedMethod?.instructions || 'Your deposit will be reflected in your account once confirmed.'}
                  </AlertDialogDescription>
              </AlertDialogHeader>
               <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Support Details</CardTitle>
                  </CardHeader>
                  <CardContent>
                     <p className="text-sm text-muted-foreground">
                        For faster approval, please contact support with your transaction proof.
                     </p>
                     <div className="flex gap-4 mt-4">
                        {currency.whatsappUrl && (
                           <Button asChild className="flex-1" style={{backgroundColor: '#25D366', color: 'white'}}>
                            <a href={currency.whatsappUrl} target="_blank" rel="noopener noreferrer">WhatsApp</a>
                           </Button>
                        )}
                        {currency.telegramUrl && (
                           <Button asChild className="flex-1" style={{backgroundColor: '#0088cc', color: 'white'}}>
                            <a href={currency.telegramUrl} target="_blank" rel="noopener noreferrer">Telegram</a>
                           </Button>
                        )}
                     </div>
                  </CardContent>
               </Card>
              <AlertDialogFooter className="sm:justify-center">
                   <Button className="w-full" onClick={() => {
                      setShowSuccessDialog(false);
                      setStep(1);
                      setAmount("");
                      setFormValues({});
                      setSelectedMethod(null);
                      setSelectedNetwork(null);
                      router.push('/dashboard');
                  }}>
                     Done
                  </Button>
              </AlertDialogFooter>
          </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
