
"use client";

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Progress } from './progress';

interface PreloaderSettings {
    preloaderLogoUrl?: string;
    preloaderPoweredByText?: string;
    preloaderPoweredByLogo?: string;
    preloaderPoweredByLogoWidth?: number;
    preloaderPoweredByLogoHeight?: number;
}

export const Preloader = () => {
  const [settings, setSettings] = useState<PreloaderSettings>({});
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const fetchLogo = async () => {
      if (!db) {
        setLoading(false);
        return;
      }
      try {
        const docRef = doc(db, 'settings', 'general');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setSettings(docSnap.data() as PreloaderSettings);
        }
      } catch (error) {
        console.error("Could not fetch logo for preloader:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchLogo();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 1;
      });
    }, 25); 

    return () => clearInterval(interval);
  }, []);
  
  return (
    <div className="flex flex-col items-center justify-center h-full py-12 px-4 relative w-full">
        
        {/* Main centered content */}
        <div className="flex flex-col items-center justify-center gap-4">
            <div className="relative h-20 w-20 animate-splash-logo">
              <Image
                src="/icon.jpeg"
                alt="Finva"
                layout="fill"
                objectFit="contain"
                priority
              />
            </div>

            {(settings.preloaderPoweredByText || settings.preloaderPoweredByLogo) && (
                <div className="flex items-center gap-2 text-sm text-white/70">
                    {settings.preloaderPoweredByText && <span>{settings.preloaderPoweredByText}</span>}
                    {settings.preloaderPoweredByLogo && settings.preloaderPoweredByLogo.trim() !== '' && (
                        <div className="relative" style={{ width: `${settings.preloaderPoweredByLogoWidth || 80}px`, height: `${settings.preloaderPoweredByLogoHeight || 20}px` }}>
                            <Image src={settings.preloaderPoweredByLogo} alt="Powered by logo" layout="fill" objectFit="contain" />
                        </div>
                    )}
                </div>
            )}
            
            <div className="w-full max-w-xs flex flex-col items-center gap-2">
                <Progress value={progress} className="h-1.5" />
                <p className="text-center text-lg font-semibold text-primary">{progress}%</p>
            </div>
        </div>
    </div>
  );
};
