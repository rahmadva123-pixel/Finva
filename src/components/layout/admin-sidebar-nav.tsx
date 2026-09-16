
'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { LayoutDashboard, Users, CreditCard, Settings, FileText, TrendingUp, Palette, Share2, Gift, Star, Package, Bell, Languages, Loader2, Wallet, Repeat, Bot, ShieldCheck, BookOpen, CircleDollarSign, Mail, Zap, Settings2, HandCoins, Banknote, ArrowDown, ArrowUp } from 'lucide-react';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { db, auth } from '@/lib/firebase';
import { doc, getDoc, collection, query, onSnapshot, getDocs, where } from 'firebase/firestore';
import { useAuth } from '@/hooks/use-auth';

const allNavItemsConfig = [
  { key: 'dashboard', href: '/admin', label: 'Dashboard', icon: LayoutDashboard, dropdown: false },
  { key: 'users', href: '/admin/users', label: 'Users', icon: Users, dropdown: false },
  { key: 'referralDetails', href: '/admin/referral-details', label: 'Referral Details', icon: Share2, dropdown: false },
  { key: 'verification', label: 'ID Verification', icon: ShieldCheck, dropdown: true,
    subItems: [
        { href: '/admin/verification/setup', label: 'Verification Setup'},
        { href: '/admin/verification/submissions', label: 'Submissions'},
        { href: '/admin/verification/history', label: 'History'},
    ]
  },
    { key: 'swap', href: '/admin/swap-settings', label: 'Swap Settings', icon: Repeat, dropdown: false },
  { key: 'payments', label: 'Payments', icon: CreditCard, dropdown: true,
    subItems: [
        { href: '/admin/wallet-settings', label: 'Wallet Settings'},
        { href: '/admin/wallet-settings/p2p-settings', label: 'P2P Settings'},
        { href: '/admin/wallet-settings/digital-currencies', label: 'Digital Currencies'},
        { href: '/admin/wallet-settings/deposit-methods', label: 'Deposit Methods'},
        { href: '/admin/wallet-settings/withdraw-methods', label: 'Withdrawal Methods'},
        { href: '/admin/pending-deposits', label: 'Pending Deposits'},
        { href: '/admin/pending-withdraws', label: 'Pending Withdraws'},
        { href: '/admin/deposit-history', label: 'Deposit History'},
        { href: '/admin/withdraw-history', 'label': 'Withdraw History'},
    ]
  },
  { key: 'earningRules', href: '/admin/earning-rules', label: 'Earning Rules', icon: Zap, dropdown: false },
  { key: 'shareAndEarn', label: 'Share & Earn', icon: Share2, dropdown: true,
    subItems: [
        { href: '/admin/share-earn', label: 'Manage Posts'},
        { href: '/admin/share-earn/submissions', label: 'Submissions'},
    ]
  },
  { key: 'bonus', href: '/admin/bonus', label: 'Bonus Settings', icon: Gift, dropdown: false },
  { key: 'refreshmentBonuses', href: '/admin/refreshment-bonuses', label: 'Refreshment Bonuses', icon: HandCoins, dropdown: false },
  { key: 'pages', href: '/admin/pages', label: 'Content Pages', icon: BookOpen, dropdown: false },
  { key: 'supportPages', href: '/admin/pages', label: 'Support Settings', icon: Mail, dropdown: false },
  { key: 'template', label: 'Templates', icon: Palette, dropdown: true,
    subItems: [
        { href: '/admin/template', label: 'Templates Overview'},
        { href: '/admin/template/theme', label: 'Theme Settings'},
        { href: '/admin/template/footer', label: 'Footer Settings'},
    ]
  },
  { key: 'dashboardSettings', href: '/admin/dashboard-settings', label: 'Dashboard Settings', icon: Settings2, dropdown: false },
  { key: 'mailTemplates', href: '/admin/mail-templates', label: 'Mail Templates', icon: Mail, dropdown: false },
  { key: 'notificationSettings', href: '/admin/notification-settings', label: 'Notification Settings', icon: Bell, dropdown: false },
  { key: 'push-notifications', href: '/admin/push-notification-settings', label: 'Push Notifications', icon: Bell, dropdown: false },
  { key: 'generalSettings', href: '/admin/general-settings', label: 'General Settings', icon: Settings, dropdown: false },
  { key: 'languageSettings', href: '/admin/language-settings', label: 'Language Settings', icon: Languages, dropdown: false },
];

export interface AdminNavItem {
  key: string;
  enabled: boolean;
  label: string;
}

interface AdminSidebarNavProps {
    className?: string;
    isSuperAdmin?: boolean;
}

