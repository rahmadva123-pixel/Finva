
'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { 
    LayoutDashboard, 
    Landmark, 
    ShoppingCart, 
    Gift,
    Star, 
    PieChart, 
    Wallet,
    LogOut,
    ChevronRight,
    Repeat,
    TrendingUp,
    Share2,
    Loader2,
    Package,
    DollarSign,
    Bell,
    HelpCircle,
    Languages,
    Info,
    FileText,
    BookOpen,
    Award,
    ShieldCheck,
    Users
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Button } from '../ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../ui/accordion';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { db, auth } from '@/lib/firebase';
import { getCachedDoc } from '@/lib/clientCache';
import { doc, getDoc, collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import type { NavItem as AdminNavItemSetting } from '@/app/admin/general-settings/page';
import { LanguageSwitcher } from '../ui/language-switcher';

interface NavItemConfig {
  key: string;
  href: string;
  label: string;
  icon: React.ElementType;
  dropdown: boolean;
  subItems?: { href: string; label: string }[];
}

const allNavItemsConfig: Omit<NavItemConfig, 'label'>[] = [
  { key: 'markets', href: '/markets', icon: TrendingUp, dropdown: false },
  { key: 'trade', href: '/trade', icon: DollarSign, dropdown: false },
  { key: 'orders', href: '/dashboard/finance/history', icon: Repeat, dropdown: false },


  { key: 'about', href: '/about', icon: Info, dropdown: false },
];

interface CurrencySettings {
  symbol: string;
  position: 'left' | 'right';
}

interface UserProfile {
    firstName?: string;
    lastName?: string;
    photoURL?: string;
}

interface SidebarColors {
    sidebarColor1: string;
    sidebarColor2: string;
}

export function SidebarNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  const router = useRouter();
  const [navSettings, setNavSettings] = useState<AdminNavItemSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState(0);
  const [totalEarning, setTotalEarning] = useState(0);
  const [currency, setCurrency] = useState<CurrencySettings>({ symbol: '$', position: 'left' });
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [sidebarColors, setSidebarColors] = useState<SidebarColors>({
      sidebarColor1: 'rgba(25, 25, 41, 0.5)',
      sidebarColor2: 'rgba(42, 42, 66, 0.5)',
  });
  const [isDark, setIsDark] = useState(false);

  const calculateTotalEarning = useCallback(async () => {
    if (!user || !db) return;

    try {
        let earnings = 0;

        const investmentTxQuery = query(collection(db, "investmentTransactions"), where("userId", "==", user.uid), where("type", "in", ["Profit Return (Auto)", "Profit Return (Manual)"]));
        const investmentTxSnapshot = await getDocs(investmentTxQuery);
        investmentTxSnapshot.forEach(doc => earnings += doc.data().amount);
        
        const completedStakesQuery = query(collection(db, "userStakes"), where("userId", "==", user.uid), where("status", "==", "completed"));
        const completedStakesSnapshot = await getDocs(completedStakesQuery);
        completedStakesSnapshot.forEach(doc => earnings += (doc.data().amount * doc.data().returnPercentage / 100));

        const completedPoolsQuery = query(collection(db, "userPoolInvestments"), where("userId", "==", user.uid), where("status", "==", "completed"));
        const completedPoolsSnapshot = await getDocs(completedPoolsQuery);
        completedPoolsSnapshot.forEach(doc => {
            const data = doc.data();
            const profit = (data.returnAmount || 0) - (data.amount || 0);
            if (profit > 0) earnings += profit;
        });

        const bonusQuery = query(collection(db, "bonusTransactions"), where("userId", "==", user.uid));
        const bonusSnapshot = await getDocs(bonusQuery);
        bonusSnapshot.forEach(doc => earnings += doc.data().amount);

        const commissionsQuery = query(collection(db, "referralCommissions"), where("referrerId", "==", user.uid));
        const commissionsSnapshot = await getDocs(commissionsQuery);
        commissionsSnapshot.forEach(doc => earnings += doc.data().amount);
        
        setTotalEarning(earnings);
    } catch (error) {
        console.error("Failed to recalculate total earnings in sidebar:", error);
    }
  }, [user]);

  useEffect(() => {
    const fetchSettings = async () => {
      if (!db) {
        setLoading(false);
        return;
      }
      try {
        const navData = await getCachedDoc('settings', 'navigation');
        if (navData && navData.items) {
          setNavSettings(navData.items);
        } else {
          const defaultSettings = allNavItemsConfig.map(item => ({ key: item.key as AdminNavItemSetting['key'], enabled: true, label: item.key.charAt(0).toUpperCase() + item.key.slice(1) }));
          setNavSettings(defaultSettings);
        }

        const currencyData = await getCachedDoc('settings', 'currency');
        if (currencyData) setCurrency(currencyData as CurrencySettings);

        const generalData = await getCachedDoc('settings', 'general');
        if (generalData) {
            setSidebarColors({
                sidebarColor1: generalData.sidebarColor1 || 'rgba(25, 25, 41, 0.5)',
                sidebarColor2: generalData.sidebarColor2 || 'rgba(42, 42, 66, 0.5)',
            });
        }

      } catch (error) {
        console.error("Failed to fetch settings:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();

      if (user && db) {
        calculateTotalEarning();
        const userDocRef = doc(db, "users", user.uid);
        const unsubscribe = onSnapshot(userDocRef, (doc) => {
            if (doc.exists()) {
                const data = doc.data();
                setBalance(data.balance || 0);
                setUserProfile({
                    firstName: data.firstName,
                    lastName: data.lastName,
                    photoURL: data.photoURL,
                })
            }
        });
        
        return () => unsubscribe();
    }
  }, [user, calculateTotalEarning]);

  const handleLogout = async () => {
    try {
      if (auth) {
        await auth.signOut();
      }
      router.push('/');
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const formatCurrency = (amount: number) => {
    const value = amount.toFixed(2);
    return currency.position === 'left' ? `${'$'}${value}` : `${value}${'$'}`;
  }
  
  const visibleNavItems = useMemo(() => {
    const settingsMap = new Map(navSettings.map(item => [item.key, item]));
    
    return allNavItemsConfig
      .map(configItem => {
        const setting = settingsMap.get(configItem.key as AdminNavItemSetting['key']);
        if (setting?.enabled || !setting) {
          return {
            ...configItem,
            label:
              setting?.label ||
              configItem.key
                .replace(/([A-Z])/g, ' $1')
                .replace(/^./, (value) => value.toUpperCase()),
          } as NavItemConfig;
        }
        return null;
      })
      .filter((item): item is NavItemConfig => item !== null);
  }, [navSettings]);

  const sidebarStyle = React.useMemo(() => {
    if (isDark) {
      return {
        background: `linear-gradient(to bottom, ${sidebarColors.sidebarColor1}, ${sidebarColors.sidebarColor2})`,
      };
    }
    return { background: 'var(--sidebar-background)' };
  }, [sidebarColors, isDark]);

  useEffect(() => {
    // detect theme from html class and observe changes
    const check = () => setIsDark(document.documentElement.classList.contains('dark'));
    check();
    const mo = new MutationObserver(check);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => mo.disconnect();
  }, []);

    return (
    <aside className="w-full h-full flex flex-col bg-sidebar text-sidebar-foreground" style={sidebarStyle}>
      <div className="flex-grow flex flex-col p-4 space-y-4 pt-8 overflow-y-auto">
      <Link href="/dashboard/profile" className="p-3 bg-sidebar/10 rounded-lg block hover:bg-sidebar/20 transition-colors">
            <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                    <AvatarImage src={userProfile?.photoURL || "https://placehold.co/40x40"} alt={user?.displayName || "User"} />
                    <AvatarFallback>{user?.email?.[0]?.toUpperCase() || 'D'}</AvatarFallback>
                </Avatar>
                <div>
                    <p className="text-sm font-semibold">{userProfile?.firstName || user?.email?.split('@')[0] || 'User'}</p>
            <p className="text-xs text-sidebar-foreground opacity-70">Userid: {user?.uid.slice(0,8).toUpperCase() || 'VWLWUNIC'}</p>
                </div>
            </div>
            <div className="mt-4 p-4 rounded-lg bg-sidebar/30 border border-sidebar-border text-sidebar-foreground">
              <h4 className="text-sm font-semibold text-sidebar-foreground mb-2">Account Balance</h4>
                <div className="space-y-1 text-sm">
                    <div className="flex justify-between items-center gap-2">
                        <span>{formatCurrency(balance)}</span>
              <span className="text-sidebar-foreground opacity-60">Main Wallet</span>
                    </div>
                     <div className="flex justify-between items-center gap-2">
                        <span>{formatCurrency(totalEarning)}</span>
              <span className="text-sidebar-foreground opacity-60">Total Earning</span>
                    </div>
                </div>
            </div>
        </Link>

        <nav className="flex flex-col gap-1">
            <Link
              href={'/dashboard'}
              className={cn(
                'flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sidebar-foreground transition-all hover:text-sidebar-foreground hover:bg-sidebar/20',
                pathname === '/dashboard' && 'bg-primary text-primary-foreground hover:text-primary-foreground'
              )}
            >
              <div className="flex items-center gap-3">
                  <LayoutDashboard className="h-4 w-4" />
                  <span>Dashboard</span>
              </div>
          </Link>
          {loading ? (
             <div className="space-y-2 p-3">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
             </div>
          ) : (
          <Accordion type="multiple" className="w-full">
          {visibleNavItems.map((item) => (
            item.dropdown ? (
            <AccordionItem value={item.label} key={item.key} className="border-none">
            <AccordionTrigger className={cn('flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sidebar-foreground transition-all hover:text-sidebar-foreground hover:no-underline hover:bg-sidebar/20',
             pathname.startsWith(item.href) && 'bg-primary text-primary-foreground hover:text-primary-foreground'
            )}>
                     <div className="flex items-center gap-3">
                        <item.icon className="h-4 w-4" />
                        <span>{item.label}</span>
                    </div>
                </AccordionTrigger>
                <AccordionContent className="pl-8 pt-1 space-y-1">
                    {item.subItems?.map(subItem => (
                         <Link
                            href={subItem.href}
                            key={subItem.href}
                  className={cn(
                    'block rounded-lg py-2 px-3 text-sidebar-foreground opacity-70 hover:text-sidebar-foreground',
                    pathname === subItem.href && 'bg-primary text-primary-foreground font-medium shadow-sm'
                  )}
                            >
                            {subItem.label}
                        </Link>
                    ))}
                </AccordionContent>
            </AccordionItem>
             ) : (
                <Link
                  key={item.key}
                  href={item.href}
                  className={cn(
                    'flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sidebar-foreground transition-all hover:text-sidebar-foreground hover:bg-sidebar/20',
                    pathname.startsWith(item.href) && 'bg-primary text-primary-foreground hover:text-primary-foreground'
                  )}
                  >
                  <div className="flex items-center gap-3">
                    <item.icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </div>
                </Link>
             )
          ))}
          </Accordion>
          )}
          
            <Link
              href={'/dashboard/notifications'}
              className={cn(
                'flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sidebar-foreground transition-all hover:text-sidebar-foreground hover:bg-sidebar/20',
                pathname === '/dashboard/notifications' && 'bg-primary text-primary-foreground hover:text-primary-foreground'
              )}
            >
              <div className="flex items-center gap-3">
                <Bell className="h-4 w-4" />
                <span>Notifications</span>
              </div>
            </Link>
        </nav>
      </div>
      <div className="p-4 border-t border-sidebar-border space-y-1">
        <Button variant="ghost" className="w-full justify-start gap-3 px-3 text-sidebar-foreground hover:bg-sidebar/20 hover:text-sidebar-foreground" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
            <span>Sign out</span>
        </Button>
      </div>
    </aside>
  );
}
