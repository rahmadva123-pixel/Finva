
"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from './dropdown-menu';
import { Button } from './button';
import { Languages, Check } from 'lucide-react';
import { allLanguages } from '@/lib/languages';
import { cn } from '@/lib/utils';
import i18n from '@/lib/i18n';

declare global {
  interface Window {
    google: any;
    googleTranslateElementInit: () => void;
  }
}

export function LanguageSwitcher({className}: {className?: string}) {
  const [settings, setSettings] = useState<{enabledLanguages: string[], translationEnabled: boolean} | null>(null);

  useEffect(() => {
    const fetchLanguageSettings = async () => {
        if(!db) return;
        try {
            const docRef = doc(db, 'settings', 'languages');
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                setSettings({
                    enabledLanguages: data.enabledLanguages || ['en'],
                    translationEnabled: data.translationEnabled ?? true
                });
            } else {
                 setSettings({ enabledLanguages: ['en'], translationEnabled: true });
            }
        } catch(e) {
            console.error("Could not fetch language settings", e);
        }
    };
    fetchLanguageSettings();
  }, []);

  const availableLanguages = useMemo(() => {
      if (!settings) return [];
      return allLanguages.filter(lang => settings.enabledLanguages.includes(lang.code));
  }, [settings]);
  
  const handleLanguageChange = (code: string) => {
    const select = document.querySelector('.goog-te-combo') as HTMLSelectElement | null;
    if (select) {
        select.value = code;
        select.dispatchEvent(new Event('change'));
    }
  }

  useEffect(() => {
    if (settings && !settings.translationEnabled) return;
    
    if (document.getElementById('google-translate-script')) return;

    const addScript = () => {
      const script = document.createElement('script');
      script.id = 'google-translate-script';
      script.src = `//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit`;
      script.async = true;
      document.body.appendChild(script);
    };

    window.googleTranslateElementInit = () => {
      new window.google.translate.TranslateElement({
        pageLanguage: 'en',
        includedLanguages: settings?.enabledLanguages.join(','),
        layout: window.google.translate.TranslateElement.InlineLayout.SIMPLE,
        autoDisplay: false
      }, 'google_translate_element');
    };

    addScript();

  }, [settings]);

  if (!settings || !settings.translationEnabled || availableLanguages.length <= 1) {
    return null;
  }

  return (
    <>
      <div id="google_translate_element" style={{ display: 'none' }}></div>
      <style>
          {`
            body > .skiptranslate {
                display: none !important;
                visibility: hidden;
            }
            .goog-te-gadget-simple { 
                background-color: transparent !important;
                border: none !important;
            }
            .goog-te-gadget-simple .goog-te-menu-value {
                color: hsl(var(--foreground)) !important;
                text-decoration: none !important;
            }
            .goog-te-gadget-icon {
                display: none !important;
            }
            iframe.goog-te-menu-frame {
                box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1) !important;
            }
          `}
      </style>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className={className}>
                <Languages className="h-[1.2rem] w-[1.2rem]" />
                <span className="sr-only">Change language</span>
            </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {availableLanguages.map(lang => (
            <DropdownMenuItem 
              key={lang.code} 
              onClick={() => handleLanguageChange(lang.code)}
            >
              {lang.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
