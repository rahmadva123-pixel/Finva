
"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db, isFirebaseConfigured } from '@/lib/firebase';
import { usePathname, useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  verificationStatus: 'unverified' | 'pending' | 'verified' | 'rejected' | null;
}

const AuthContext = React.createContext<AuthContextType>({
  user: null,
  loading: true,
  verificationStatus: null,
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = React.useState<User | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [verificationStatus, setVerificationStatus] = useState<AuthContextType['verificationStatus']>(null);
  const router = useRouter();
  const pathname = usePathname();

  React.useEffect(() => {
    if (typeof window === 'undefined') return;

    const firebaseConfigured = isFirebaseConfigured();
    
    if (!firebaseConfigured && pathname !== '/install') {
      router.push('/install');
      return;
    }
    
    if (firebaseConfigured && pathname === '/install') {
      router.push('/');
      return;
    }

    if (pathname === '/install') {
        setLoading(false);
        return;
    }

    const firebaseAuth = auth;
    const firestore = db;

    if (firebaseAuth && firestore) {
      const unsubscribe = onAuthStateChanged(firebaseAuth, async (currentUser) => {
        setUser(currentUser);

        try {
          if (currentUser) {
            const [userDoc, verificationSettingsDoc] = await Promise.all([
              getDoc(doc(firestore, 'users', currentUser.uid)),
              getDoc(doc(firestore, 'settings', 'verification')),
            ]);

            const userData = userDoc.exists() ? userDoc.data() : null;

            // Development-only test override for the currently signed-in account.
            if (process.env.NODE_ENV !== 'production' && userData?.devForceUnverified === true) {
              setVerificationStatus('unverified');
              if (!pathname.startsWith('/verification')) router.push('/verification');
              return;
            }

            // Admin and sadmin roles should always bypass verification
            if (userData && (userData.role === 'admin' || userData.role === 'sadmin')) {
              setVerificationStatus('verified');
              return;
            }

            const verificationRequired = verificationSettingsDoc.exists() && verificationSettingsDoc.data().requireVerification;

            if (!verificationRequired) {
              setVerificationStatus('verified');
              return;
            }

            if (userData) {
              const userStatus = userData.verificationStatus || 'unverified';
              setVerificationStatus(userStatus);

              if (userStatus === 'unverified' && !pathname.startsWith('/verification')) {
                router.push('/verification');
              } else if (userStatus === 'pending' && !pathname.startsWith('/verification/pending')) {
                router.push('/verification/pending');
              }
            } else {
              setVerificationStatus('unverified');
              router.push('/verification');
            }
          } else {
            setVerificationStatus(null);
          }
        } catch (error) {
          console.error('Error resolving auth state:', error);
          setVerificationStatus(currentUser ? 'verified' : null);
        } finally {
          setLoading(false);
        }
      });
      return () => unsubscribe();
    } else {
      setLoading(false);
    }

  }, [router, pathname]);

  return (
    <AuthContext.Provider value={{ user, loading, verificationStatus }}>
        {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => React.useContext(AuthContext);
