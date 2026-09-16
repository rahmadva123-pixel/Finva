
"use client";

import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { useParams } from "next/navigation";
import React, { useEffect, useState, useRef } from "react";
import { Loader2 } from "lucide-react";
import ReactMarkdown from 'react-markdown';
import { Header } from "@/components/layout/header";
import { useAuth } from "@/hooks/use-auth";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface ContentPageSection {
    id: string;
    title: string;
    type: 'markdown' | 'html';
    description: string;
    htmlContent?: string;
    imageUrl?: string;
    imagePosition?: 'top' | 'left' | 'right';
    imageAlignment?: 'left' | 'center' | 'right';
    imageWidth?: number;
    imageHeight?: number;
    buttonText?: string;
    buttonLink?: string;
    sectionBackgroundColor?: string;
    sectionBackgroundImageUrl?: string;
    sectionBackgroundOverlayColor?: string;
    titleColor?: string;
    titleSize?: string;
    contentColor?: string;
    contentSize?: string;
    contentAlignment?: 'left' | 'center' | 'right';
    buttonBackgroundColor?: string;
    buttonTextColor?: string;
    isolated?: boolean;
}

interface CustomPage {
    id: string;
    path: string;
    title: string;
    sections: ContentPageSection[];
}

interface AllPagesData {
    customPages: CustomPage[];
}

// Component to handle HTML with scripts
const HtmlRenderer: React.FC<{ htmlContent: string }> = ({ htmlContent }) => {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (ref.current) {
            const container = ref.current;
            container.innerHTML = htmlContent;

            const scripts = Array.from(container.getElementsByTagName('script'));
            scripts.forEach(oldScript => {
                const newScript = document.createElement('script');
                
                Array.from(oldScript.attributes).forEach(attr => {
                    newScript.setAttribute(attr.name, attr.value);
                });
                
                newScript.appendChild(document.createTextNode(oldScript.innerHTML));
                
                // Use a timeout to ensure the DOM is ready for the script
                setTimeout(() => {
                    oldScript.parentNode?.replaceChild(newScript, oldScript);
                }, 0);
            });
        }
    }, [htmlContent]);

    return <div ref={ref} />;
};

const IsolatedHtmlSection: React.FC<{ section: ContentPageSection }> = ({ section }) => {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const uniqueId = `iframe-${section.id}`;

    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (event.source !== iframeRef.current?.contentWindow) return;
            if (event.data.frameId === uniqueId) {
                if (iframeRef.current) {
                    iframeRef.current.style.height = `${event.data.frameHeight}px`;
                }
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [uniqueId]);

    const iframeContent = `
        <html>
        <head>
            <base target="_parent">
            <style>
                body { margin: 0; }
            </style>
        </head>
        <body>
            ${section.htmlContent || ''}
            <script>
                const resizeObserver = new ResizeObserver(() => {
                    window.parent.postMessage({
                        frameId: '${uniqueId}',
                        frameHeight: document.body.scrollHeight
                    }, '*');
                });
                resizeObserver.observe(document.body);
            <\/script>
        </body>
        </html>
    `;

    return (
        <iframe
            ref={iframeRef}
            id={uniqueId}
            srcDoc={iframeContent}
            style={{ width: '100%', border: 'none', display: 'block' }}
            title={section.title}
            scrolling="no"
        />
    );
};


