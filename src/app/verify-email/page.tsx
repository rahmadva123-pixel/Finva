
"use client";

import React, { useEffect, useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AuthLayout } from '@/components/layout/auth-layout';
import { useToast } from '@/hooks/use-toast';
import { auth, sendVerificationEmailToUser } from '@/lib/firebase';
import { Loader2, MailCheck } from 'lucide-react';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [email, setEmail] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  useEffect(() => {
    const emailParam = searchParams.get('email');
    if (!emailParam) {
      router.push('/login');
    } else {
      setEmail(emailParam);
    }
  }, [searchParams, router]);

  useEffect(() => {
    if (auth) {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setLoading(false);
        });
        return () => unsubscribe();
    } else {
        setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (cooldownSeconds <= 0) return;

    const timer = window.setTimeout(() => {
      setCooldownSeconds((prev) => prev - 1);
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [cooldownSeconds]);

  const handleCheckVerification = useCallback(async () => {
    if (!user) return;
    setChecking(true);
    await user.reload();
    if (user.emailVerified) {
      toast({
        title: "Success!",
        description: "Your email has been verified. You can now log in.",
      });
      await signOut(auth);
      router.push('/login');
    } else {
      toast({
        variant: "destructive",
        title: "Not Verified",
        description: "Your email is still not verified. Please check your inbox.",
      });
    }
    setChecking(false);
  }, [user, router, toast]);

  const handleResendEmail = async () => {
    if (!user || cooldownSeconds > 0) return;

    setResending(true);
    try {
        await sendVerificationEmailToUser(user);
        setCooldownSeconds(60);
        toast({
            title: "Email Sent",
            description: "A new verification email has been sent to your address."
        });
    } catch(error: any) {
        const isRateLimited = error?.code === 'auth/too-many-requests' || String(error?.message || '').includes('too-many-requests');
        if (isRateLimited) {
          setCooldownSeconds(300);
        }

        toast({
            variant: "destructive",
            title: "Error",
            description: isRateLimited
              ? "Too many requests were made. Please wait a few minutes before trying again."
              : `Failed to resend email: ${error.message}`
        });
    } finally {
        setResending(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/login');
  };
  
  if (loading) {
      return (
          <AuthLayout>
              <div className="flex items-center justify-center p-8">
                  <Loader2 className="h-12 w-12 animate-spin" />
              </div>
          </AuthLayout>
      )
  }

  return (
    <AuthLayout>
      <Card className="rounded-[24px] border-0 bg-transparent shadow-none">
        <CardHeader className="space-y-2 text-center">
          <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <MailCheck className="h-6 w-6" />
          </div>
          <CardTitle className="font-headline text-2xl sm:text-3xl">Verify Your Email</CardTitle>
          <CardDescription className="text-sm sm:text-base">
            We've sent a verification link to <span className="font-bold text-primary">{email}</span>. Please check your inbox and spam folder to continue.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 px-4 pb-4 sm:px-6 sm:pb-6">
          <Button onClick={handleCheckVerification} className="min-h-12 w-full rounded-xl" disabled={checking}>
            {checking && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
            I've verified, check again
          </Button>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button variant="outline" className="min-h-12 w-full rounded-xl" onClick={handleResendEmail} disabled={resending || cooldownSeconds > 0}>
               {resending && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
               {cooldownSeconds > 0 ? `Resend in ${cooldownSeconds}s` : 'Resend Email'}
            </Button>
            <Button variant="secondary" className="min-h-12 w-full rounded-xl" onClick={handleLogout}>
                Log Out
            </Button>
          </div>
        </CardContent>
      </Card>
    </AuthLayout>
  );
}


export default function VerifyEmailPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <VerifyEmailContent />
        </Suspense>
    )
}
