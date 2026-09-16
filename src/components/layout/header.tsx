
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
import { Bell, User, LogOut, MoreVertical, Wallet, Landmark, Menu, CheckCircle, Clock, XCircle, Gift, TrendingUp, CircleDollarSign, Phone, MessageSquare, ArrowRight, LayoutDashboard } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import { db, auth } from '@/lib/firebase';
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
import { ensureDailyPromoCode } from '@/lib/promo';

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
  const [logoUrl, setLogoUrl] = useState('');
  const [logoText, setLogoText] = useState('');
  const [showLogoTextWithImage, setShowLogoTextWithImage] = useState(true);
  const [logoWidth, setLogoWidth] = useState(32);
  const [logoHeight, setLogoHeight] = useState(32);
  const [templateLoading, setTemplateLoading] = useState(true);
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
        } else {
            setLogoText('Finva');
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
        try {
            const LAST_PROMO_CHECK_KEY = 'lastPromoCheckMs';
            const THROTTLE_MS = 10 * 60 * 1000; // 10 minutes
            const last = Number(window.localStorage.getItem(LAST_PROMO_CHECK_KEY) || 0);
            const now = Date.now();
            if (isNaN(last) || now - last >= THROTTLE_MS) {
                void ensureDailyPromoCode(user.uid)
                  .then(() => window.localStorage.setItem(LAST_PROMO_CHECK_KEY, String(Date.now())))
                  .catch((error) => {
                    console.error("Failed to prepare promo code:", error);
                  });
            }
        } catch (e) {
            // localStorage may be unavailable in some environments — ignore and continue
        }
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

  const getNotificationIcon = (type: string) => {
    if (type.includes('approved') || type.includes('completed')) return <CheckCircle className="h-5 w-5 text-green-500" />;
    if (type.includes('rejected')) return <XCircle className="h-5 w-5 text-red-500" />;
    if (type.includes('pending')) return <Clock className="h-5 w-5 text-yellow-500" />;
    if (type.includes('bonus') || type.includes('promo')) return <Gift className="h-5 w-5 text-yellow-500" />;
    if (type.includes('invest')) return <TrendingUp className="h-5 w-5 text-blue-500" />;
    return <CircleDollarSign className="h-5 w-5 text-muted-foreground" />;
  }

  const handleLogout = async () => {
    try {
      if(auth) {
        await auth.signOut();
      }
      router.push('/');
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };
  
  const formatCurrency = (amount: number) => {
    const value = amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return currency.position === 'left' ? `${currency.symbol}${value}` : `${value}${currency.symbol}`;
  }

  if (appLoading) return null;


  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-2 border-b border-border/50 bg-card/50 px-2 sm:px-6 backdrop-blur-sm">
        <div className="flex items-center gap-2">
            { user && onMobileNavToggle ? (
                <Button variant="ghost" size="icon" className="sm:hidden" onClick={onMobileNavToggle}>
                    <Menu className="h-6 w-6" />
                    <span className="sr-only">Toggle Menu</span>
                </Button>
             ) : (
                <div className="sm:hidden w-8"></div> // Placeholder to align logo
             )}
            <div className="flex items-center gap-2 text-foreground">
                {templateLoading ? (
                    <div className="h-8 w-32 bg-muted/50 rounded-md animate-pulse"></div>
                ) : (
                    <>
                        {logoUrl && logoUrl.trim() !== '' ? (
                            <Image src={logoUrl} alt={logoText} width={logoWidth} height={logoHeight} />
                        ) : null}
                        {(!logoUrl || showLogoTextWithImage) && (
                            <span className="text-xl font-bold font-headline">{logoText}</span>
                        )}
                    </>
                )}
            </div>
        </div>

        <nav className="hidden md:flex items-center gap-1">
            {headerMenuItems.map(item => {
                const Icon = (LucideIcons as any)[item.icon || ''] || null;
                const hasSubItems = item.subItems && item.subItems.length > 0;

                if (hasSubItems) {
                    return (
                        <DropdownMenu key={item.id}>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary hover:bg-transparent">
                                    {Icon && <Icon className="h-4 w-4" />}
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
                    <Button key={item.id} variant="ghost" asChild className="text-sm font-medium text-muted-foreground">
                        <Link href={item.href} className="flex items-center gap-2">
                            {Icon && <Icon className="h-4 w-4" />}
                            {item.label}
                        </Link>
                    </Button>
                )
            })}
        </nav>

      <div className="flex items-center gap-1 sm:gap-2">
        <LanguageSwitcher className={cn(user && "hidden sm:inline-flex")} />
        
        { authLoading ? (
            <div className="h-8 w-20 bg-muted rounded-md animate-pulse"></div>
        ) : user ? (
          <>
             <Button variant="outline" className="items-center gap-2 px-2 sm:px-3" asChild>
                <Link href="/dashboard/finance/wallet">
                    <MainWalletIcon className="h-5 w-5 text-primary" />
                    <span className="font-semibold hidden sm:inline">
                       {formatCurrency(balance)}
                    </span>
                </Link>
            </Button>

             <DropdownMenu onOpenChange={(open) => open && handleMarkAsRead()}>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="rounded-full relative">
                        <Bell className="h-5 w-5" />
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
                    <AvatarFallback>{user?.email?.[0]?.toUpperCase() || 'U'}</AvatarFallback>
                  </Avatar>
                  <div className="hidden md:flex flex-col items-start">
                    <span className="text-sm font-medium">{user?.displayName || user?.email?.split('@')[0] || 'User'}</span>
                    <span className="text-xs text-muted-foreground">{user?.email}</span>
                  </div>
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
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
        )}
      </div>
    </header>
  );
}
