
"use client";

import React, { useState } from 'react';
import { AuthLayout } from "@/components/layout/auth-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { auth, db } from "@/lib/firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function HiddenAdminCreationPage() {
    const { toast } = useToast();
    const router = useRouter();
    
    const [formData, setFormData] = useState({
        email: '',
        password: '',
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true); 

        if (!auth || !db) {
            toast({ variant: 'destructive', title: 'Error', description: 'Firebase not initialized.' });
            setIsSubmitting(false);
            return;
        }

        try {
            // Temporarily sign out if a user is already logged in to avoid conflicts
            if (auth.currentUser) {
                await auth.signOut();
            }

            const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
            const user = userCredential.user;

            await setDoc(doc(db, "users", user.uid), {
                uid: user.uid,
                email: user.email,
                role: 'admin', // Always create a super admin from this page
                createdAt: serverTimestamp(),
                balance: 0,
                disabled: false,
                verificationStatus: 'verified',
            });

            toast({
                title: 'Success!',
                description: `Super Admin account created for ${formData.email}. Please log in.`,
            });
            
            router.push('/admin/login');

        } catch (error: any) {
            toast({
                variant: "destructive",
                title: "Account Creation Failed",
                description: error.message,
            });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    return (
        <AuthLayout>
            <Card className="w-full max-w-md">
                 <CardHeader>
                    <CardTitle>Create Super Admin Account</CardTitle>
                    <CardDescription>Use this form to create a new Super Admin. This page is for setup purposes.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">Email Address</Label>
                            <Input id="email" name="email" type="email" value={formData.email} onChange={handleInputChange} required />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password">Password</Label>
                            <Input id="password" name="password" type="password" value={formData.password} onChange={handleInputChange} required />
                        </div>
                        <Button type="submit" className="w-full" disabled={isSubmitting}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                            Create Super Admin
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </AuthLayout>
    );
}
