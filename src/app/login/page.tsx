
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { TradingCard } from '@/components/ui/trading-card';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthLayout } from "@/components/layout/auth-layout";
import { auth, db, sendVerificationEmailToUser } from "@/lib/firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useToast } from "@/hooks/use-toast";
import React, { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { Eye, EyeOff } from "lucide-react";

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
  const isLocalDev = process.env.NODE_ENV !== "production";
  const localDevEmail = "user@local.test";
  const localDevPassword = "User@123456";

  useEffect(() => {
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
      return;
    }

    try {
      if (!auth) throw new Error("Firebase authentication is not initialized");

      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

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
      toast({
        variant: "destructive",
        title: "Login Failed",
        description: description,
      });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background/50 to-muted p-6">
      <Card className="w-full max-w-md rounded-2xl p-6">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-primary/10 text-primary">🔐</div>
          <CardTitle className="text-2xl font-headline">{title}</CardTitle>
          <CardDescription className="text-sm text-muted-foreground">{subtitle}</CardDescription>
        </CardHeader>

        <CardContent className="pt-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" placeholder="name@example.com" defaultValue={isLocalDev ? localDevEmail : ""} className="min-h-12 rounded-xl" required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input id="password" name="password" type={showPassword ? "text" : "password"} defaultValue={isLocalDev ? localDevPassword : ""} className="min-h-12 rounded-xl pr-12" required />
                <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 h-10 w-10 -translate-y-1/2 rounded-xl text-muted-foreground" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="rounded-2xl border border-border/60 bg-muted/20 p-3">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Human verification</p>
                  <p className="text-xs text-muted-foreground">{humanCheck.question}</p>
                </div>
                <Button type="button" variant="outline" className="rounded-xl" onClick={() => { setHumanCheck(createHumanCheck()); setHumanAnswer(""); }}>
                  Refresh
                </Button>
              </div>
              <Input
                id="human-check-login"
                value={humanAnswer}
                onChange={(e) => setHumanAnswer(e.target.value)}
                placeholder="Type the answer"
                className="min-h-12 rounded-xl"
                inputMode="numeric"
                required
              />
            </div>

            <div className="flex justify-between items-center text-sm">
              <Link href="/forgot-password" className="font-medium text-primary underline-offset-4 hover:underline">Forgot Password?</Link>
              {isLocalDev && <span className="text-xs text-muted-foreground">Dev: {localDevEmail}</span>}
            </div>

            <Button type="submit" className="min-h-12 w-full rounded-xl bg-primary text-primary-foreground hover:bg-primary/90">Log In</Button>
          </form>
        </CardContent>

        <CardFooter className="pt-4 text-center">
          <p className="text-sm">Don&apos;t have an account? <Link href="/signup" className="font-medium text-primary underline-offset-4 hover:underline">Sign up</Link></p>
        </CardFooter>
      </Card>
    </div>
  );
}

export default function LoginPage() {
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
    }, []);

    return (
        <AuthLayout>
            {isClient ? <LoginForm /> : <Card className="h-[500px] animate-pulse bg-muted"></Card>}
        </AuthLayout>
    );
}