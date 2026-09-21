"use client";

import React, { useEffect, useState } from 'react';
import { AuthLayout } from "@/components/layout/auth-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Loader2, LogOut, Phone, Send, Clock } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { db, auth } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { FaWhatsapp, FaTelegram } from 'react-icons/fa';

interface PendingPageContent {
    pendingPageTitle?: string;
    pendingPageDescription?: string;
    pendingPageInstructions?: string;
    pendingPageSupportWhatsapp?: string;
    pendingPageSupportTelegram?: string;
    pendingPageSupportEmail?: string;
    pendingPageSupportPhone?: string;
}

export default function VerificationPendingPage() {
    const { verificationStatus } = useAuth();
    const router = useRouter();
    const [content, setContent] = useState<PendingPageContent>({});
    const [loadingContent, setLoadingContent] = useState(true);

    useEffect(() => {
        if(verificationStatus === 'verified') {
            router.push('/dashboard');
        } else if (verificationStatus === 'unverified') {
            router.push('/verification');
        }
    }, [verificationStatus, router]);
    
     useEffect(() => {
        const fetchContent = async () => {
            if (!db) return;
            setLoadingContent(true);
            try {
                const settingsDoc = await getDoc(doc(db, 'settings', 'verification'));
                if (settingsDoc.exists()) {
                    setContent(settingsDoc.data());
                }
            } catch (error) {
                console.error("Failed to fetch pending page content", error);
            } finally {
                setLoadingContent(false);
            }
        };
        fetchContent();
    }, []);

    const handleRefresh = () => {
        window.location.reload();
    }

    const handleLogout = async () => {
        if (auth) {
            await auth.signOut();
            router.push('/login');
        }
    }
    
    if (loadingContent) {
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
            <Card>
                <CardHeader className="text-center">
                    <Clock className="mx-auto h-12 w-12 text-primary mb-4" />
                    <CardTitle className="font-headline text-2xl">{content.pendingPageTitle || 'Verification Pending'}</CardTitle>
                    <CardDescription>{content.pendingPageDescription || 'Your verification is under review.'}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                     <div className="p-4 bg-muted/50 border rounded-lg text-center space-y-4">
                        <p className="text-sm text-muted-foreground">{content.pendingPageInstructions || 'Check back later for your status.'}</p>
                         {(content.pendingPageSupportWhatsapp || content.pendingPageSupportTelegram || content.pendingPageSupportEmail || content.pendingPageSupportPhone) && (
                            <>
                                <h4 className="font-semibold text-sm">Need help? Contact support:</h4>
                                <div className="flex flex-wrap items-center justify-center gap-2">
                                    {content.pendingPageSupportWhatsapp && <Button asChild size="sm" variant="outline"><a href={content.pendingPageSupportWhatsapp} target="_blank" rel="noopener noreferrer"><FaWhatsapp className="mr-2"/> WhatsApp</a></Button>}
                                    {content.pendingPageSupportTelegram && <Button asChild size="sm" variant="outline"><a href={content.pendingPageSupportTelegram} target="_blank" rel="noopener noreferrer"><FaTelegram className="mr-2"/> Telegram</a></Button>}
                                    {content.pendingPageSupportEmail && <Button asChild size="sm" variant="outline"><a href={`mailto:${content.pendingPageSupportEmail}`}><Send className="mr-2"/> Email</a></Button>}
                                    {content.pendingPageSupportPhone && <Button asChild size="sm" variant="outline"><a href={`tel:${content.pendingPageSupportPhone}`}><Phone className="mr-2"/> Call</a></Button>}
                                </div>
                            </>
                        )}
                    </div>
                     <Button onClick={handleRefresh} className="w-full" variant="outline">
                        Check Status
                    </Button>
                </CardContent>
                 <CardFooter>
                     <Button variant="ghost" className="w-full text-muted-foreground" onClick={handleLogout}>
                        <LogOut className="mr-2 h-4 w-4"/>
                        Log Out
                    </Button>
                </CardFooter>
            </Card>
        </AuthLayout>
    );
}
