
"use client";

import React, { useState, useEffect } from 'react';
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, Loader2 } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, orderBy, doc, getDoc } from 'firebase/firestore';
import Image from 'next/image';
import Link from 'next/link';
import { format } from 'date-fns';
import { useAuth } from '@/hooks/use-auth';
import ReactMarkdown from 'react-markdown';

interface BlogPost {
  id: string;
  title: string;
  content: string[];
  imageUrl: string;
  publishedAt: any;
  status: 'draft' | 'published';
  buttonText?: string;
  buttonLink?: string;
}

interface TemplateData {
    blogPageTitle?: string;
    blogPageDescription?: string;
}

export default function BlogListPage() {
    const { user, loading: authLoading } = useAuth();
    const [posts, setPosts] = useState<BlogPost[]>([]);
    const [loading, setLoading] = useState(true);
    const [templateData, setTemplateData] = useState<TemplateData>({});
    
    const blogUrl = (postId: string) => user ? `/dashboard/blog/${postId}` : `/blog/${postId}`;

    useEffect(() => {
        const fetchContent = async () => {
            if (!db) { setLoading(false); return; }
            setLoading(true);
            try {
                const templateDoc = await getDoc(doc(db, "template", "landingPage"));
                if (templateDoc.exists()) {
                    const data = templateDoc.data();
                    setTemplateData({
                        blogPageTitle: data.blogPageTitle,
                        blogPageDescription: data.blogPageDescription
                    });
                }

                const postsQuery = query(collection(db, "blogPosts"), where("status", "==", "published"), orderBy("publishedAt", "desc"));
                const querySnapshot = await getDocs(postsQuery);
                const postsData = querySnapshot.docs.map(doc => {
                    const data = doc.data();
                    return { id: doc.id, ...data, content: Array.isArray(data.content) ? data.content : [data.content] } as BlogPost
                });
                
                setPosts(postsData);
            } catch (error) {
                console.error("Error fetching blog posts:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchContent();
    }, []);
    
    if (loading || authLoading) {
        return (
            <DashboardLayout>
                <div className="flex justify-center items-center h-full">
                    <Loader2 className="h-8 w-8 animate-spin" />
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout>
            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold font-headline tracking-tight">{templateData.blogPageTitle || "Our Blog"}</h1>
                    <p className="text-muted-foreground">{templateData.blogPageDescription || "News, updates, and thoughts from our team."}</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {posts.map(post => (
                        <Card key={post.id} className="flex flex-col">
                            <CardHeader className="p-0">
                                <div className="aspect-video relative">
                                    <Image src={post.imageUrl || 'https://placehold.co/400x200'} alt={post.title} layout="fill" className="object-cover rounded-t-lg" />
                                </div>
                            </CardHeader>
                            <CardContent className="p-6 flex-grow">
                                <p className="text-xs text-muted-foreground mb-2">{post.publishedAt?.toDate ? format(post.publishedAt.toDate(), 'PPP') : ''}</p>
                                <h3 className="text-lg font-bold font-headline leading-snug">{post.title}</h3>
                                <div className="text-sm text-muted-foreground mt-2 line-clamp-3 prose prose-sm prose-invert">
                                    <ReactMarkdown>{(post.content || []).join(' ')}</ReactMarkdown>
                                </div>
                                {post.buttonLink && post.buttonText && (
                                    <div className="mt-4">
                                        <Button asChild size="sm">
                                            <a href={post.buttonLink} target="_blank" rel="noopener noreferrer">
                                                {post.buttonText}
                                            </a>
                                        </Button>
                                    </div>
                                )}
                            </CardContent>
                            <CardFooter>
                                <Button asChild variant="secondary" className="w-full">
                                    <Link href={blogUrl(post.id)}>
                                        Read More <ArrowRight className="ml-2 h-4 w-4" />
                                    </Link>
                                </Button>
                            </CardFooter>
                        </Card>
                    ))}
                </div>
                 {posts.length === 0 && (
                    <Card>
                        <CardContent className="p-8 text-center text-muted-foreground">
                            No blog posts have been published yet.
                        </CardContent>
                    </Card>
                )}
            </div>
        </DashboardLayout>
    );
}
