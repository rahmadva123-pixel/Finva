
"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import * as LucideIcons from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { getCachedDoc } from '@/lib/clientCache';
import { doc, getDoc } from "firebase/firestore";
import { useIsMobile } from "@/hooks/use-mobile";

interface MobileFooterMenuItem {
    label: string;
    icon: string;
    href: string;
}

const defaultNavItems: MobileFooterMenuItem[] = [
    { label: 'Home', icon: 'LayoutDashboard', href: '/dashboard' },
    { label: 'Deposit', icon: 'ArrowDownCircle', href: '/dashboard/finance/deposit' },
    { label: 'Markets', icon: 'TrendingUp', href: '/markets' },
    { label: 'Referral', icon: 'Users', href: '/dashboard/referral' },
];

export function MobileFooterNav() {
    const pathname = usePathname();
    const isMobile = useIsMobile();
    const [navConfig, setNavConfig] = useState<{ enabled: boolean; items: MobileFooterMenuItem[] } | null>(null);

    useEffect(() => {
        if (!isMobile) return;

        const fetchNavConfig = async () => {
            if (!db) return;
            try {
                const data = await getCachedDoc('settings', 'footer');
                if (data && data.mobileFooterNav) setNavConfig(data.mobileFooterNav);
            } catch (error) {
                console.error("Error fetching mobile nav config:", error);
            }
        };
        fetchNavConfig();
    }, [isMobile]);

    if (!isMobile) {
        return null;
    }

    if (navConfig?.enabled === false) {
        return null;
    }

    let navItems = navConfig?.items?.length ? navConfig.items.slice() : defaultNavItems.slice();

    // Use configured nav items or defaults (VIP removed for now).
    // No automatic normalization to VIP is applied.

    // Remove duplicate hrefs to avoid React key collisions
    const uniqueNavItems = navItems.filter((v, i, a) => a.findIndex(t => t.href === v.href) === i);
    const middleIndex = Math.floor(uniqueNavItems.length / 2);

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-40 flex h-[72px] items-center justify-around border-t border-border/50 bg-card/95 px-2 pb-2 pt-1 shadow-2xl backdrop-blur sm:hidden">
            {uniqueNavItems.map((item, index) => {
                const Icon = (LucideIcons as any)[item.icon] || LucideIcons.HelpCircle;
                const isActive = pathname === item.href;

                if (index === middleIndex) {
                    return (
                        <div key={item.href} className="-mt-8">
                            <Link href={item.href} className="relative flex h-16 w-16 flex-col items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30">
                                <Icon className="h-7 w-7" />
                                <span className="sr-only">{item.label}</span>
                            </Link>
                        </div>
                    );
                }

                return (
                    <Link href={item.href} key={item.href} className={cn(
                        "flex flex-col items-center text-muted-foreground flex-1 min-w-0 pt-1 pb-1 transition-colors",
                        isActive && "text-primary"
                    )}>
                        <Icon className="h-6 w-6" />
                        <span className="text-xs truncate block w-full">{item.label}</span>
                    </Link>
                );
            })}
        </nav>
    );
}
