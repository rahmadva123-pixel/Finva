
"use client";

import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useEffect, ReactNode } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading, verificationStatus } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && user && verificationStatus === 'unverified' ) {
        router.push('/verification');
    }
    if (!loading && user && verificationStatus === 'pending' ) {
        router.push('/verification/pending');
    }
  }, [user, loading, verificationStatus, router]);

  if (loading) {
    return (
        <div className="flex flex-col space-y-3 p-8">
          <Skeleton className="h-[125px] w-full rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>
      );
  }

  if (!user || (verificationStatus && verificationStatus !== 'verified')) {
    return null; // or a redirect component
  }

  return <>{children}</>;
}
