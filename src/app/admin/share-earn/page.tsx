
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { AdminLayout } from "@/components/layout/admin-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, PlusCircle, Edit, Trash2, Share2, Upload } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, addDoc, getDocs, doc, setDoc, deleteDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import Image from 'next/image';
import { Switch } from '@/components/ui/switch';
import { FaFacebook, FaTiktok, FaTelegram, FaWhatsapp } from 'react-icons/fa';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";


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
  status: 'active' | 'inactive';
  createdAt: any;
}

interface InstructionSettings {
    text: string;
    borderColor: string;
    backgroundColor: string;
    textColor: string;
}

const platformIcons = {
    facebook: <FaFacebook className="h-5 w-5" />,
    tiktok: <FaTiktok className="h-5 w-5" />,
    telegram: <FaTelegram className="h-5 w-5" />,
    whatsapp: <FaWhatsapp className="h-5 w-5" />,
};

export default function AdminShareEarnPage() {
    const { toast } = useToast();
    const [posts, setPosts] = useState<ShareablePost[]>([]);
    const [loading, setLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingPost, setEditingPost] = useState<Partial<ShareablePost> | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const [instructionSettings, setInstructionSettings] = useState<InstructionSettings>({
        text: 'Share the content on your social media accounts, then submit the post URL and a screenshot for verification to earn your reward!',
        borderColor: '#3b82f6',
        backgroundColor: '#1e3a8a',
        textColor: '#ffffff'
    });
    const [savingInstructions, setSavingInstructions] = useState(false);

    const fetchPostsAndSettings = useCallback(async () => {
        if (!db) { setLoading(false); return; }
        setLoading(true);
        try {
            const postsQuerySnapshot = await getDocs(collection(db, 'shareablePosts'));
            const postsData = postsQuerySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ShareablePost));
            postsData.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
            setPosts(postsData);

            const settingsDocRef = doc(db, 'settings', 'shareAndEarn');
            const settingsDocSnap = await getDoc(settingsDocRef);
            if (settingsDocSnap.exists()) {
                setInstructionSettings(settingsDocSnap.data() as InstructionSettings);
            }
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: `Failed to fetch data: ${error.message}` });
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        fetchPostsAndSettings();
    }, [fetchPostsAndSettings]);

    const handleOpenDialog = (post: Partial<ShareablePost> | null = null) => {
        if (post) {
            setEditingPost(JSON.parse(JSON.stringify(post)));
        } else {
            setEditingPost({
                title: '',
                description: '',
                imageUrl: '',
                shareOptions: { telegram: true, facebook: true, tiktok: false, whatsapp: true },
                rewardAmount: 0,
                verificationInstructions: 'Please provide a screenshot and the URL of your shared post for verification.',
                verificationRequirements: { 
                    telegram: 'url_and_screenshot', 
                    facebook: 'url_and_screenshot', 
                    tiktok: 'url_only', 
                    whatsapp: 'screenshot_only'
                },
                status: 'active',
            });
        }
        setIsDialogOpen(true);
    };

    const handleSavePost = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!db || !editingPost) return;

        setIsSubmitting(true);
        try {
            const postToSave: Omit<ShareablePost, 'id' | 'createdAt'> & {createdAt?: any} = {
                title: editingPost.title || '',
                description: editingPost.description || '',
                imageUrl: editingPost.imageUrl || '',
                shareOptions: editingPost.shareOptions || { telegram: true, facebook: true, tiktok: false, whatsapp: true },
                rewardAmount: Number(editingPost.rewardAmount || 0),
                verificationInstructions: editingPost.verificationInstructions || '',
                verificationRequirements: editingPost.verificationRequirements || { telegram: 'url_and_screenshot', facebook: 'url_and_screenshot', tiktok: 'url_only', whatsapp: 'screenshot_only'},
                status: editingPost.status || 'active',
            };

            if (editingPost.id) {
                const postRef = doc(db, 'shareablePosts', editingPost.id);
                await setDoc(postRef, postToSave, { merge: true });
                toast({ title: 'Success', description: 'Post updated successfully.' });
            } else {
                postToSave.createdAt = serverTimestamp();
                await addDoc(collection(db, 'shareablePosts'), postToSave);
                toast({ title: 'Success', description: 'Post created successfully.' });
            }

            setIsDialogOpen(false);
            setEditingPost(null);
            fetchPostsAndSettings();
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: `Failed to save post: ${error.message}` });
        } finally {
            setIsSubmitting(false);
        }
    }

    const handleDeletePost = async (postId: string) => {
        if (!db) return;
        if (confirm('Are you sure you want to delete this post?')) {
            try {
                await deleteDoc(doc(db, 'shareablePosts', postId));
                toast({ title: 'Success', description: 'Post deleted successfully.' });
                fetchPostsAndSettings();
            } catch (error: any) {
                toast({ variant: 'destructive', title: 'Error', description: `Failed to delete post: ${error.message}` });
            }
        }
    }

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 2 * 1024 * 1024) { // 2MB limit
            toast({
                variant: 'destructive',
                title: 'Image too large',
                description: 'Please upload an image smaller than 2MB, or use the URL option.',
            });
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            const base64String = reader.result as string;
            setEditingPost(p => ({...p, imageUrl: base64String}));
        };
        reader.readAsDataURL(file);
    };

    const handleSaveInstructions = async () => {
        if (!db) return;
        setSavingInstructions(true);
        try {
            const settingsDocRef = doc(db, 'settings', 'shareAndEarn');
            await setDoc(settingsDocRef, instructionSettings);
            toast({ title: 'Success', description: 'Instructions saved successfully.'});
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: `Failed to save instructions: ${error.message}`});
        } finally {
            setSavingInstructions(false);
        }
    }

    return (
        <AdminLayout>
            <div className="space-y-8">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold font-headline tracking-tight">Share &amp; Earn Posts</h1>
                        <p className="text-muted-foreground">Create and manage content for users to share.</p>
                    </div>
                    <Button onClick={() => handleOpenDialog()}><PlusCircle className="mr-2 h-4 w-4" /> Add New Post</Button>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Instruction Box Settings</CardTitle>
                        <CardDescription>Customize the instruction box shown to users on the Share &amp; Earn page.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="instructionText">Instruction Text</Label>
                            <Textarea 
                                id="instructionText" 
                                value={instructionSettings.text} 
                                onChange={(e) => setInstructionSettings(s => ({...s, text: e.target.value}))}
                            />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label>Background Color</Label>
                                <Input type="color" value={instructionSettings.backgroundColor} onChange={(e) => setInstructionSettings(s => ({...s, backgroundColor: e.target.value}))} className="h-10" />
                            </div>
                             <div className="space-y-2">
                                <Label>Border Color</Label>
                                <Input type="color" value={instructionSettings.borderColor} onChange={(e) => setInstructionSettings(s => ({...s, borderColor: e.target.value}))} className="h-10" />
                            </div>
                             <div className="space-y-2">
                                <Label>Text Color</Label>
                                <Input type="color" value={instructionSettings.textColor} onChange={(e) => setInstructionSettings(s => ({...s, textColor: e.target.value}))} className="h-10" />
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button onClick={handleSaveInstructions} disabled={savingInstructions}>
                            {savingInstructions && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                            Save Instructions
                        </Button>
                    </CardFooter>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Existing Posts</CardTitle>
                        <CardDescription>View, edit, or delete existing shareable posts.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Image</TableHead>
                                        <TableHead>Title</TableHead>
                                        <TableHead>Reward</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {posts.map(post => (
                                        <TableRow key={post.id}>
                                            <TableCell>
                                                <Image src={post.imageUrl || 'https://placehold.co/64x64'} alt={post.title} width={64} height={64} className="rounded-md object-cover"/>
                                            </TableCell>
                                            <TableCell className="font-medium">{post.title}</TableCell>
                                            <TableCell>${(post.rewardAmount || 0).toFixed(2)}</TableCell>
                                            <TableCell><Badge variant={post.status === 'active' ? 'default' : 'secondary'} className="capitalize">{post.status}</Badge></TableCell>
                                            <TableCell className="text-right space-x-2">
                                                <Button variant="outline" size="icon" onClick={() => handleOpenDialog(post)}>
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button variant="destructive" size="icon" onClick={() => handleDeletePost(post.id)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-3xl bg-card border-border">
                    <DialogHeader>
                        <DialogTitle>{editingPost?.id ? 'Edit' : 'Create'} Post</DialogTitle>
                        <DialogDescription>Fill out the details for your shareable post.</DialogDescription>
                    </DialogHeader>
                    {editingPost && (
                        <form onSubmit={handleSavePost} className="max-h-[80vh] overflow-y-auto pr-4 space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="title">Title</Label>
                                <Input id="title" value={editingPost.title || ''} onChange={(e) => setEditingPost(p => ({...p, title: e.target.value}))} required/>
                            </div>
                            <div className="space-y-2">
                                <Label>Image</Label>
                                <Tabs defaultValue="upload">
                                    <TabsList>
                                        <TabsTrigger value="upload">Upload Image</TabsTrigger>
                                        <TabsTrigger value="url">Use URL</TabsTrigger>
                                    </TabsList>
                                    <TabsContent value="upload" className="pt-4">
                                        <Input id="image-upload" type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                                        <Label htmlFor="image-upload" className="cursor-pointer">
                                        <div className="flex flex-col items-center justify-center gap-2 p-4 border-2 border-dashed rounded-lg text-muted-foreground hover:bg-muted/50">
                                            <Upload className="h-5 w-5"/>
                                            <span>{editingPost.imageUrl && !editingPost.imageUrl.startsWith('http') ? "Change image" : "Click to upload image"}</span>
                                            <p className="text-xs">Max file size: 2MB</p>
                                        </div>
                                        </Label>
                                    </TabsContent>
                                    <TabsContent value="url" className="pt-4">
                                        <Input 
                                            placeholder="https://example.com/image.png"
                                            value={editingPost.imageUrl?.startsWith('http') ? editingPost.imageUrl : ''} 
                                            onChange={(e) => setEditingPost(p => ({...p, imageUrl: e.target.value}))} 
                                        />
                                    </TabsContent>
                                </Tabs>

                                {editingPost.imageUrl && (
                                    <div className="relative w-32 h-32 mt-2">
                                        <Image src={editingPost.imageUrl} alt="Post preview" layout="fill" objectFit="cover" className="rounded-md" />
                                    </div>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="description">Description</Label>
                                <Textarea id="description" value={editingPost.description || ''} onChange={(e) => setEditingPost(p => ({...p, description: e.target.value}))} rows={5} required/>
                            </div>

                             <div className="space-y-2">
                                <Label htmlFor="rewardAmount">Reward Amount ($)</Label>
                                <Input id="rewardAmount" type="number" value={editingPost.rewardAmount || 0} onChange={(e) => setEditingPost(p => ({...p, rewardAmount: parseFloat(e.target.value)}))} required/>
                            </div>

                             <div className="space-y-2">
                                <Label htmlFor="verificationInstructions">Verification Instructions for User</Label>
                                <Textarea id="verificationInstructions" value={editingPost.verificationInstructions || ''} onChange={(e) => setEditingPost(p => ({...p, verificationInstructions: e.target.value}))} required/>
                            </div>

                            <Card>
                                <CardHeader>
                                    <CardTitle>Share Platforms & Verification</CardTitle>
                                    <CardDescription>Select where users can share this post and what proof is required for each.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <Accordion type="multiple" className="w-full space-y-4">
                                        {Object.keys(platformIcons).map((platform) => (
                                             <AccordionItem value={platform} key={platform} className="border-none">
                                                <div className="flex items-center p-3 border rounded-md">
                                                    <Switch
                                                        id={platform}
                                                        checked={editingPost.shareOptions?.[platform as keyof typeof editingPost.shareOptions] || false}
                                                        onCheckedChange={(checked) => setEditingPost(p => ({
                                                            ...p,
                                                            shareOptions: { ...(p?.shareOptions || { telegram: true, facebook: true, tiktok: false, whatsapp: true }), [platform]: checked }
                                                        }))}
                                                    />
                                                    <AccordionTrigger className="flex-1 px-4 py-0 hover:no-underline capitalize">
                                                        <div className="flex items-center gap-2">
                                                            {platformIcons[platform as keyof typeof platformIcons]}
                                                            {platform}
                                                        </div>
                                                    </AccordionTrigger>
                                                </div>
                                                <AccordionContent className="p-4 mt-2 border rounded-md">
                                                    <Label>Verification Requirement</Label>
                                                     <RadioGroup 
                                                        value={editingPost.verificationRequirements?.[platform as keyof typeof editingPost.verificationRequirements]}
                                                        onValueChange={(value: VerificationRequirement) => setEditingPost(p => {
                                                            if (!p) return p;
                                                            return {
                                                                ...p, 
                                                                verificationRequirements: {
                                                                    ...((p?.verificationRequirements as any) || {}), 
                                                                    [platform]: value
                                                                }
                                                            } as Partial<ShareablePost>;
                                                        })}
                                                        className="space-y-2 mt-2"
                                                        disabled={!editingPost.shareOptions?.[platform as keyof typeof editingPost.shareOptions]}
                                                    >
                                                        <div className="flex items-center space-x-2">
                                                            <RadioGroupItem value="url_and_screenshot" id={`req-both-${platform}`} />
                                                            <Label htmlFor={`req-both-${platform}`}>Require URL and Screenshot</Label>
                                                        </div>
                                                         <div className="flex items-center space-x-2">
                                                            <RadioGroupItem value="url_only" id={`req-url-${platform}`} />
                                                            <Label htmlFor={`req-url-${platform}`}>Require URL Only</Label>
                                                        </div>
                                                         <div className="flex items-center space-x-2">
                                                            <RadioGroupItem value="screenshot_only" id={`req-ss-${platform}`} />
                                                            <Label htmlFor={`req-ss-${platform}`}>Require Screenshot Only</Label>
                                                        </div>
                                                    </RadioGroup>
                                                </AccordionContent>
                                            </AccordionItem>
                                        ))}
                                    </Accordion>
                                </CardContent>
                            </Card>

                            <div className="space-y-2">
                                <Label>Status</Label>
                                <select
                                    value={editingPost.status || 'active'}
                                    onChange={(e) => setEditingPost(p => ({...p, status: e.target.value as 'active' | 'inactive'}))}
                                    className="w-full p-2 border rounded-md bg-background"
                                >
                                    <option value="active">Active</option>
                                    <option value="inactive">Inactive</option>
                                </select>
                            </div>

                            <DialogFooter>
                                <Button type="button" variant="secondary" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                                <Button type="submit" disabled={isSubmitting}>
                                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Save Post'}
                                </Button>
                            </DialogFooter>
                        </form>
                    )}
                </DialogContent>
            </Dialog>
        </AdminLayout>
    );
}
