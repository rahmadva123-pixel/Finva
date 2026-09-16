
"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthLayout } from "@/components/layout/auth-layout";
import { auth, db } from "@/lib/firebase";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { useToast } from "@/hooks/use-toast";
import React from "react";
import Link from "next/link";
import { doc, getDoc } from "firebase/firestore";

export default function SuperAdminLoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const isLocalDev = process.env.NODE_ENV !== "production";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const email = (form.elements.namedItem("email") as HTMLInputElement).value;
    const password = (form.elements.namedItem("password") as HTMLInputElement).value;

    try {
      if (!auth || !db) {
        throw new Error("Firebase not configured. Please complete the installation.");
      }
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Check user role
      const userDocRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists() && userDoc.data().role === 'sadmin') {
        router.push("/super-admin");
      } else {
        await signOut(auth);
        toast({
          variant: "destructive",
          title: "Access Denied",
          description: "You do not have permission to access the super admin panel.",
        });
      }

    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Login Failed",
        description: error.message,
      });
    }
  };

  return (
    <AuthLayout>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="font-headline text-2xl">Super Admin Login</CardTitle>
          <CardDescription>Enter your credentials to access the super admin dashboard.</CardDescription>
          {isLocalDev && (
            <div className="mt-3 rounded-md border border-dashed border-primary/40 bg-primary/5 p-3 text-left text-xs text-muted-foreground">
              <p className="font-medium text-foreground">Local dev login</p>
              <p>Email: <span className="font-mono">admin@local.test</span></p>
              <p>Password: <span className="font-mono">Admin@123456</span></p>
            </div>
          )}
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4" suppressHydrationWarning>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" placeholder="superadmin@example.com" defaultValue={isLocalDev ? "admin@local.test" : ""} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" defaultValue={isLocalDev ? "Admin@123456" : ""} required />
            </div>
            <Button type="submit" className="w-full bg-red-600 hover:bg-red-700 text-white">
              Super Admin Log In
            </Button>
          </form>
        </CardContent>
      </Card>
    </AuthLayout>
  );
}
