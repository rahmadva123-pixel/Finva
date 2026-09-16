
"use client";

import React, { useState, useEffect } from 'react';
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { Loader2, ArrowLeft, Calendar } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import Image from 'next/image';
import { format } from 'date-fns';
import ReactMarkdown from 'react-markdown';
import { useAuth } from '@/hooks/use-auth';

interface BlogPost {
  id: string;
  title: string;
  content: string[];
  imageUrl: string;
  publishedAt: any;
  buttonText?: string;
  buttonLink?: string;
}

export default function BlogPostPage() {
    const params = useParams();
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const postId = params.postId as string;
    const [post, setPost] = useState<BlogPost | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (authLoading) return;
        if (!user) {
            router.replace(`/blog/${postId}`);
            return;
        }

        if (!db || !postId) { 
            setLoading(false); 
            return; 
        }

        const fetchPost = async () => {
            setLoading(true);
            try {
                const docRef = doc(db, "blogPosts", postId);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setPost({ id: docSnap.id, ...data, content: Array.isArray(data.content) ? data.content : [data.content] } as BlogPost);
                } else {
                    router.push('/dashboard/blog');
                }
            } catch (error) {
                console.error("Error fetching blog post:", error);
                 router.push('/dashboard/blog');
            } finally {
                setLoading(false);
            }
        };
        fetchPost();
    }, [postId, router, user, authLoading]);

    if (loading || authLoading || !user) {
        return (
            <DashboardLayout>
                <div className="flex justify-center items-center h-full">
                    <Loader2 className="h-8 w-8 animate-spin" />
                </div>
            </DashboardLayout>
        );
    }
    
    if (!post) {
        return (
            <DashboardLayout>
                <div className="flex justify-center items-center h-full">
                    <p>Post not found.</p>
                </div>
            </DashboardLayout>
        )
    }

    return (
        <DashboardLayout>
            <div className="max-w-4xl mx-auto space-y-6">
                <Button variant="ghost" onClick={() => router.back()}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back to Blog
                </Button>

                <article className="space-y-8 bg-card p-6 sm:p-8 rounded-lg">
                    <div className="space-y-4">
                        <h1 className="text-3xl sm:text-4xl font-bold font-headline tracking-tight">{post.title}</h1>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Calendar className="h-4 w-4" />
                            <span>Published on {post.publishedAt?.toDate ? format(post.publishedAt.toDate(), 'PPP') : ''}</span>
                        </div>
                    </div>
                    
                    {post.imageUrl && (
                         <div className="aspect-video relative rounded-lg overflow-hidden">
                            <Image src={post.imageUrl} alt={post.title} layout="fill" className="object-cover" />
                        </div>
                    )}

                    <div className="prose prose-invert prose-lg max-w-none space-y-4">
                       {post.content.map((paragraph, index) => (
                           <ReactMarkdown key={index}>{paragraph}</ReactMarkdown>
                       ))}
                    </div>

                    {post.buttonLink && post.buttonText && (
                        <div className="mt-8">
                            <Button asChild>
                                <a href={post.buttonLink} target="_blank" rel="noopener noreferrer">
                                    {post.buttonText}
                                </a>
                            </Button>
                        </div>
                    )}
                </article>
            </div>
        </DashboardLayout>
    );
}
