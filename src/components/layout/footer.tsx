
"use client";

import React, { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { usePreloader } from '../providers/preloader-provider';

interface LinkItem {
    id: string;
    label: string;
    href: string;
}

interface MenuList {
    id: string;
    title: string;
    links: LinkItem[];
}

interface FooterSettings {
    brandDescription: string;
    logoUrl: string;
    menuLists: MenuList[];
    copyrightText: string;
    showOnAllPages: boolean;
    downloadAppTitle?: string;
    downloadAppSubtitle?: string;
    googlePlayImageUrl?: string;
    googlePlayLink?: string;
    appStoreImageUrl?: string;
    appStoreLink?: string;
}

const defaultFooterSettings: FooterSettings = {
    brandDescription: "A modern trading platform to grow your wealth securely and confidently.",
    logoUrl: '',
    menuLists: [],
    copyrightText: "© {year} All Rights Reserved.",
    showOnAllPages: true,
    downloadAppTitle: 'Get Finva — Mobile App',
    downloadAppSubtitle: 'Fast trades, live markets — install the app for the best experience.',
    googlePlayImageUrl: '',
    googlePlayLink: '#',
    appStoreImageUrl: '',
    appStoreLink: '#',
};


export function Footer() {
    const { appLoading } = usePreloader();
    const [settings, setSettings] = useState<FooterSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const pathname = usePathname();

    useEffect(() => {
        const fetchSettings = async () => {
            if (!db) { setLoading(false); return; }
            try {
                const docRef = doc(db, 'settings', 'footer');
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                     const rawSettings = { ...defaultFooterSettings, ...docSnap.data() } as FooterSettings;
                     const filteredMenuLists = (rawSettings.menuLists || []).map((list) => ({
                        ...list,
                        links: (list.links || []).filter(
                            (link) => !/blog/i.test(link.label || '') && !String(link.href || '').includes('/blog')
                        ),
                     })).filter((list) => list.links.length > 0);
                     setSettings({ ...rawSettings, menuLists: filteredMenuLists });
                } else {
                    setSettings(defaultFooterSettings);
                }
            } catch (error) {
                console.error("Error fetching footer settings:", error);
                 setSettings(defaultFooterSettings);
            } finally {
                setLoading(false);
            }
        };
        fetchSettings();
    }, []);

    if (appLoading) {
        return null;
    }

    if (loading) {
        return (
            <footer className="bg-card/50 border-t border-border/50">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-16">
                    <div className="h-24 bg-muted/50 animate-pulse rounded-lg"></div>
                </div>
            </footer>
        );
    }
    
    if (!settings || (!settings.showOnAllPages && pathname !== '/')) {
        return null;
    }

    const resolveAppLink = (link?: string) => {
        const trimmedLink = String(link || '').trim();
        return trimmedLink && trimmedLink !== '#' ? trimmedLink : '/install-app';
    };

    return (
        <footer className="bg-card/50 border-t border-border/50">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-16">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Brand Section */}
                    <div className="lg:col-span-4 text-center md:text-left">
                        {settings.logoUrl && (
                            <div className="flex items-center justify-center md:justify-start mb-4">
                                <Image src={settings.logoUrl} alt="Logo" width={120} height={40} objectFit="contain" />
                            </div>
                        )}
                        <p className="text-muted-foreground">{settings.brandDescription}</p>
                    </div>

                    {/* Link Sections */}
                    <div className="lg:col-span-5 grid grid-cols-2 md:grid-cols-3 gap-8">
                        {settings.menuLists && settings.menuLists.map(list => (
                            <div key={list.id} className="text-center md:text-left">
                                <h4 className="font-headline font-semibold mb-4">{list.title}</h4>
                                <ul className="space-y-2">
                                    {list.links.map(link => (
                                        <li key={link.id}>
                                            <Link href={link.href} className="text-muted-foreground hover:text-primary">
                                                {link.label}
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>

                    {/* Download Section */}
                    {(settings.downloadAppTitle || settings.googlePlayImageUrl || settings.appStoreImageUrl) && !pathname?.startsWith('/dashboard') && (
                        <div className="lg:col-span-3 text-center md:text-left">
                            {settings.downloadAppTitle && <h4 className="font-headline font-semibold mb-4">{settings.downloadAppTitle}</h4>}
                            {settings.downloadAppSubtitle && <p className="text-muted-foreground mb-4">{settings.downloadAppSubtitle}</p>}
                            <div className="flex flex-col items-center md:items-start gap-4">
                                {(!settings.googlePlayImageUrl || settings.googlePlayImageUrl.trim() === '') && (!settings.appStoreImageUrl || settings.appStoreImageUrl.trim() === '') && (
                                    <Link href="/install-app" className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90">
                                        Get Finva
                                    </Link>
                                )}
                                {settings.googlePlayImageUrl && settings.googlePlayImageUrl.trim() !== '' && (
                                    <Link href={resolveAppLink(settings.googlePlayLink)} target="_blank" rel="noopener noreferrer">
                                        <Image src={settings.googlePlayImageUrl} alt="Get it on Google Play" width={135} height={40} />
                                    </Link>
                                )}
                                {settings.appStoreImageUrl && settings.appStoreImageUrl.trim() !== '' && (
                                    <Link href={resolveAppLink(settings.appStoreLink)} target="_blank" rel="noopener noreferrer">
                                        <Image src={settings.appStoreImageUrl} alt="Download on the App Store" width={135} height={40} />
                                    </Link>
                                )}
                            </div>
                        </div>
                    )}
                </div>
                <div className="mt-12 pt-8 border-t border-border/50 text-center text-muted-foreground">
                    <p>{settings.copyrightText ? settings.copyrightText.replace('{year}', new Date().getFullYear().toString()) : `© ${new Date().getFullYear()} All Rights Reserved.`}</p>
                </div>
            </div>
        </footer>
    );
}
