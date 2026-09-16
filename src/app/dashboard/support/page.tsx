
"use client";

import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import React, { useEffect, useState, useRef } from "react";
import { Loader2, Mail } from "lucide-react";
import ReactMarkdown from 'react-markdown';
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

interface PageData {
    title: string;
    description: string;
    sections: ContentPageSection[];
    phone?: string;
    supportEmail?: string;
    whatsappUrl?: string;
    telegramUrl?: string;
}

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


export default function SupportPage() {
    const [pageData, setPageData] = useState<PageData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchContent = async () => {
            if (!db) return;
            try {
                const docRef = doc(db, 'settings', 'contentPages');
                const docSnap = await getDoc(docRef);
                if (docSnap.exists() && docSnap.data().support) {
                    const data = docSnap.data().support;
                     if (Array.isArray(data.sections)) {
                        data.sections = data.sections.map((s: any) => ({ ...s, type: s.type || 'markdown' }));
                    } else {
                        data.sections = [{id: '1', title: 'How to get started?', description: 'This is how you get started.', type: 'markdown'}];
                    }
                    setPageData(data);
                } else {
                    setPageData({
                        title: "Support Center",
                        description: "Find answers to common questions and get help from our team.",
                        sections: [
                            { id: '1', title: "How do I make a deposit?", description: "Navigate to the Finance > Deposit section, choose a payment method, and follow the on-screen instructions.", type: 'markdown' },
                            { id: '2', title: "How can I contact support?", description: "Our support team is available 24/7. You can reach us via the live chat feature or by emailing support@example.com.", type: 'markdown' },
                        ]
                    });
                }
            } catch (error) {
                console.error("Error fetching support page content:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchContent();
    }, []);

    if (loading) {
        return (
            <DashboardLayout>
                <div className="flex justify-center items-center h-full">
                    <Loader2 className="h-8 w-8 animate-spin" />
                </div>
            </DashboardLayout>
        )
    }
    
    if (!pageData) {
        return (
             <DashboardLayout>
                <div className="flex justify-center items-center h-full">
                   <p>Could not load page content.</p>
                </div>
            </DashboardLayout>
        )
    }

    return (
        <DashboardLayout>
            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold font-headline tracking-tight">{pageData.title}</h1>
                    <p className="text-muted-foreground">{pageData.description}</p>
                </div>
                
                 {pageData.supportEmail && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Support Email</CardTitle>
                            <CardDescription>Contact us using the email address below.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center gap-3 rounded-lg border p-4 text-sm sm:text-base">
                                <Mail className="h-5 w-5 text-primary shrink-0" />
                                <span className="font-medium break-all">{pageData.supportEmail}</span>
                            </div>
                        </CardContent>
                    </Card>
                )}

                 <Card>
                    <CardContent className="p-0 sm:p-0">
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
        </DashboardLayout>
    );
}
