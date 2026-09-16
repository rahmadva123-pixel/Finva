
"use client";

import React, { useState, useEffect } from 'react';
import { AdminLayout } from "@/components/layout/admin-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, PlusCircle, Edit, Trash2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, addDoc, getDocs, doc, setDoc, deleteDoc, serverTimestamp, Timestamp, writeBatch, getDoc } from 'firebase/firestore';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import Image from 'next/image';
import { format } from 'date-fns';

interface BlogPost {
  id: string;
  title: string;
  content: string[]; // Changed to array of strings
  imageUrl: string;
  publishedAt: any;
  status: 'draft' | 'published';
  buttonText?: string;
  buttonLink?: string;
}

const initialPosts: Omit<BlogPost, 'id'>[] = [
    { title: "Diversification: The Key to a Resilient Portfolio", content: ["Learn why spreading your investments across different asset classes is crucial for managing risk and achieving long-term growth."], imageUrl: "https://picsum.photos/400/200?random=1", publishedAt: serverTimestamp(), status: 'published', buttonText: '', buttonLink: '' },
    { title: "Understanding Compound Interest: The Eighth Wonder", content: ["A deep dive into how compound interest works and how you can leverage it to exponentially grow your wealth over time."], imageUrl: "https://picsum.photos/400/200?random=2", publishedAt: serverTimestamp(), status: 'published', buttonText: '', buttonLink: '' },
    { title: "Stocks vs. Bonds: Which is Right for You?", content: ["An essential guide to understanding the fundamental differences between stocks and bonds, and how to balance them in your portfolio."], imageUrl: "https://picsum.photos/400/200?random=3", publishedAt: serverTimestamp(), status: 'published', buttonText: '', buttonLink: '' },
    { title: "A Beginner's Guide to Investing in Index Funds", content: ["Index funds offer a simple and effective way to start investing. Learn what they are and how they can benefit your financial future."], imageUrl: "https://picsum.photos/400/200?random=4", publishedAt: serverTimestamp(), status: 'published', buttonText: '', buttonLink: '' },
    { title: "The Role of ETFs in Modern Investing", content: ["Exchange-Traded Funds (ETFs) have become incredibly popular. Discover their advantages and how to incorporate them into your strategy."], imageUrl: "https://picsum.photos/400/200?random=5", publishedAt: serverTimestamp(), status: 'published', buttonText: '', buttonLink: '' },
    { title: "Navigating Market Volatility: Tips for Staying Calm", content: ["Market ups and downs are normal. Here are some proven strategies to help you stay the course during turbulent times."], imageUrl: "https://picsum.photos/400/200?random=6", publishedAt: serverTimestamp(), status: 'published', buttonText: '', buttonLink: '' },
    { title: "Retirement Planning: Are You on the Right Track?", content: ["It's never too early to start planning for retirement. Assess your current strategy and learn tips for a secure future."], imageUrl: "https://picsum.photos/400/200?random=7", publishedAt: serverTimestamp(), status: 'published', buttonText: '', buttonLink: '' },
    { title: "What is Risk Tolerance and How to Measure It?", content: ["Understanding your personal risk tolerance is the first step in building a suitable investment portfolio. Learn how to assess yours."], imageUrl: "https://picsum.photos/400/200?random=8", publishedAt: serverTimestamp(), status: 'published', buttonText: '', buttonLink: '' },
    { title: "Real Estate vs. Stocks: A Comparative Analysis", content: ["Two of the most popular investment avenues. We break down the pros and cons of investing in real estate versus the stock market."], imageUrl: "https://picsum.photos/400/200?random=9", publishedAt: serverTimestamp(), status: 'published', buttonText: '', buttonLink: '' },
    { title: "The Importance of Regular Portfolio Check-ups", content: ["Your financial situation and goals change over time. Learn why regular portfolio reviews are essential for long-term success."], imageUrl: "https://picsum.photos/400/200?random=10", publishedAt: serverTimestamp(), status: 'published', buttonText: '', buttonLink: '' },
];