export function AdminSidebarNav({ className, isSuperAdmin }: AdminSidebarNavProps) {
  const pathname = usePathname();
  const { user } = useAuth();
  const [navSettings, setNavSettings] = useState<AdminNavItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [totalBalance, setTotalBalance] = useState(0);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [currencySymbol, setCurrencySymbol] = useState('$');

  useEffect(() => {
    const fetchNavSettings = async () => {
      if (!db) {
        setLoading(false);
        return;
      }
      try {
        const docRef = doc(db, 'settings', 'adminNavigation');
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists() && docSnap.data().items) {
          setNavSettings(docSnap.data().items);
        } else {
          const defaultSettings = allNavItemsConfig.map(item => ({
            key: item.key,
            enabled: true,
            label: item.label
          }));
          setNavSettings(defaultSettings);
        }
      } catch (error) {
        console.error("Could not fetch admin nav settings:", error);
        const defaultSettings = allNavItemsConfig.map(item => ({
          key: item.key,
          enabled: true,
          label: item.label
        }));
        setNavSettings(defaultSettings);
      } finally {
        setLoading(false);
      }
    };
    
    const fetchGlobalStats = async () => {
        if (!db) return;

        try {
            const currencyDoc = await getDoc(doc(db, 'settings', 'currency'));
            if(currencyDoc.exists()) setCurrencySymbol(currencyDoc.data().symbol || '$');
            
            const usersSnapshot = await getDocs(collection(db, 'users'));
            const total = usersSnapshot.docs.reduce((sum, doc) => sum + (doc.data().balance || 0), 0);
            setTotalBalance(total);

            // This is a simplified earnings calculation. For a full calculation, you'd sum up
            // all profit-generating transactions (investment returns, bonuses, commissions, etc.)
            const investmentReturnsSnapshot = await getDocs(query(collection(db, 'investmentTransactions'), where("type", "in", ["Profit Return (Auto)", "Profit Return (Manual)"])));
            const stakingReturnsSnapshot = await getDocs(query(collection(db, 'userStakes'), where("status", "==", "completed")));
            const poolReturnsSnapshot = await getDocs(query(collection(db, 'userPoolInvestments'), where("status", "==", "completed")));
            const bonusSnapshot = await getDocs(collection(db, 'bonusTransactions'));
            const commissionSnapshot = await getDocs(collection(db, 'referralCommissions'));
            
            let earnings = 0;
            investmentReturnsSnapshot.forEach(doc => earnings += doc.data().amount);
            stakingReturnsSnapshot.forEach(doc => earnings += doc.data().amount * doc.data().returnPercentage / 100);
            poolReturnsSnapshot.forEach(doc => earnings += doc.data().returnAmount || 0);
            bonusSnapshot.forEach(doc => earnings += doc.data().amount);
            commissionSnapshot.forEach(doc => earnings += doc.data().amount);
            
            setTotalEarnings(earnings);

        } catch (e) {
            console.error("Failed to fetch global stats: ", e);
        }
    }
    
    fetchNavSettings();
    fetchGlobalStats();
  }, [user]);

  const visibleNavItems = useMemo(() => {
    if (!navSettings) return [];
    
    if (isSuperAdmin) {
        return allNavItemsConfig;
    }

    const settingsMap = new Map(navSettings.map(item => [item.key, item.enabled]));

    return allNavItemsConfig.filter(item => settingsMap.get(item.key) !== false);
  }, [navSettings, isSuperAdmin]);
  
  if (loading) {
    return (
      <aside className={cn("w-full sm:w-64 flex-col border-r bg-card flex p-4", className)}>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </aside>
    );
  }

  return (
    <aside className={cn("w-full sm:w-64 flex-col border-r bg-card flex", className)}>
        <div className="p-4 border-b">
            <h2 className="text-xl font-bold font-headline tracking-tight">Admin Panel</h2>
             <div className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between items-center">
                    <span className="text-muted-foreground flex items-center gap-2"><Wallet className="h-4 w-4" /> Total Balance</span>
                    <span className="font-bold">{currencySymbol}{totalBalance.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-muted-foreground flex items-center gap-2"><CircleDollarSign className="h-4 w-4" /> Total Earnings</span>
                    <span className="font-bold">{currencySymbol}{totalEarnings.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                </div>
            </div>
        </div>
      <nav className="flex flex-col gap-1 p-4 flex-grow overflow-y-auto">
          {visibleNavItems.filter(item => !item.dropdown).map((item) => (
             <Link
              href={item.href!}
              key={item.key}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary',
                pathname === item.href && 'bg-accent text-accent-foreground hover:text-accent-foreground'
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
          <Accordion type="multiple" className="w-full">
            {visibleNavItems.filter(item => item.dropdown).map(item => (
                 <AccordionItem value={item.label} key={item.key} className="border-none">
                    <AccordionTrigger className={cn("hover:no-underline text-muted-foreground hover:text-primary rounded-lg px-3 py-2",
                      item.subItems?.some(sub => pathname.startsWith(sub.href)) && "bg-accent text-accent-foreground hover:text-accent-foreground"
                    )}>
                        <div className="flex items-center gap-3">
                            <item.icon className="h-4 w-4" />
                            <span>{item.label}</span>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="pl-8 pt-2 space-y-1">
                        {item.subItems?.map(subItem => (
                             <Link
                                href={subItem.href}
                                key={subItem.href}
                                className={cn(
                                    'block rounded-lg py-2 px-3 text-muted-foreground hover:text-primary',
                                    pathname === subItem.href && 'bg-primary/10 text-primary'
                                )}
                                >
                                {subItem.label}
                            </Link>
                        ))}
                    </AccordionContent>
                </AccordionItem>
            ))}
          </Accordion>
          {isSuperAdmin && (
              <div className="pt-4 mt-4 border-t">
                  <h3 className="px-3 text-xs font-semibold text-muted-foreground uppercase">Super Admin</h3>
                  <div className="mt-2 space-y-1">
                      <Link href="/admin/super-admin/admin-menu-settings" className={cn('flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary', pathname === '/admin/super-admin/admin-menu-settings' && 'bg-accent text-accent-foreground hover:text-accent-foreground')}>
                          <Settings2 className="h-4 w-4" /> Admin Menu
                      </Link>
                       <Link href="/admin/super-admin/special-deposits" className={cn('flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary', pathname === '/admin/super-admin/special-deposits' && 'bg-accent text-accent-foreground hover:text-accent-foreground')}>
                          <Star className="h-4 w-4" /> Special Deposits
                      </Link>
                  </div>
              </div>
          )}
      </nav>
    </aside>
  );
}
