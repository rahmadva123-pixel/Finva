
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { TradingCard } from '@/components/ui/trading-card';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
// Intentionally render LoginForm directly to allow custom full-screen layout
import { auth, db, sendVerificationEmailToUser } from "@/lib/firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useToast } from "@/hooks/use-toast";
import React, { useEffect, useState, useRef } from "react";
import { doc, getDoc } from "firebase/firestore";
import { Eye, EyeOff, Mail, Lock, Loader2 } from "lucide-react";


function LoginForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [title, setTitle] = useState("Welcome back to Finva");
  const [subtitle, setSubtitle] = useState("Sign in to manage your portfolio and trades.");
  const [humanConfirmed, setHumanConfirmed] = useState(false);
  const [humanPending, setHumanPending] = useState(false);
  const humanTimerRef = useRef<number | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isLocalDev = process.env.NODE_ENV !== "production";
  const localDevEmail = "user@local.test";
  const localDevPassword = "User@123456";

  useEffect(() => {
    try {
      const stored = typeof window !== 'undefined' ? localStorage.getItem('finva_remember_email') : null;
      if (stored) {
        const parsed = JSON.parse(stored || 'null');
        if (parsed?.email) {
          const el = document.querySelector('#email') as HTMLInputElement | null;
          if (el) el.value = parsed.email;
        }
      }
    } catch {}
    const fetchContent = async () => {
        if (!db) return;
        const docRef = doc(db, 'template', 'landingPage');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            setTitle(data.loginTitle || "Welcome Back");
            setSubtitle(data.loginSubtitle || "Sign in to continue.");
        }
    };
    fetchContent();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (processing) return; // prevent duplicate submissions
    setErrorMessage(null);
    setProcessing(true);
    const form = e.target as HTMLFormElement;
    const email = (form.elements.namedItem("email") as HTMLInputElement).value;
    const password = (form.elements.namedItem("password") as HTMLInputElement).value;
    if (!humanConfirmed) {
      toast({
        variant: "destructive",
        title: "Human verification required",
        description: "Please confirm you're human before signing in.",
      });
      setProcessing(false);
      return;
    }

    try {
      if (!auth) throw new Error("Firebase authentication is not initialized");

      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // previously we optionally persisted an email; keep existing stored email unchanged

      let emailVerificationEnabled = false;
      if (db) {
        try {
          const generalSettingsDoc = await getDoc(doc(db, 'settings', 'general'));
          emailVerificationEnabled = generalSettingsDoc.exists()
            ? generalSettingsDoc.data().emailVerificationEnabled === true
            : false;
        } catch (settingsError) {
          console.warn('Could not load general settings during login; continuing without email verification enforcement.', settingsError);
        }
      }
      
      if (emailVerificationEnabled && !user.emailVerified) {
          try {
            await sendVerificationEmailToUser(user);
            toast({
              title: "Verification email sent",
              description: "We sent a fresh verification link to your inbox.",
            });
          } catch (verificationError: any) {
            toast({
              variant: "destructive",
              title: "Verification email not sent",
              description: verificationError?.message || "We couldn't resend the verification email automatically. Please use the resend button on the next screen.",
            });
          }

          router.push(`/verify-email?email=${encodeURIComponent(user.email || email)}`);
          return;
      }

      let userData: any = null;
      try {
        if (db) {
          const userDocRef = doc(db, "users", user.uid);
          const userDoc = await getDoc(userDocRef);
          userData = userDoc.exists() ? userDoc.data() : null;
        }
      } catch (udErr) {
        console.warn('Could not load user doc during login; continuing without user data.', udErr);
        userData = null;
      }

      if (userData && userData.disabled) {
        await auth.signOut();
        toast({
          variant: "destructive",
          title: "Account Disabled",
          description: "Your account has been disabled by an administrator.",
        });
        return;
      }
      
      // Check if user is admin and redirect accordingly
      if (userData && (userData.role === 'admin' || userData.role === 'sadmin')) {
        router.push("/admin");
      } else {
        router.push("/dashboard");
      }
    } catch (error: any) {
      let description = "An unexpected error occurred. Please try again.";
      if (error.code) {
        switch (error.code) {
          case 'auth/user-not-found':
          case 'auth/wrong-password':
          case 'auth/invalid-credential':
            description = 'Invalid email or password.';
            break;
          case 'auth/too-many-requests':
            description = 'Access to this account has been temporarily disabled due to many failed login attempts. You can immediately restore it by resetting your password or you can try again later.';
            break;
           case 'auth/user-disabled':
            description = 'This account has been disabled by an administrator.';
            break;
          default:
            description = error.message;
        }
      }
      setErrorMessage(description);
      toast({
        variant: "destructive",
        title: "Login Failed",
        description: description,
      });
    }
    finally {
      setProcessing(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-transparent px-3 py-6 sm:p-6">
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[28rem] w-[28rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500/10 blur-3xl"></div>

      <div className="relative w-full max-w-[420px] mx-auto">
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-slate-900/95 p-6 shadow-2xl shadow-blue-950/40 backdrop-blur-xl sm:p-8">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-secondary to-primary"></div>
          <div className="mb-6 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-blue-400/20 bg-blue-500/10 text-primary shadow-inner shadow-blue-500/10">
              <Lock className="h-5 w-5" />
            </div>
            <h2 className="text-lg sm:text-2xl font-semibold mt-3">{title}</h2>
            <p className="text-xs sm:text-sm text-slate-400">{subtitle}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" aria-label="Login form">
            {errorMessage && <div className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">{errorMessage}</div>}

            <div>
              <label htmlFor="email" className="text-sm font-medium text-slate-200">Email address or phone</label>
              <div className="mt-2 relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground"><Mail className="h-4 w-4" /></div>
                <Input id="email" name="email" type="text" placeholder="you@example.com or +123456789" defaultValue={isLocalDev ? localDevEmail : ""} className="min-h-[48px] rounded-xl border-white/10 bg-white/[0.06] pl-10 text-base text-white placeholder:text-slate-500 focus-visible:ring-secondary" required />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="text-sm font-medium text-slate-200">Password</label>
              <div className="mt-2 relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground"><Lock className="h-4 w-4" /></div>
                <Input id="password" name="password" type={showPassword ? 'text' : 'password'} placeholder="Enter your password" defaultValue={isLocalDev ? localDevPassword : ''} className="min-h-[48px] rounded-xl border-white/10 bg-white/[0.06] pl-10 pr-12 text-base text-white placeholder:text-slate-500 focus-visible:ring-secondary" required />
                <Button type="button" variant="ghost" size="icon" className="absolute right-2 top-1/2 -translate-y-1/2" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {/* only human verification checkbox remains */}

            <div className="flex items-center mt-1">
              <label className="inline-flex items-center text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={humanConfirmed || humanPending}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    if (checked) {
                      setHumanPending(true);
                      humanTimerRef.current = window.setTimeout(() => {
                        setHumanPending(false);
                        setHumanConfirmed(true);
                        humanTimerRef.current = null;
                      }, 1500);
                    } else {
                      if (humanTimerRef.current) {
                        clearTimeout(humanTimerRef.current);
                        humanTimerRef.current = null;
                      }
                      setHumanPending(false);
                      setHumanConfirmed(false);
                    }
                  }}
                  className="h-4 w-4 rounded border"
                />
                <span className="ml-2">{humanPending ? 'Verifying...' : "I'm human"}</span>
              </label>
            </div>

            <Button type="submit" className="w-full rounded-xl bg-primary py-4 text-base text-white shadow-lg shadow-blue-950/40 transition hover:bg-primary/90 active:scale-[0.99] disabled:opacity-60" disabled={processing}>
              {processing ? <><Loader2 className="h-4 w-4 animate-spin mr-2 inline" /> Signing in...</> : 'Sign in to Finva'}
            </Button>

            <div className="mt-3 flex items-center justify-between text-sm">
              <Link href="/forgot-password" className="text-secondary transition-colors hover:text-white">Forgot password?</Link>
              <Link href="/signup" className="text-slate-400 transition-colors hover:text-white">Create account</Link>
            </div>

            {/* Download App button removed per request */}

            <div className="mt-2 text-center text-xs text-slate-500">Secure access for your Finva account</div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  return (
    <>
      {isClient ? <LoginForm /> : <Card className="h-[500px] animate-pulse bg-muted"></Card>}
    </>
  );
}