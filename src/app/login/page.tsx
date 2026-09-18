
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
import React, { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { Eye, EyeOff, Mail, Lock, Loader2 } from "lucide-react";

const createHumanCheck = () => {
  const first = Math.floor(Math.random() * 9) + 1;
  const second = Math.floor(Math.random() * 9) + 1;
  return {
    question: `What is ${first} + ${second}?`,
    answer: String(first + second),
  };
};

function LoginForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [title, setTitle] = useState("Welcome Back");
  const [subtitle, setSubtitle] = useState("Enter your credentials to access your account.");
  const [humanCheck, setHumanCheck] = useState(createHumanCheck);
  const [humanAnswer, setHumanAnswer] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isLocalDev = process.env.NODE_ENV !== "production";
  const localDevEmail = "user@local.test";
  const localDevPassword = "User@123456";

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('finva_remember_email') : null;
    if (stored) {
      try {
        const parsed = JSON.parse(stored || 'null');
        if (parsed?.email) {
          const el = document.querySelector('#email') as HTMLInputElement | null;
          if (el) el.value = parsed.email;
          setRememberMe(true);
        }
      } catch {}
    }
    const fetchContent = async () => {
        if (!db) return;
        const docRef = doc(db, 'template', 'landingPage');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            setTitle(data.loginTitle || "Welcome Back");
            setSubtitle(data.loginSubtitle || "Enter your credentials to access your account.");
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

    if (humanAnswer.trim() !== humanCheck.answer) {
      toast({
        variant: "destructive",
        title: "Human verification failed",
        description: "Please solve the quick check before logging in.",
      });
      setHumanCheck(createHumanCheck());
      setHumanAnswer("");
      setProcessing(false);
      return;
    }

    try {
      if (!auth) throw new Error("Firebase authentication is not initialized");

      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // persist remembered email if requested (does not affect auth)
      try {
        if (rememberMe) {
          localStorage.setItem('finva_remember_email', JSON.stringify({ email }));
        } else {
          localStorage.removeItem('finva_remember_email');
        }
      } catch {}

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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background/60 to-muted p-6 relative overflow-hidden">
      {/* subtle decorative SVG lines */}
      <svg className="pointer-events-none absolute inset-0 -z-10 opacity-12" width="100%" height="100%" viewBox="0 0 1440 900" preserveAspectRatio="none">
        <defs>
          <linearGradient id="g1" x1="0" x2="1">
            <stop offset="0%" stopColor="rgba(99,102,241,0.04)" />
            <stop offset="100%" stopColor="rgba(139,92,246,0.01)" />
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#g1)" />
      </svg>

      <div className="w-full max-w-[420px] mx-auto">
        <div className="relative rounded-2xl bg-card/95 border border-border/60 p-6 shadow-xl">
          <div className="mb-4 text-center">
            <div className="mx-auto h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary">🔐</div>
            <h2 className="text-2xl font-semibold mt-3">Welcome Back</h2>
            <p className="text-sm text-muted-foreground">Sign in to continue to your trading dashboard.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" aria-label="Login form">
            {errorMessage && <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">{errorMessage}</div>}

            <div>
              <label htmlFor="email" className="text-sm font-medium">Email Address</label>
              <div className="mt-2 relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground"><Mail className="h-4 w-4" /></div>
                <Input id="email" name="email" type="email" placeholder="Enter your email address" defaultValue={isLocalDev ? localDevEmail : ""} className="pl-10 rounded-xl min-h-12 text-base" required />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="text-sm font-medium">Password</label>
              <div className="mt-2 relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground"><Lock className="h-4 w-4" /></div>
                <Input id="password" name="password" type={showPassword ? 'text' : 'password'} placeholder="Enter your password" defaultValue={isLocalDev ? localDevPassword : ''} className="pl-10 rounded-xl min-h-12 text-base" required />
                <Button type="button" variant="ghost" size="icon" className="absolute right-2 top-1/2 -translate-y-1/2" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="inline-flex items-center text-sm">
                <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="h-4 w-4 rounded border" />
                <span className="ml-2">Remember me</span>
              </label>
              <Link href="/forgot-password" className="text-sm text-primary">Forgot Password?</Link>
            </div>

            <Button type="submit" className="w-full py-3 text-base" disabled={processing}>
              {processing ? <><Loader2 className="h-4 w-4 animate-spin mr-2 inline" /> Signing in...</> : 'Sign In'}
            </Button>

            <div className="text-center text-sm text-muted-foreground">
              Don&apos;t have an account? <Link href="/signup" className="text-primary">Create Account</Link>
            </div>

            <div className="text-center text-xs text-muted-foreground mt-2">Secure access to your trading account</div>
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