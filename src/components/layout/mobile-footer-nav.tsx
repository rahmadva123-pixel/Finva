
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
    { label: 'Home', icon: 'Home', href: '/dashboard' },
    { label: 'Markets', icon: 'TrendingUp', href: '/markets' },
    { label: 'Trade', icon: 'ArrowsUpDown', href: '/trade' },
    { label: 'Referrals', icon: 'Users', href: '/dashboard/referral' },
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

    // We force the five-button layout: Home, Markets, Trade (center), Referrals, Wallet
    const uniqueNavItems = defaultNavItems.slice(0,5);
    const middleIndex = 2; // Trade is center

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-40 border-t sm:hidden" style={{ background: 'var(--bottombar-background)', color: 'var(--bottombar-foreground)', borderColor: 'var(--topbar-border)' }}>
            <div className="mx-auto w-full max-w-full sm:max-w-6xl px-4 flex h-[64px] items-center justify-between">
            {uniqueNavItems.map((item) => {
                const Icon = (LucideIcons as any)[item.icon] || LucideIcons.HelpCircle;
                const isActive = pathname === item.href;
                return (
                    <Link href={item.href} key={item.href} className={cn(
                        "flex flex-col items-center justify-center gap-1 text-muted-foreground flex-1 min-w-0 py-2 transition-colors",
                        isActive && "text-primary"
                    )}>
                        <Icon className="h-6 w-6" />
                        <span className="text-xs truncate block w-full">{item.label}</span>
                    </Link>
                );
            })}
            </div>
        </nav>
    );
}
