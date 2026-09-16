"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Share2, Download, Copy, Upload, CheckCircle, Clock, History, ArrowLeft } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogClose,
  DialogFooter,
} from "@/components/ui/dialog";
import { FaFacebook, FaTiktok, FaTelegram, FaWhatsapp } from 'react-icons/fa';
import Link from 'next/link';
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from '@/lib/utils';
import { Badge } from "@/components/ui/badge";
import { format } from 'date-fns';

type VerificationRequirement = 'url_and_screenshot' | 'url_only' | 'screenshot_only';

interface ShareablePost {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  shareOptions: {
    telegram: boolean;
    facebook: boolean;
    tiktok: boolean;
    whatsapp: boolean;
  };
  rewardAmount: number;
  verificationInstructions: string;
  verificationRequirements: {
      telegram: VerificationRequirement;
      facebook: VerificationRequirement;
      tiktok: VerificationRequirement;
      whatsapp: VerificationRequirement;
  };
}

interface ShareSubmission {
    id: string;
    postId: string;
    status: 'pending' | 'approved' | 'rejected';
    postTitle?: string;
    rewardAmount?: number;
    submittedAt?: any;
}

interface InstructionSettings {
    text: string;
    borderColor: string;
    backgroundColor: string;
    textColor: string;
}

type ProofsState = {
    [key in 'facebook' | 'whatsapp' | 'telegram' | 'tiktok']?: {
        url?: string;
        screenshot?: string;
        isSaved?: boolean;
    }
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
                resolve(canvas.toDataURL(file.type, quality));
            };
            img.onerror = reject;
        };
        reader.onerror = reject;
    });
}

