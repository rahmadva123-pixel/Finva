
"use client";

import React from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthLayout } from "@/components/layout/auth-layout";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from 'next/navigation';
import { createUserWithEmailAndPassword, getAuth, type Auth } from 'firebase/auth';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, doc, setDoc, Firestore } from 'firebase/firestore';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Info } from 'lucide-react';
import { saveFirebaseConfig } from './actions';

export default function InstallPage() {
    const { toast } = useToast();
    const router = useRouter();
    const [step, setStep] = React.useState(1);
    const [firebaseConfig, setFirebaseConfig] = React.useState({
        apiKey: "",
        authDomain: "",
        projectId: "",
        storageBucket: "",
        messagingSenderId: "",
        appId: ""
    });
    const [authInstance, setAuthInstance] = React.useState<Auth | null>(null);
    const [firestoreInstance, setFirestoreInstance] = React.useState<Firestore | null>(null);

    const handleConfigSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const formData = new FormData(e.target as HTMLFormElement);
            const result = await saveFirebaseConfig(formData);

            if (!result.success) {
                 toast({
                    variant: "destructive",
                    title: "Invalid Firebase Config",
                    description: result.message || "Please check your Firebase project settings and try again.",
                });
                return;
            }

            let app: FirebaseApp;
            if (!getApps().length) {
                app = initializeApp(firebaseConfig);
            } else {
                app = getApp();
            }
            const auth = getAuth(app);
            const db = getFirestore(app);
            setAuthInstance(auth);
            setFirestoreInstance(db);

            toast({
                title: "Firebase Config Saved",
                description: "Your configuration has been saved. Please create an admin account.",
            });
            setStep(2);
        } catch(error: any) {
             toast({
                variant: "destructive",
                title: "Error Saving Config",
                description: "An unexpected error occurred. Please check the console.",
            });
        }
    };

    const handleAdminSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!authInstance || !firestoreInstance) {
            toast({
                variant: "destructive",
                title: "Initialization Failed",
                description: "Firebase auth or firestore is not initialized. Please go back to step 1.",
            });
            return;
        }

        const form = e.target as HTMLFormElement;
        const email = (form.elements.namedItem("email") as HTMLInputElement).value;
        const password = (form.elements.namedItem("password") as HTMLInputElement).value;

        try {
            const userCredential = await createUserWithEmailAndPassword(authInstance, email, password);
            const user = userCredential.user;
            
            await setDoc(doc(firestoreInstance, "users", user.uid), {
                uid: user.uid,
                email: user.email,
                role: 'admin',
                createdAt: new Date(),
            });

            toast({
                title: "Admin Account Created",
                description: "Installation complete! Reloading the application...",
            });

            // Reload the page to apply the new firebase config everywhere
            setTimeout(() => {
                window.location.href = '/';
            }, 2000);

        } catch (error: any) {
            toast({
                variant: "destructive",
                title: "Admin Creation Failed",
                description: error.message,
            });
        }
    };
    
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { id, value } = e.target;
        setFirebaseConfig(prev => ({...prev, [id]: value}));
    }

    return (
        <AuthLayout>
            <Card>
                {step === 1 && (
                    <>
                        <CardHeader className="text-center">
                            <CardTitle className="font-headline text-2xl">Project Installation (Step 1/2)</CardTitle>
                            <CardDescription>First, let's connect your Firebase project.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Alert className="mb-4">
                                <Info className="h-4 w-4" />
                                <AlertTitle>Where to find your config?</AlertTitle>
                                <AlertDescription>
                                    You can find these details in your Firebase project settings under "General". Make sure to enable Email/Password authentication and Firestore database in the Firebase Console.
                                </AlertDescription>
                            </Alert>
                            <form onSubmit={handleConfigSubmit} className="space-y-4" suppressHydrationWarning>
                                <div className="space-y-2">
                                    <Label htmlFor="apiKey">API Key</Label>
                                    <Input id="apiKey" name="apiKey" placeholder="Your Firebase API Key" required onChange={handleInputChange} value={firebaseConfig.apiKey} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="authDomain">Auth Domain</Label>
                                    <Input id="authDomain" name="authDomain" placeholder="your-project-id.firebaseapp.com" required onChange={handleInputChange} value={firebaseConfig.authDomain} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="projectId">Project ID</Label>
                                    <Input id="projectId" name="projectId" placeholder="your-project-id" required onChange={handleInputChange} value={firebaseConfig.projectId} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="storageBucket">Storage Bucket</Label>
                                    <Input id="storageBucket" name="storageBucket" placeholder="your-project-id.appspot.com" required onChange={handleInputChange} value={firebaseConfig.storageBucket} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="messagingSenderId">Messaging Sender ID</Label>
                                    <Input id="messagingSenderId" name="messagingSenderId" placeholder="Your sender ID" required onChange={handleInputChange} value={firebaseConfig.messagingSenderId} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="appId">App ID</Label>
                                    <Input id="appId" name="appId" placeholder="Your web app ID" required onChange={handleInputChange} value={firebaseConfig.appId} />
                                </div>
                                <Button type="submit" className="w-full bg-accent hover:bg-accent/90">
                                    Save Config & Continue
                                </Button>
                            </form>
                        </CardContent>
                    </>
                )}
                {step === 2 && (
                    <>
                        <CardHeader className="text-center">
                            <CardTitle className="font-headline text-2xl">Create Admin Account (Step 2/2)</CardTitle>
                            <CardDescription>This account will be used to manage the application.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleAdminSubmit} className="space-y-4" suppressHydrationWarning>
                                <div className="space-y-2">
                                    <Label htmlFor="email">Admin Email</Label>
                                    <Input id="email" type="email" placeholder="admin@example.com" required />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="password">Password</Label>
                                    <Input id="password" type="password" required />
                                </div>
                                <Button type="submit" className="w-full bg-accent hover:bg-accent/90">
                                    Create Admin & Finish Installation
                                </Button>
                            </form>
                        </CardContent>
                    </>
                )}
            </Card>
        </AuthLayout>
    );
}
