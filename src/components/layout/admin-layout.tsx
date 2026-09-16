
"use client";

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { AdminSidebarNav } from '@/components/layout/admin-sidebar-nav';
import { Header } from '@/components/layout/header';
import { ProtectedRoute } from './protected-route';
import { useAuth } from '@/hooks/use-auth';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';


export function AdminLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [checkingRole, setCheckingRole] = useState(true);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    if (loading) {
      return;
    }
    if (!user) {
      router.push('/admin/login');
      return;
    }

    const checkAdminRole = async () => {
      if (!db || !user) {
        setCheckingRole(false);
        return;
      }

      try {
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
          const userData = userDoc.data();

          const isAdminUser =
            userData?.role === 'admin' || userData?.role === 'sadmin';

          setIsAdmin(isAdminUser);
          setIsSuperAdmin(userData?.role === 'sadmin');

          if (!isAdminUser) {
            router.push('/dashboard');
          }
        } else {
          router.push('/dashboard');
        }
      } catch (error) {
        console.error('Error checking admin role:', error);
        router.push('/dashboard');
      } finally {
        setCheckingRole(false);
      }
    };

    checkAdminRole();
  }, [user, loading, router]);
  
  if(loading || checkingRole) {
      return (
        <div className="flex h-screen items-center justify-center">
            <Loader2 className="h-16 w-16 animate-spin" />
        </div>
      )
  }

  if(!isAdmin) {
      // This should ideally not be seen as the effect will redirect.
      // It's a fallback.
      return (
         <div className="flex h-screen items-center justify-center">
            <p>Redirecting...</p>
        </div>
      );
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen w-full flex flex-col">
        <Header onMobileNavToggle={() => setMobileNavOpen(true)} />
        <div className="flex flex-1">
          <AdminSidebarNav className="hidden sm:flex" isSuperAdmin={isSuperAdmin} />
          <main className="flex-grow p-4 md:p-8 lg:p-10 bg-background">
            {children}
          </main>
        </div>
      </div>
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
            <SheetContent side="left" className="p-0 w-64 bg-card">
                 <SheetHeader className="p-4">
                    <SheetTitle className="sr-only">Navigation</SheetTitle>
                 </SheetHeader>
                 <AdminSidebarNav isSuperAdmin={isSuperAdmin} />
            </SheetContent>
        </Sheet>
    </ProtectedRoute>
  );
}
