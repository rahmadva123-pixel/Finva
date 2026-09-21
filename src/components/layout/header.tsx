
"use client";

import Link from 'next/link';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubTrigger,
    DropdownMenuSubContent,
    DropdownMenuPortal,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Bell, User, LogOut, MoreVertical, Wallet, Landmark, Menu, CheckCircle, Clock, XCircle, Gift, TrendingUp, CircleDollarSign, Phone, MessageSquare, ArrowRight, LayoutDashboard, Sun, Moon, ChevronDown, ArrowDownCircle } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter, usePathname } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import { db, auth } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import { getCachedDoc } from '@/lib/clientCache';
import { doc, getDoc, onSnapshot, collection, query, where, orderBy, limit, writeBatch } from 'firebase/firestore';
import Image from 'next/image';
import { Badge } from '../ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { LanguageSwitcher } from '../ui/language-switcher';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import * as LucideIcons from "lucide-react";
import { cn } from '@/lib/utils';
import { usePreloader } from '../providers/preloader-provider';
import { normalizeBrandText } from '@/lib/branding';

interface SubMenuItem {
    id: string;
    label: string;
    href: string;
    icon?: string;
}

interface HeaderMenuItem {
    id: string;
    label: string;
    href: string;
    icon?: string;
    subItems?: SubMenuItem[];
}

interface SupportPageData {
    whatsappUrl?: string;
}

interface Notification {
    id: string;
    title: string;
    description: string;
    isRead: boolean;
    createdAt: any;
    link?: string;
    type: string;
}

interface CurrencySettings {
  symbol: string;
  position: 'left' | 'right';
  mainWalletName?: string;
  mainWalletIcon?: string;
}

