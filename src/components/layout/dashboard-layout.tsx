"use client";
import type { ReactNode } from 'react';
import { SidebarNav } from '@/components/layout/sidebar-nav';
import { Header } from '@/components/layout/header';
import { ProtectedRoute } from './protected-route';
import React, { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '../ui/sheet';
import { Button } from '../ui/button';
import { Menu } from 'lucide-react';
import { MobileFooterNav } from './mobile-footer-nav';
import { useIsMobile } from '@/hooks/use-mobile';

interface DashboardSettings {
    dashboardBackgroundUrl?: string;
    dashboardOverlayColor?: string;
}

export function DashboardLayout({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<DashboardSettings | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    const fetchContent = async () => {
        if (!db) return;
        try {
            const docRef = doc(db, 'settings', 'dashboard');
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                setSettings(docSnap.data() as DashboardSettings);
            }
        } catch(e) {
            console.error("Error fetching dashboard settings for layout", e)
        }
    };
    fetchContent();
  }, []);

  const backgroundStyle: React.CSSProperties = settings?.dashboardBackgroundUrl ? {
      backgroundImage: `url(${settings.dashboardBackgroundUrl})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundAttachment: isMobile ? 'scroll' : 'fixed',
  } : {};

  return (
    <ProtectedRoute>
      <div className="relative min-h-screen w-full flex flex-col bg-background text-foreground" style={backgroundStyle}>
        {settings?.dashboardBackgroundUrl && (
           <div className="absolute inset-0 z-0" style={{ backgroundColor: settings.dashboardOverlayColor || 'transparent' }}></div>
        )}
        <div className="relative z-10 flex-1 flex flex-col min-h-0 pt-16">
            <Header onMobileNavToggle={() => setMobileNavOpen(true)} />
            <div className="flex flex-1 overflow-hidden">
                {!isMobile && (
                  <div className="hidden sm:block">
                      <SidebarNav />
                  </div>
                )}
                <main className="flex-1 overflow-y-auto bg-background/80 pb-28 backdrop-blur-sm sm:pb-0">
                  <div className="mx-auto w-full max-w-full sm:max-w-6xl p-3 sm:p-4 md:p-6 lg:p-8">
                      {children}
                  </div>
                </main>
            </div>
            {isMobile && <MobileFooterNav />}
        </div>

        <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
            <SheetContent side="left" className="p-0 w-64 border-r-0">
                 <SheetHeader>
                    <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
                 </SheetHeader>
                 {mobileNavOpen ? <SidebarNav /> : null}
            </SheetContent>
        </Sheet>

      </div>
    </ProtectedRoute>
  );
}
