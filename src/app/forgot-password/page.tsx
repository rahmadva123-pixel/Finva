
"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthLayout } from "@/components/layout/auth-layout";
import { auth, sendPasswordResetEmailToUser } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import React, { useState } from "react";
import { Loader2 } from "lucide-react";

export default function ForgotPasswordPage() {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (!auth) throw new Error("Firebase not configured.");
      await sendPasswordResetEmailToUser(auth, email);
      setSubmitted(true);
    } catch (error: any) {
      let description = "An unexpected error occurred. Please try again.";
      if (error.code === 'auth/user-not-found') {
          description = 'No user found with this email address.';
      } else {
          description = error.message;
      }
      toast({
        variant: "destructive",
        title: "Failed to Send Email",
        description,
      });
    } finally {
        setLoading(false);
    }
  };

  if (submitted) {
    return (
         <AuthLayout>
            <Card className="rounded-[24px] border-0 bg-transparent shadow-none">
                <CardHeader className="space-y-2 text-center">
                    <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <span className="text-lg font-bold">📩</span>
                    </div>
                    <CardTitle className="font-headline text-2xl sm:text-3xl">Check Your Email</CardTitle>
                    <CardDescription className="text-sm sm:text-base">
                        A password reset link has been sent to <span className="font-bold text-primary">{email}</span> if an account with that email exists.
                    </CardDescription>
                </CardHeader>
                <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6">
                     <Button asChild className="min-h-12 w-full rounded-xl">
                        <Link href="/login">Back to Login</Link>
                    </Button>
                </CardContent>
            </Card>
        </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <Card className="rounded-[24px] border-0 bg-transparent shadow-none">
        <CardHeader className="space-y-2 text-center">
          <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <span className="text-lg font-bold">🔑</span>
          </div>
          <CardTitle className="font-headline text-2xl sm:text-3xl">Forgot Password</CardTitle>
          <CardDescription className="text-sm sm:text-base">Enter your email address to receive a password reset link.</CardDescription>
        </CardHeader>
        <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="name@example.com" 
                required 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="min-h-12 rounded-xl"
              />
            </div>
            <Button type="submit" className="min-h-12 w-full rounded-xl" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
              Send Reset Link
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center px-4 pb-5 text-center text-sm">
          <p>
            Remember your password?{" "}
            <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
              Log in
            </Link>
          </p>
        </CardFooter>
      </Card>
    </AuthLayout>
  );
}