export function Header({ onMobileNavToggle }: { onMobileNavToggle?: () => void }) {
  const { user, loading: authLoading } = useAuth();
  const { appLoading } = usePreloader();
  const router = useRouter();
    const pathname = usePathname();
  const [logoUrl, setLogoUrl] = useState('');
  const [logoText, setLogoText] = useState('');
    const [brandTagline, setBrandTagline] = useState('');
  const [showLogoTextWithImage, setShowLogoTextWithImage] = useState(true);
  const [logoWidth, setLogoWidth] = useState(32);
  const [logoHeight, setLogoHeight] = useState(32);
  const [templateLoading, setTemplateLoading] = useState(true);
    const [isDark, setIsDark] = useState<boolean>(false);
  const [balance, setBalance] = useState(0);
  const [currency, setCurrency] = useState<CurrencySettings>({ 
    symbol: '$', 
    position: 'left',
    mainWalletName: 'Main Wallet',
    mainWalletIcon: 'Wallet',
  });
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [userPhoto, setUserPhoto] = useState('');
  const [supportData, setSupportData] = useState<SupportPageData | null>(null);
  const [headerMenuItems, setHeaderMenuItems] = useState<HeaderMenuItem[]>([]);
  
  const MainWalletIcon = (LucideIcons as any)[currency.mainWalletIcon || 'Wallet'] || Wallet;

  useEffect(() => {
    if (!db) return;
    
    const fetchTemplateSettings = async () => {
        setTemplateLoading(true);
        const data = await getCachedDoc('template', 'landingPage');
                if (data) {
            setLogoUrl(data.logoUrl || '');
            setLogoText(normalizeBrandText(data.headerLogoText));
            setShowLogoTextWithImage(data.showLogoTextWithImage ?? true);
            setLogoWidth(data.logoWidth || 32);
            setLogoHeight(data.logoHeight || 32);
            if (data.supportPage) {
                setSupportData(data.supportPage);
            }
            if (data.headerMenuItems) {
                const filteredMenuItems = (data.headerMenuItems as HeaderMenuItem[])
                  .map((item) => ({
                    ...item,
                    subItems: item.subItems?.filter(
                      (sub) => !/blog/i.test(sub.label || '') && !String(sub.href || '').includes('/blog')
                    ),
                  }))
                  .filter(
                    (item) => !/blog/i.test(item.label || '') && !String(item.href || '').includes('/blog') && (!item.subItems || item.subItems.length > 0)
                  );
                setHeaderMenuItems(filteredMenuItems);
            }
                        setBrandTagline(data.brandDescription || '');
                } else {
                        setLogoText('Finva');
                        setBrandTagline('');
                }
        setTemplateLoading(false);
    }

    const fetchCurrencySettings = async () => {
        const data = await getCachedDoc('settings', 'currency');
        if (data) setCurrency(prev => ({ ...prev, ...data }));
    }

    fetchTemplateSettings();
    fetchCurrencySettings();

    if (user) {
        const userDocRef = doc(db, "users", user.uid);
        const unsubscribeUser = onSnapshot(userDocRef, (doc) => {
            if (doc.exists()) {
                const data = doc.data();
                setBalance(data.balance || 0);
                setUserPhoto(data.photoURL || '');
            }
        });
        
        const notificationsQuery = query(
            collection(db, "notifications"), 
            where("userId", "==", user.uid),
            limit(10)
        );
        const unsubscribeNotifications = onSnapshot(notificationsQuery, (snapshot) => {
            const notifs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification))
                .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)); // Manual sort as a fallback
            setNotifications(notifs);
            setUnreadCount(notifs.filter(n => !n.isRead).length);
        }, (error) => {
            console.error("Error fetching notifications: ", error);
        });

        return () => {
            unsubscribeUser();
            unsubscribeNotifications();
        }
    }

  }, [user]);

    useEffect(() => {
        try {
            const current = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
            setIsDark(Boolean(current));
        } catch (e) {
            setIsDark(false);
        }
    }, []);
  
  const handleMarkAsRead = async () => {
    if(!db || !user || unreadCount === 0) return;
    const batch = writeBatch(db);
    notifications.forEach(notification => {
        if (!notification.isRead) {
            const notifRef = doc(db, "notifications", notification.id);
            batch.update(notifRef, { isRead: true });
        }
    });
    try {
      await batch.commit();
    } catch (e) {
      console.error("Error marking notifications as read: ", e);
    }
  }
    const firstName = user?.displayName ? String(user.displayName).split(' ')[0] : (user?.email ? String(user.email).split('@')[0] : '');
    const handleLogout = async () => {
        try {
            if (auth) {
                await signOut(auth);
            }
            try { router.push('/login'); } catch (e) { /* ignore */ }
        } catch (e) {
            console.error('Error during logout', e);
        }
    }
    if (appLoading) return null;

    return (
        <header className="fixed top-0 left-0 right-0 z-40 border-b backdrop-blur-sm shadow-sm" style={{ background: 'var(--topbar-background)', color: 'var(--topbar-foreground)', borderColor: 'var(--topbar-border)' }}>
            <div className="mx-auto w-full max-w-full sm:max-w-6xl px-4 sm:px-6 flex h-16 items-center justify-between">

                {/* Left: mobile menu + logo */}
                <div className="flex items-center gap-2">
                    {user && onMobileNavToggle ? (
                        <Button variant="ghost" size="icon" className="sm:hidden text-topbar-foreground" onClick={onMobileNavToggle}>
                            <Menu className="h-6 w-6" />
                            <span className="sr-only">Toggle Menu</span>
                        </Button>
                    ) : (
                        <div className="sm:hidden w-8" />
                    )}

                    <div className="flex items-center gap-3">
                        {templateLoading ? (
                            <div className="h-8 w-32 bg-muted/50 rounded-md animate-pulse" />
                        ) : (
                            <>
                                {logoUrl && logoUrl.trim() !== '' ? (
                                    <Image src={logoUrl} alt={logoText} width={logoWidth} height={logoHeight} />
                                ) : null}
                                {(!logoUrl || showLogoTextWithImage) && (
                                    <div className="flex flex-col">
                                        <span className="text-lg font-semibold font-headline tracking-tight text-topbar-foreground">{logoText}</span>
                                        {brandTagline && <span className="hidden md:block text-xs text-topbar-foreground/70">{brandTagline}</span>}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {/* Middle: desktop nav */}
                <nav className="hidden md:flex items-center gap-4">
                    <div className="relative">
                        <input
                            placeholder="Search markets, symbols or orders"
                            className="w-64 bg-card border border-border rounded-md px-3 py-2 text-sm text-card-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                    </div>

                    {headerMenuItems.map(item => {
                        const Icon = (LucideIcons as any)[item.icon || ''] || null;
                        const hasSubItems = item.subItems && item.subItems.length > 0;

                        if (hasSubItems) {
                            return (
                                <DropdownMenu key={item.id}>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" className="flex items-center gap-2 text-sm font-medium text-topbar-foreground/90 hover:text-primary hover:bg-transparent">
                                            {Icon && <Icon className="h-4 w-4 text-topbar-foreground" />}
                                            {item.label}
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent>
                                        {item.subItems?.map(sub => {
                                            const SubIcon = (LucideIcons as any)[sub.icon || ''] || null;
                                            return (
                                                <DropdownMenuItem key={sub.id} asChild>
                                                    <Link href={sub.href} className="flex items-center gap-2">
                                                         {SubIcon && <SubIcon className="h-4 w-4" />}
                                                         {sub.label}
                                                    </Link>
                                                </DropdownMenuItem>
                                            )
                                        })}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            )
                        }

                        return (
                            <Button key={item.id} variant="ghost" asChild className="text-sm font-medium text-topbar-foreground/90">
                                <Link href={item.href} className="flex items-center gap-2">
                                    {Icon && <Icon className="h-4 w-4 text-topbar-foreground" />}
                                    {item.label}
                                </Link>
                            </Button>
                        )
                    })}
                </nav>

                {/* Right: controls */}
                <div className="flex items-center gap-1 sm:gap-2">
                    <LanguageSwitcher className={cn(user && "hidden sm:inline-flex")} />

                    <Button variant="ghost" size="icon" onClick={() => {
                        try {
                            const newDark = !isDark;
                            if (typeof document !== 'undefined') document.documentElement.classList.toggle('dark', newDark);
                            if (typeof window !== 'undefined') window.localStorage.setItem('theme', newDark ? 'dark' : 'light');
                            setIsDark(newDark);
                        } catch(e) { console.warn(e); }
                    }} aria-label="Toggle theme">
                        {isDark ? <Sun className="h-4 w-4 text-topbar-foreground" /> : <Moon className="h-4 w-4 text-topbar-foreground" />}
                    </Button>

                    { authLoading ? (
                        <div className="h-8 w-20 bg-muted rounded-md animate-pulse"></div>
                    ) : user ? (
                        <>
                            <DropdownMenu onOpenChange={(open) => open && handleMarkAsRead()}>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="rounded-full relative">
                                        <Bell className="h-5 w-5 text-topbar-foreground" />
                                        {unreadCount > 0 && <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center bg-red-500 text-white">{unreadCount}</Badge>}
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-80">
                                     <DropdownMenuLabel className="flex justify-between items-center">
                                        <span>Notifications</span>
                                        <Link href="/dashboard/notifications" className="text-xs font-normal text-primary hover:underline">View All</Link>
                                    </DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    {notifications.length > 0 ? (
                                        notifications.map(notif => (
                                            <DropdownMenuItem key={notif.id} className="flex items-start gap-3" asChild>
                                                <Link href={`/dashboard/notifications?notifId=${notif.id}`}>
                                                    {getNotificationIcon(notif.type)}
                                                    <div className="flex-1">
                                                        <p className="font-semibold">{notif.title}</p>
                                                        <p className="text-xs text-muted-foreground">{notif.createdAt?.seconds ? formatDistanceToNow(new Date(notif.createdAt.seconds * 1000), { addSuffix: true }) : 'just now'}</p>
                                                    </div>
                                                </Link>
                                            </DropdownMenuItem>
                                        ))
                                    ) : (
                                        <div className="p-4 text-center text-sm text-muted-foreground">No new notifications.</div>
                                    )}
                                </DropdownMenuContent>
                            </DropdownMenu>

                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="flex items-center gap-2 rounded-full p-1 h-auto">
                                <Avatar className="h-8 w-8">
                                    <AvatarImage src={userPhoto} alt={user?.displayName || "User"} />
                                    <AvatarFallback className="bg-black text-white">{user?.email?.[0]?.toUpperCase() || 'U'}</AvatarFallback>
                                </Avatar>
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-56">
                                <DropdownMenuLabel>{user?.email || 'My Account'}</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                 <DropdownMenuItem asChild>
                                    <Link href="/dashboard">
                                        <LayoutDashboard className="mr-2 h-4 w-4" />
                                        <span>Dashboard</span>
                                    </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                    <Link href="/dashboard/profile">
                                        <User className="mr-2 h-4 w-4" />
                                        <span>Profile</span>
                                    </Link>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={handleLogout}>
                                  <LogOut className="mr-2 h-4 w-4" />
                                  <span>Log out</span>
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                        </>
                    ) : (
                        <div className="flex items-center">
                            <div className="hidden sm:flex items-center gap-2">
                                <Button asChild variant="ghost">
                                    <Link href="/login">Login</Link>
                                </Button>
                                <Button asChild>
                                    <Link href="/signup">Sign Up</Link>
                                </Button>
                            </div>
                            <div className="sm:hidden">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon">
                                            <MoreVertical />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                         <DropdownMenuItem asChild>
                                            <Link href="/login">Login</Link>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem asChild>
                                            <Link href="/signup">Sign Up</Link>
                                        </DropdownMenuItem>
                                        {/* Download App removed per request */}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </div>
                    )}

                    {/* Download App button on top bar only */}
                    <div className="ml-2">
                        <Link href="/install-app">
                            <Button variant="ghost" size="icon" aria-label="Download App">
                                <ArrowDownCircle className="h-5 w-5 text-topbar-foreground" />
                            </Button>
                        </Link>
                    </div>

                    <div className="hidden sm:flex items-center ml-2">
                        <Button variant="ghost" size="icon" aria-label="More actions">
                            <ChevronDown className="h-4 w-4 text-topbar-foreground" />
                        </Button>
                    </div>
                </div>
            </div>
        </header>
    );
}