export default function ShareAndEarnPage() {
    const { toast } = useToast();
    const { user } = useAuth();
    const [posts, setPosts] = useState<ShareablePost[]>([]);
    const [submittedPosts, setSubmittedPosts] = useState<ShareSubmission[]>([]);
    const [loading, setLoading] = useState(true);
    
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [currentPost, setCurrentPost] = useState<ShareablePost | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [proofs, setProofs] = useState<ProofsState>({});
    const [uploadingPlatform, setUploadingPlatform] = useState<string | null>(null);
    
    const [instructionSettings, setInstructionSettings] = useState<InstructionSettings | null>(null);
    const fileInputRefs = useRef<{[key: string]: HTMLInputElement | null}>({});

    const fetchPostsAndSettings = useCallback(async () => {
        if (!db) { setLoading(false); return; }
        setLoading(true);
        try {
            const q = query(collection(db, 'shareablePosts'), where('status', '==', 'active'));
            const querySnapshot = await getDocs(q);
            const postsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ShareablePost));
            
            let userSubmissions: ShareSubmission[] = [];
            if (user) {
                const subQuery = query(collection(db, 'shareSubmissions'), where('userId', '==', user.uid));
                const subSnapshot = await getDocs(subQuery);
                userSubmissions = subSnapshot.docs.map(doc => {
                    const data = doc.data();
                    const post = postsData.find(p => p.id === data.postId);
                    return {
                        id: doc.id,
                        postId: data.postId,
                        status: data.status,
                        postTitle: post?.title || 'Unknown Post',
                        rewardAmount: post?.rewardAmount || 0,
                        submittedAt: data.submittedAt
                    };
                });
            }

            const submittedPostIds = new Set(userSubmissions.map(sub => sub.postId));
            setPosts(postsData.filter(post => !submittedPostIds.has(post.id)));
            setSubmittedPosts(userSubmissions.sort((a, b) => (b.submittedAt?.seconds || 0) - (a.submittedAt?.seconds || 0)));

            const settingsDocRef = doc(db, 'settings', 'shareAndEarn');
            const settingsDocSnap = await getDoc(settingsDocRef);
            if (settingsDocSnap.exists()) {
                setInstructionSettings(settingsDocSnap.data() as InstructionSettings);
            }

        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: `Failed to fetch posts: ${error.message}` });
        } finally {
            setLoading(false);
        }
    }, [toast, user]);


    useEffect(() => {
        fetchPostsAndSettings();
    }, [fetchPostsAndSettings]);

    const handleDownloadImage = async (imageUrl: string, title: string) => {
         try {
            const response = await fetch(imageUrl);
            const blob = await response.blob();
            const file = new File([blob], 'share-image.png', { type: blob.type });

            const link = document.createElement('a');
            link.href = URL.createObjectURL(file);
            link.download = `${title.replace(/\s+/g, '_')}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
        } catch (e) {
             toast({ variant: 'destructive', title: 'Error', description: 'Could not download image.' });
        }
    };
    
    const handleCopyText = (text: string, type: 'Title' | 'Description') => {
        navigator.clipboard.writeText(text);
        toast({ title: `${type} Copied!`, description: `The post ${type.toLowerCase()} has been copied to your clipboard.` });
    };

    const handleShare = async (platform: 'facebook' | 'whatsapp' | 'telegram' | 'tiktok', post: ShareablePost) => {
        const textToCopy = `${post.title}\n\n${post.description}`;
        navigator.clipboard.writeText(textToCopy);

        try {
            await handleDownloadImage(post.imageUrl, post.title);

            toast({
                title: "Content Copied & Image Downloaded!",
                description: "Paste the text and upload the downloaded image to your post.",
            });
            
             let url = '';
            switch (platform) {
                case 'facebook': url = `https://www.facebook.com/`; break;
                case 'whatsapp': url = `https://web.whatsapp.com/`; break;
                case 'telegram': url = `https://web.telegram.org/`; break;
                case 'tiktok': url = `https://www.tiktok.com/upload?lang=en`; break;
            }
            if(url) window.open(url, '_blank');
        } catch (e) {
            toast({ variant: 'destructive', title: 'Error', description: 'Could not prepare content for sharing.' });
        }
    };
    
    const handleProofValueChange = (platform: keyof ProofsState, field: 'url' | 'screenshot', value: string) => {
        setProofs(prev => ({
            ...prev,
            [platform]: { ...prev[platform], [field]: value, isSaved: false }
        }));
    }

    const handleScreenshotUpload = async (platform: keyof ProofsState, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !user) return;
    
        setUploadingPlatform(platform);
        try {
            const compressedImage = await resizeAndCompressImage(file);
            handleProofValueChange(platform, 'screenshot', compressedImage);
            toast({ title: 'Success', description: 'Screenshot processed successfully.' });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Upload Failed', description: error.message });
        } finally {
            setUploadingPlatform(null);
        }
    };
    
    const handleSaveProof = (platform: keyof ProofsState) => {
        setProofs(prev => ({
            ...prev,
            [platform]: { ...prev[platform], isSaved: true }
        }));
        toast({ title: 'Saved!', description: `Your proof for ${platform} has been saved.` });
    };

    const handleSubmitForVerification = async () => {
        if (!db || !user || !currentPost) return;
        setIsSubmitting(true);
        try {
            const finalProofs: {[key: string]: {url?: string; screenshot?: string}} = {};
            for (const key in proofs) {
                const platformKey = key as keyof ProofsState;
                const proofData = proofs[platformKey];
                if (proofData?.isSaved) {
                    finalProofs[key] = {};
                    if(proofData.url) finalProofs[key].url = proofData.url;
                    if(proofData.screenshot) finalProofs[key].screenshot = proofData.screenshot;
                }
            }

            const submissionData = {
                userId: user.uid,
                postId: currentPost.id,
                status: 'pending' as const,
                submittedAt: serverTimestamp(),
                proofs: finalProofs,
            };
            await addDoc(collection(db, 'shareSubmissions'), submissionData);
            toast({ title: 'Success', description: 'Your submissions have been received and are pending verification.' });
            setIsDialogOpen(false);
            fetchPostsAndSettings(); 
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Submission Failed', description: error.message });
        } finally {
            setIsSubmitting(false);
            resetDialogState();
        }
    };
    
    const resetDialogState = () => {
        setCurrentPost(null);
        setProofs({});
    }

    const openSubmissionDialog = (post: ShareablePost) => {
        setCurrentPost(post);
        setIsDialogOpen(true);
    }
    
    const platformIcons = {
        facebook: <FaFacebook className="h-5 w-5" />,
        tiktok: <FaTiktok className="h-5 w-5" />,
        telegram: <FaTelegram className="h-5 w-5" />,
        whatsapp: <FaWhatsapp className="h-5 w-5" />,
    };

    const enabledPlatforms = currentPost ? Object.entries(currentPost.shareOptions)
        .filter(([, enabled]) => enabled)
        .map(([platform]) => platform as keyof ProofsState) : [];
    
    const allRequiredProofsSaved = currentPost && enabledPlatforms.every(platform => {
        return proofs[platform]?.isSaved === true;
    });

    if (loading) {
        return <DashboardLayout><div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin" /></div></DashboardLayout>;
    }

    return (
        <DashboardLayout>
            <div className="space-y-6">
                 <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold font-headline tracking-tight">Share &amp; Earn</h1>
                        <p className="text-muted-foreground">Share content to your social networks and earn rewards.</p>
                    </div>
                </div>
                
                {instructionSettings && (
                    <div className="p-4 rounded-lg border-2" style={{ backgroundColor: instructionSettings.backgroundColor, borderColor: instructionSettings.borderColor, color: instructionSettings.textColor }}>
                        <p>{instructionSettings.text}</p>
                    </div>
                )}
                
                <Tabs defaultValue="available">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="available">Available Tasks</TabsTrigger>
                        <TabsTrigger value="submitted">My Submissions</TabsTrigger>
                    </TabsList>
                    <TabsContent value="available" className="pt-4">
                        {posts.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {posts.map(post => (
                                    <Card key={post.id} className="flex flex-col bg-card/80">
                                        <CardHeader className="p-0">
                                            <div className="aspect-video relative">
                                                <Image src={post.imageUrl} alt={post.title} layout="fill" className="object-cover rounded-t-lg" />
                                            </div>
                                        </CardHeader>
                                        <CardContent className="p-6 flex-grow">
                                            <h3 className="text-lg font-bold font-headline leading-snug">{post.title}</h3>
                                            <p className="text-sm text-muted-foreground mt-2">{post.description}</p>
                                            <div className="mt-4 p-3 rounded-md bg-primary/10 text-center">
                                                <p className="text-sm font-semibold text-primary">Reward: ${(post.rewardAmount || 0).toFixed(2)}</p>
                                            </div>
                                        </CardContent>
                                        <CardFooter className="flex-col items-start gap-4">
                                            <div className="w-full space-y-2">
                                                <p className="text-sm font-semibold">Manual Share:</p>
                                                <div className="flex flex-wrap gap-2">
                                                    <Button variant="outline" size="sm" onClick={() => handleDownloadImage(post.imageUrl, post.title)} className="flex-1"><Download className="mr-2 h-4 w-4"/> Image</Button>
                                                    <Button variant="outline" size="sm" onClick={() => handleCopyText(post.title, 'Title')} className="flex-1"><Copy className="mr-2 h-4 w-4"/> Title</Button>
                                                    <Button variant="outline" size="sm" onClick={() => handleCopyText(post.description, 'Description')} className="flex-1"><Copy className="mr-2 h-4 w-4"/> Desc.</Button>
                                                </div>
                                            </div>
                                            <div className="w-full">
                                                <p className="text-sm font-semibold mb-2">Quick Share on:</p>
                                                <div className="flex flex-wrap gap-2">
                                                    {Object.entries(post.shareOptions).map(([platform, enabled]) => {
                                                        if (enabled) {
                                                            return (
                                                                <Button key={platform} size="sm" variant="outline" className="flex-1" onClick={() => handleShare(platform as any, post)}>
                                                                    {platformIcons[platform as keyof typeof platformIcons]}
                                                                    <span className="capitalize ml-2">{platform}</span>
                                                                </Button>
                                                            )
                                                        }
                                                        return null;
                                                    })}
                                                </div>
                                            </div>
                                            <Button className="w-full" onClick={() => openSubmissionDialog(post)}>Submit for Verification</Button>
                                        </CardFooter>
                                    </Card>
                                ))}
                            </div>
                        ) : (
                            <Card>
                                <CardContent className="p-8 text-center text-muted-foreground">
                                    There are no new tasks available at the moment.
                                </CardContent>
                            </Card>
                        )}
                    </TabsContent>
                    <TabsContent value="submitted" className="pt-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>My Submissions</CardTitle>
                                <CardDescription>Track the status of your "Share &amp; Earn" submissions.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {submittedPosts.length === 0 ? (
                                    <p className="text-center text-muted-foreground py-8">You have not made any submissions yet.</p>
                                ) : (
                                    <div className="space-y-4">
                                        {submittedPosts.map(sub => (
                                            <div key={sub.id} className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
                                                <div>
                                                    <p className="font-semibold">{sub.postTitle}</p>
                                                    <p className="text-sm text-muted-foreground">
                                                        Submitted on {sub.submittedAt ? format(sub.submittedAt.toDate(), 'PP') : 'N/A'}
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="font-bold text-lg text-primary">${(sub.rewardAmount || 0).toFixed(2)}</p>
                                                    <Badge variant={sub.status === 'approved' ? 'default' : sub.status === 'rejected' ? 'destructive' : 'secondary'}>{sub.status}</Badge>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
                
            </div>
             <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if(!open) resetDialogState(); }}>
                <DialogContent className="sm:max-w-2xl bg-card border-border">
                    <DialogHeader>
                        <DialogTitle>Submit for Verification</DialogTitle>
                        <DialogDescription>{currentPost?.verificationInstructions}</DialogDescription>
                    </DialogHeader>
                    {currentPost && (
                        <Tabs defaultValue={enabledPlatforms[0]} className="w-full">
                             <TabsList className="grid w-full grid-cols-4">
                                {enabledPlatforms.map(platform => (
                                    <TabsTrigger key={platform} value={platform} className="capitalize flex items-center gap-2">
                                        {platformIcons[platform]} {platform}
                                        {proofs[platform]?.isSaved && <CheckCircle className="h-4 w-4 text-green-500" />}
                                    </TabsTrigger>
                                ))}
                            </TabsList>
                            {enabledPlatforms.map(platform => {
                                const requirement = currentPost.verificationRequirements[platform];
                                const needsUrl = requirement === 'url_and_screenshot' || requirement === 'url_only';
                                const needsScreenshot = requirement === 'url_and_screenshot' || requirement === 'screenshot_only';
                                const proof = proofs[platform] || {};
                                const canSave = (needsUrl ? !!proof.url : true) && (needsScreenshot ? !!proof.screenshot : true);

                                return (
                                <TabsContent key={platform} value={platform} className="pt-4 space-y-4">
                                    <h3 className="font-semibold text-lg">Proof for {platform.charAt(0).toUpperCase() + platform.slice(1)}</h3>
                                    {needsUrl && (
                                        <div className="space-y-2">
                                            <Label htmlFor={`url-${platform}`}>Shared Post URL</Label>
                                            <Input id={`url-${platform}`} value={proof.url || ''} onChange={(e) => handleProofValueChange(platform, 'url', e.target.value)} placeholder="https://..." />
                                        </div>
                                    )}
                                    {needsScreenshot && (
                                        <div className="space-y-2">
                                            <Label>Screenshot of your post</Label>
                                            <Tabs defaultValue="upload" className="w-full">
                                                <TabsList className="grid w-full grid-cols-2">
                                                    <TabsTrigger value="upload">Upload File</TabsTrigger>
                                                    <TabsTrigger value="url">Paste URL</TabsTrigger>
                                                </TabsList>
                                                <TabsContent value="upload" className="pt-4">
                                                    <Input id={`ss-upload-${platform}`} type="file" accept="image/*" onChange={(e) => handleScreenshotUpload(platform, e)} className="hidden" ref={(el) => { if (el) fileInputRefs.current[platform] = el; }}/>
                                                    <Label htmlFor={`ss-upload-${platform}`} className="cursor-pointer">
                                                        <div className="flex items-center justify-center gap-2 p-4 border-2 border-dashed rounded-lg text-muted-foreground hover:bg-muted/50">
                                                            {uploadingPlatform === platform ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5"/>}
                                                            <span>{proof.screenshot ? "Change screenshot" : "Click to upload (Max 2MB)"}</span>
                                                        </div>
                                                    </Label>
                                                </TabsContent>
                                                <TabsContent value="url" className="pt-4">
                                                     <Input value={proof.screenshot?.startsWith('http') ? proof.screenshot : ''} onChange={(e) => handleProofValueChange(platform, 'screenshot', e.target.value)} placeholder="https://..." />
                                                </TabsContent>
                                            </Tabs>
                                            
                                            {proof.screenshot && (
                                                <div className="relative w-32 h-32 mt-2">
                                                    <a href={proof.screenshot} target="_blank" rel="noopener noreferrer">
                                                        <Image src={proof.screenshot} alt="Screenshot preview" layout="fill" objectFit="cover" className="rounded-md" />
                                                    </a>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    <Button onClick={() => handleSaveProof(platform)} disabled={!canSave || proof.isSaved}>
                                        {proof.isSaved ? "Saved" : "Save Proof"}
                                    </Button>
                                </TabsContent>
                            )})}
                        </Tabs>
                    )}
                    <DialogFooter>
                        <Button onClick={handleSubmitForVerification} disabled={!allRequiredProofsSaved || isSubmitting}>
                           {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                           Submit All for Verification
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </DashboardLayout>
    );
}
