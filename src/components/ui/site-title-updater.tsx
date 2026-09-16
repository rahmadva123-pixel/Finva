"use client";

import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { normalizeBrandText } from '@/lib/branding';

export function SiteTitleUpdater() {
  const [siteTitle, setSiteTitle] = useState('Loading...');

  useEffect(() => {
    if (typeof window === 'undefined' || !db) return;

    const docRef = doc(db, 'settings', 'general');

    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      let title = 'Finva'; // Default fallback
      if (docSnap.exists() && docSnap.data().siteTitle) {
        title = normalizeBrandText(docSnap.data().siteTitle);
      }
      setSiteTitle(title);
    }, (error) => {
      console.error("Error fetching site title:", error);
      setSiteTitle('Finva'); // Set fallback on error
    });

    return () => unsubscribe(); // Cleanup listener on component unmount
  }, []);
  
  useEffect(() => {
      document.title = siteTitle;
  }, [siteTitle])

  return null; // This component does not render anything
}
