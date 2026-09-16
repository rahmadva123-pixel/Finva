
"use client";

import React from 'react';
import { db } from '@/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

interface ThemeColors {
  primary: string;
  background: string;
  accent: string;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  React.useEffect(() => {
    const fetchAndApplyTheme = () => {
      if (!db) return;
      
      const docRef = doc(db, 'template', 'landingPage');
      const unsubscribe = onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          const theme: ThemeColors = data.themeColors || {
            primary: '142 76% 56%',
            background: '222 47% 11%',
            accent: '142 76% 56%',
          };
          
          document.documentElement.style.setProperty('--primary', theme.primary);
          document.documentElement.style.setProperty('--background', theme.background);
          document.documentElement.style.setProperty('--accent', theme.accent);
        }
      });

      return () => unsubscribe();
    };

    fetchAndApplyTheme();
  }, []);

  return <>{children}</>;
}
