
"use client";

import React, { useEffect, useState, createContext, useContext } from 'react';
import { db } from '@/lib/firebase';
import { getCachedDoc } from '@/lib/clientCache';
import { doc, getDoc } from 'firebase/firestore';
import { Preloader } from '../ui/preloader';

interface PreloaderSettings {
    preloaderEnabled?: boolean;
    preloaderBackgroundUrl?: string;
    preloaderOverlayColor?: string;
}

const defaultPreloaderEnabled = process.env.NODE_ENV === 'production';

const PreloaderContext = createContext<{ appLoading: boolean }>({ appLoading: defaultPreloaderEnabled });

export const usePreloader = () => useContext(PreloaderContext);

export const PreloaderProvider = ({ children }: { children: React.ReactNode }) => {
  const [settings, setSettings] = useState<PreloaderSettings>({ preloaderEnabled: defaultPreloaderEnabled });
  const [appLoading, setAppLoading] = useState(defaultPreloaderEnabled);

  useEffect(() => {
    let isMounted = true;
    const emergencyHideTimer = window.setTimeout(() => {
      if (isMounted) {
        setAppLoading(false);
      }
    }, 1500);

    const fetchAndShowPreloader = async () => {
      let currentSettings: PreloaderSettings = { preloaderEnabled: defaultPreloaderEnabled };
      if (db) {
        try {
          const data = await getCachedDoc('settings', 'general');
          if (data) {
            currentSettings = {
              preloaderEnabled: data.preloaderEnabled ?? defaultPreloaderEnabled,
              preloaderBackgroundUrl: data.preloaderBackgroundUrl || '',
              preloaderOverlayColor: data.preloaderOverlayColor || 'rgba(0,0,0,0.5)',
            };
          }
        } catch (e) {
          console.error("Could not fetch preloader settings", e);
        }
      }

      if (!isMounted) return;

      setSettings(currentSettings);

      if (!currentSettings.preloaderEnabled) {
        setAppLoading(false);
        return;
      }

      setAppLoading(true);
      window.setTimeout(() => {
        if (isMounted) {
          setAppLoading(false);
        }
      }, 900);
    };
    
    void fetchAndShowPreloader();

    return () => {
      isMounted = false;
      window.clearTimeout(emergencyHideTimer);
    };
  }, []);

  const preloaderStyle: React.CSSProperties = {
    backgroundImage: `url(${settings.preloaderBackgroundUrl || ''})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    position: 'fixed',
    inset: 0,
    zIndex: 9999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'opacity 0.5s ease-in-out',
    opacity: appLoading && settings.preloaderEnabled ? 1 : 0,
    pointerEvents: appLoading && settings.preloaderEnabled ? 'auto' : 'none',
  };

  const contentStyle: React.CSSProperties = {
    transition: 'opacity 0.5s ease-in-out',
    opacity: appLoading && settings.preloaderEnabled ? 0 : 1,
  };

  return (
    <PreloaderContext.Provider value={{ appLoading }}>
      {settings.preloaderEnabled && (
        <div id="preloader" style={preloaderStyle}>
          <div className="absolute inset-0 z-0" style={{backgroundColor: settings.preloaderOverlayColor || 'rgba(0,0,0,0.5)'}}></div>
          <div className="relative z-10 w-full h-full">
            <Preloader />
          </div>
        </div>
      )}
      <div style={contentStyle} className="flex flex-col min-h-screen">
        {children}
      </div>
    </PreloaderContext.Provider>
  );
};
