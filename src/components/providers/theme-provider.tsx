
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
    // Apply persisted theme preference (localStorage) or system preference
    const applyStoredTheme = () => {
      try {
        const stored = window.localStorage.getItem('theme');
        if (stored === 'dark') {
          document.documentElement.classList.add('dark');
        } else if (stored === 'light') {
          document.documentElement.classList.remove('dark');
        } else {
          // follow system preference
          const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
          if (prefersDark) document.documentElement.classList.add('dark');
          else document.documentElement.classList.remove('dark');
        }
      } catch (e) {
        // ignore
      }
    };

    applyStoredTheme();

    // Listen for remote theme changes from Firestore template and apply CSS variables
    let unsubscribe: (() => void) | undefined;
    try {
      if (db) {
        const docRef = doc(db, 'template', 'landingPage');
        unsubscribe = onSnapshot(docRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            const theme: ThemeColors = data.themeColors || null;
            if (theme) {
              if (theme.primary) document.documentElement.style.setProperty('--primary', theme.primary);
              if (theme.background) document.documentElement.style.setProperty('--background', theme.background);
              if (theme.accent) document.documentElement.style.setProperty('--accent', theme.accent);
            }
          }
        });
      }
    } catch (e) {
      // ignore Firestore errors during theme fetch
      console.warn('ThemeProvider: unable to subscribe to template theme', e);
    }

    const onSystemChange = (e: MediaQueryListEvent) => {
      try {
        const stored = window.localStorage.getItem('theme');
        if (!stored) {
          if (e.matches) document.documentElement.classList.add('dark');
          else document.documentElement.classList.remove('dark');
        }
      } catch (err) {
        // ignore
      }
    };

    const mq = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
    if (mq && mq.addEventListener) mq.addEventListener('change', onSystemChange);

    return () => {
      if (unsubscribe) unsubscribe();
      if (mq && mq.removeEventListener) mq.removeEventListener('change', onSystemChange as any);
    };
  }, []);

  return <>{children}</>;
}