export default function CustomPageDisplay() {
    const { user } = useAuth();
    const params = useParams();
    const slug = params.slug as string;
    const [pageData, setPageData] = useState<CustomPage | null>(null);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);

    useEffect(() => {
        if (!db || !slug) return;

        const fetchContent = async () => {
            setLoading(true);
            try {
                const docRef = doc(db, 'settings', 'contentPages');
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const data = docSnap.data() as AllPagesData;
                    const foundPage = data.customPages.find(p => p.path === slug);
                    if (foundPage) {
                        setPageData(foundPage);
                    } else {
                        setNotFound(true);
                    }
                } else {
                    setNotFound(true);
                }
            } catch (error) {
                console.error("Error fetching custom page:", error);
                setNotFound(true);
            } finally {
                setLoading(false);
            }
        };
        fetchContent();
    }, [slug]);

    const pageContent = (
         <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="text-3xl font-bold font-headline tracking-tight">{pageData?.title}</CardTitle>
                </CardHeader>
                <CardContent className="p-0 sm:p-6 space-y-0">
                   {(pageData?.sections || []).map(section => {
                       const sectionStyle = {
                           backgroundColor: section.sectionBackgroundColor,
                           backgroundImage: section.sectionBackgroundImageUrl ? `url(${section.sectionBackgroundImageUrl})` : undefined,
                           backgroundSize: 'cover',
                           backgroundPosition: 'center',
                           position: 'relative',
                       } as React.CSSProperties;

                       const overlayStyle = section.sectionBackgroundOverlayColor ? {
                           position: 'absolute',
                           inset: 0,
                           backgroundColor: section.sectionBackgroundOverlayColor,
                           zIndex: 0,
                           borderRadius: 'inherit'
                       } as React.CSSProperties : {};
                       
                        const imageAlignmentClass = {
                           'left': 'justify-start',
                           'center': 'justify-center',
                           'right': 'justify-end'
                       }[section.imageAlignment || 'center'];

                       const contentAlignmentClass = {
                           'left': 'text-left',
                           'center': 'text-center',
                           'right': 'text-right'
                       }[section.contentAlignment || 'left'];

                       return (
                        <div key={section.id} style={sectionStyle} className="p-6 sm:p-8 md:p-12 relative overflow-hidden first:rounded-t-lg last:rounded-b-lg">
                            <div style={overlayStyle}></div>
                            <div className="relative z-10">
                                <div className={cn(
                                    "flex flex-col gap-6",
                                    (section.imagePosition === 'left' || section.imagePosition === 'right') && "md:flex-row md:items-start"
                                )}>
                                    {section.imageUrl && (
                                        <div className={cn(
                                            "relative shrink-0", 
                                            section.imagePosition === 'right' && "md:order-last", 
                                            (section.imagePosition === 'left' || section.imagePosition === 'right') ? "md:w-1/3" : `w-full flex ${imageAlignmentClass}`
                                        )}>
                                            <Image 
                                                src={section.imageUrl} 
                                                alt={section.title} 
                                                width={section.imageWidth || 600} 
                                                height={section.imageHeight || 400}
                                                className="object-cover rounded-lg" 
                                            />
                                        </div>
                                    )}
                                    <div className={cn("flex-1", contentAlignmentClass)}>
                                        <h2 
                                            className={cn("font-semibold mb-2", `text-${section.titleSize || '2xl'}`)}
                                            style={{ color: section.titleColor }}
                                        >
                                            {section.title}
                                        </h2>
                                        <div 
                                            className={cn("prose prose-invert max-w-none", `text-${section.contentSize || 'base'}`)}
                                            style={{ color: section.contentColor }}
                                        >
                                             {section.type === 'html' ? (
                                                section.isolated ? (
                                                    <IsolatedHtmlSection section={section} />
                                                ) : (
                                                    <HtmlRenderer htmlContent={section.htmlContent || ''} />
                                                )
                                            ) : (
                                                <ReactMarkdown>{section.description}</ReactMarkdown>
                                            )}
                                        </div>
                                        {section.buttonText && section.buttonLink && (
                                            <div className="mt-6">
                                                <Button 
                                                    asChild
                                                    style={{
                                                        backgroundColor: section.buttonBackgroundColor,
                                                        color: section.buttonTextColor,
                                                    }}
                                                >
                                                    <a href={section.buttonLink} target="_blank" rel="noopener noreferrer">
                                                        {section.buttonText}
                                                    </a>
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                   )})}
                </CardContent>
            </Card>
        </div>
    );
    
    if (loading) {
        return (
            <div className="flex flex-col min-h-screen">
                <Header />
                <main className="flex-grow flex justify-center items-center">
                    <Loader2 className="h-8 w-8 animate-spin" />
                </main>
            </div>
        )
    }
    
    if (notFound || !pageData) {
        return (
            <div className="flex flex-col min-h-screen">
                <Header />
                <main className="flex-grow flex flex-col justify-center items-center text-center">
                    <h1 className="text-4xl font-bold">404</h1>
                    <p className="text-muted-foreground">Page not found.</p>
                </main>
            </div>
        )
    }

    if (user) {
        return <DashboardLayout>{pageContent}</DashboardLayout>
    }

    return (
        <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {pageContent}
            </main>
        </div>
    );
}
