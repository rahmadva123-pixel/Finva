"use client";

import { useEffect } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

export function Favicon() {
  useEffect(() => {
    const fetchAndSetFavicon = async () => {
      if (typeof window === 'undefined' || !db) return;

      try {
        const docRef = doc(db, 'settings', 'general');
        const docSnap = await getDoc(docRef);

        let faviconUrl = '/favicon.ico'; // Default fallback
        if (docSnap.exists() && docSnap.data().faviconUrl) {
          faviconUrl = docSnap.data().faviconUrl;
        }

        let link: HTMLLinkElement | null = document.querySelector("link[rel~='icon']");
        if (!link) {
          link = document.createElement('link');
          link.rel = 'icon';
          document.getElementsByTagName('head')[0].appendChild(link);
        }
        link.href = faviconUrl;
        
      } catch (error) {
        console.error("Error fetching favicon:", error);
      }
    };

    fetchAndSetFavicon();
  }, []);

  return null; // This component does not render anything
}