export default function AdminBlogPage() {
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const [posts, setPosts] = useState<BlogPost[]>([]);
    const [loadingPosts, setLoadingPosts] = useState(true);
    const [editingPost, setEditingPost] = useState<Partial<BlogPost> | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    // New state for blog page content
    const [blogPageTitle, setBlogPageTitle] = useState('');
    const [blogPageDescription, setBlogPageDescription] = useState('');
    const [savingContent, setSavingContent] = useState(false);

    const fetchPosts = async () => {
        if (!db) return;
        setLoadingPosts(true);
        try {
            const querySnapshot = await getDocs(collection(db, 'blogPosts'));
            if (querySnapshot.empty) {
                const batch = writeBatch(db);
                initialPosts.forEach(post => {
                    const docRef = doc(collection(db, 'blogPosts'));
                    batch.set(docRef, post);
                });
                await batch.commit();
                // Re-fetch after seeding
                const newSnapshot = await getDocs(collection(db, 'blogPosts'));
                const postsData = newSnapshot.docs.map(doc => {
                    const data = doc.data();
                    return { id: doc.id, ...data, content: Array.isArray(data.content) ? data.content : [data.content] } as BlogPost
                });
                setPosts(postsData);
            } else {
                const postsData = querySnapshot.docs.map(doc => {
                    const data = doc.data();
                    return { id: doc.id, ...data, content: Array.isArray(data.content) ? data.content : [data.content] } as BlogPost
                });
                setPosts(postsData);
            }
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: `Failed to fetch posts: ${error.message}` });
        } finally {
            setLoadingPosts(false);
        }
    };
    
    const fetchPageContent = async () => {
        if (!db) return;
        try {
            const docRef = doc(db, 'template', 'landingPage');
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                setBlogPageTitle(data.blogPageTitle || 'Our Blog');
                setBlogPageDescription(data.blogPageDescription || 'News, updates, and thoughts from our team.');
            }
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: `Failed to fetch page content: ${error.message}` });
        }
    }
    
    const handleSavePageContent = async () => {
        if(!db) return;
        setSavingContent(true);
        try {
            const docRef = doc(db, 'template', 'landingPage');
            await setDoc(docRef, { blogPageTitle, blogPageDescription }, { merge: true });
            toast({ title: 'Success', description: 'Blog page content updated.'});
        } catch(error: any) {
            toast({ variant: 'destructive', title: 'Error', description: `Failed to save content: ${error.message}`});
        } finally {
            setSavingContent(false);
        }
    }

    useEffect(() => {
        fetchPosts();
        fetchPageContent();
    }, []);
    
    const handleEditPost = (post: BlogPost) => {
        const publishedDate = post.publishedAt?.toDate ? post.publishedAt.toDate().toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16);
        setEditingPost({...post, publishedAt: publishedDate });
        setIsDialogOpen(true);
    };

    const handleAddNew = () => {
        setEditingPost({
            title: '',
            content: [''],
            imageUrl: '',
            status: 'draft',
            publishedAt: new Date().toISOString().slice(0, 16),
            buttonText: '',
            buttonLink: '',
        });
        setIsDialogOpen(true);
    }
    
    const handleSavePost = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!db || !editingPost) return;
        
        setIsSubmitting(true);
        try {
            const postToSave = {
                title: editingPost.title || '',
                content: editingPost.content || [''],
                imageUrl: editingPost.imageUrl || '',
                status: editingPost.status || 'draft',
                buttonText: editingPost.buttonText || '',
                buttonLink: editingPost.buttonLink || '',
                publishedAt: Timestamp.fromDate(new Date(editingPost.publishedAt)),
            };

            if (editingPost.id) {
                const postRef = doc(db, 'blogPosts', editingPost.id);
                await setDoc(postRef, postToSave, { merge: true });
                toast({ title: 'Success', description: 'Post updated successfully.' });
            } else {
                await addDoc(collection(db, 'blogPosts'), postToSave);
                 toast({ title: 'Success', description: 'Post created successfully.' });
            }

            setIsDialogOpen(false);
            setEditingPost(null);
            fetchPosts();
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: `Failed to save post: ${error.message}` });
        } finally {
            setIsSubmitting(false);
        }
    }

    const handleContentChange = (index: number, value: string) => {
        if (!editingPost || !editingPost.content) return;
        const newContent = [...editingPost.content];
        newContent[index] = value;
        setEditingPost({ ...editingPost, content: newContent });
    };

    const addParagraph = () => {
        if (!editingPost) return;
        setEditingPost({ ...editingPost, content: [...(editingPost.content || []), ''] });
    };

    const removeParagraph = (index: number) => {
        if (!editingPost || !editingPost.content || editingPost.content.length <= 1) return;
        const newContent = editingPost.content.filter((_, i) => i !== index);
        setEditingPost({ ...editingPost, content: newContent });
    };
    
    const handleDeletePost = async (postId: string) => {
        if(!db) return;
        if (confirm('Are you sure you want to delete this post? This action cannot be undone.')) {
            try {
                await deleteDoc(doc(db, 'blogPosts', postId));
                toast({ title: 'Success', description: 'Post deleted successfully.'});
                fetchPosts();
            } catch (error: any) {
                 toast({ variant: 'destructive', title: 'Error', description: `Failed to delete post: ${error.message}` });
            }
        }
    }

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div className="flex justify-between items-center">
            <div>
                <h1 className="text-3xl font-bold font-headline tracking-tight">Blog Posts</h1>
                <p className="text-muted-foreground">Create and manage your blog content.</p>
            </div>
            <Button onClick={handleAddNew}><PlusCircle className="mr-2 h-4 w-4" /> Add New Post</Button>
        </div>

        <Card>
            <CardHeader>
                <CardTitle>Blog Page Content</CardTitle>
                <CardDescription>Edit the title and description for the main blog page that users see.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="blogTitle">Page Title</Label>
                    <Input id="blogTitle" value={blogPageTitle} onChange={(e) => setBlogPageTitle(e.target.value)} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="blogDescription">Page Description</Label>
                    <Textarea id="blogDescription" value={blogPageDescription} onChange={(e) => setBlogPageDescription(e.target.value)} />
                </div>
            </CardContent>
            <CardFooter>
                 <Button onClick={handleSavePageContent} disabled={savingContent}>
                    {savingContent && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Page Content
                </Button>
            </CardFooter>
        </Card>
        
        <Card>
            <CardHeader>
                <CardTitle>Existing Posts</CardTitle>
                <CardDescription>View, edit, or delete existing blog posts.</CardDescription>
            </CardHeader>
            <CardContent>
                {loadingPosts ? (
                    <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Image</TableHead>
                                <TableHead>Title</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Published On</TableHead>
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
                                    <TableCell><Badge variant={post.status === 'published' ? 'default' : 'secondary'} className="capitalize">{post.status}</Badge></TableCell>
                                    <TableCell>{post.publishedAt?.toDate ? format(post.publishedAt.toDate(), 'PPp') : 'N/A'}</TableCell>
                                    <TableCell className="text-right space-x-2">
                                        <Button variant="outline" size="icon" onClick={() => handleEditPost(post)}>
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
        <DialogContent className="sm:max-w-3xl">
            <DialogHeader>
                <DialogTitle>{editingPost?.id ? 'Edit' : 'Create'} Post</DialogTitle>
                <DialogDescription>Fill out the details for your blog post.</DialogDescription>
            </DialogHeader>
            {editingPost && (
            <form onSubmit={handleSavePost} className="max-h-[70vh] overflow-y-auto pr-4 space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="title">Title</Label>
                    <Input id="title" value={editingPost.title} onChange={(e) => setEditingPost(p => ({...p, title: e.target.value}))} required/>
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="imageUrl">Image URL</Label>
                    <Input id="imageUrl" value={editingPost.imageUrl} onChange={(e) => setEditingPost(p => ({...p, imageUrl: e.target.value}))} required />
                </div>
                <div className="space-y-4">
                    <Label>Content</Label>
                    {editingPost.content?.map((paragraph, index) => (
                        <div key={index} className="flex items-start gap-2">
                            <Textarea
                                value={paragraph}
                                onChange={(e) => handleContentChange(index, e.target.value)}
                                rows={3}
                                placeholder={`Paragraph ${index + 1}`}
                            />
                            <Button
                                type="button"
                                variant="destructive"
                                size="icon"
                                onClick={() => removeParagraph(index)}
                                disabled={editingPost.content && editingPost.content.length <= 1}
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                    ))}
                    <Button type="button" variant="outline" onClick={addParagraph}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Add Paragraph
                    </Button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="buttonText">Button Text (Optional)</Label>
                        <Input id="buttonText" value={editingPost.buttonText || ''} onChange={(e) => setEditingPost(p => ({...p, buttonText: e.target.value}))} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="buttonLink">Button Link (Optional)</Label>
                        <Input id="buttonLink" value={editingPost.buttonLink || ''} onChange={(e) => setEditingPost(p => ({...p, buttonLink: e.target.value}))} />
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Status</Label>
                        <select
                            value={editingPost.status}
                            onChange={(e) => setEditingPost(p => ({...p, status: e.target.value as 'draft' | 'published'}))}
                            className="w-full p-2 border rounded-md bg-background"
                        >
                            <option value="draft">Draft</option>
                            <option value="published">Published</option>
                        </select>
                    </div>
                     <div className="space-y-2">
                        <Label>Publish Date</Label>
                        <Input 
                            type="datetime-local"
                            value={editingPost.publishedAt}
                            onChange={(e) => setEditingPost(p => ({...p, publishedAt: e.target.value}))}
                        />
                    </div>
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
