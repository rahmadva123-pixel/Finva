
"use client";

import Link from 'next/link';
import type { ReactNode } from 'react';
import React, { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { normalizeBrandText } from '@/lib/branding';
import Image from 'next/image';

interface BackgroundSettings {
    imageUrl: string;
    overlayColor: string;
}

export function AuthLayout({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  const [logoUrl, setLogoUrl] = useState('');
  const [logoText, setLogoText] = useState('');
  const [showLogoTextWithImage, setShowLogoTextWithImage] = useState(true);
  const [logoWidth, setLogoWidth] = useState(32);
  const [logoHeight, setLogoHeight] = useState(32);
  const [templateLoading, setTemplateLoading] = useState(true);
  const [background, setBackground] = useState<BackgroundSettings | null>(null);
  
  useEffect(() => {
    const fetchContent = async () => {
        if (!db) {
            setTemplateLoading(false);
            return;
        }
        setTemplateLoading(true);
        try {
            const docRef = doc(db, 'template', 'landingPage');
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                setLogoUrl(data.logoUrl || '');
                setLogoText(normalizeBrandText(data.headerLogoText));
                setShowLogoTextWithImage(data.showLogoTextWithImage ?? true);
                setLogoWidth(data.logoWidth || 32);
                setLogoHeight(data.logoHeight || 32);
                if (data.backgrounds?.authLayout) {
                    setBackground(data.backgrounds.authLayout);
                }
            } else {
              setLogoText('Finva');
            }
        } catch(e) {
            console.error("Error fetching template settings for layout", e)
        } finally {
            setTemplateLoading(false);
        }
    };
    fetchContent();
  }, []);

  const backgroundStyle: React.CSSProperties = background?.imageUrl ? {
      backgroundImage: `url(${background.imageUrl})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
  } : {};

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-x-hidden bg-slate-950 px-3 py-6 text-slate-100 sm:p-6" style={backgroundStyle}>
       <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.22),transparent_38%),radial-gradient(circle_at_bottom_left,rgba(56,189,248,0.10),transparent_34%)]"></div>
       {background?.imageUrl && (
           <div className="absolute inset-0 z-0" style={{ backgroundColor: background.overlayColor }}></div>
       )}
       <div className="absolute left-4 top-4 z-10 sm:left-8 sm:top-8">
        <div className="flex items-center gap-2 text-white">
          {templateLoading ? (
             <div className="h-8 w-32 rounded-md bg-white/10 animate-pulse"></div>
          ) : (
            <>
                {logoUrl && logoUrl.trim() !== '' ? (
                    <Image src={logoUrl} alt={logoText} width={logoWidth} height={logoHeight} />
                ) : null}
                {(!logoUrl || showLogoTextWithImage) && (
                    <span className="text-xl font-bold tracking-tight font-headline">{logoText}</span>
                )}
            </>
          )}
        </div>
      </div>
      <div className={`z-10 w-full ${wide ? 'max-w-6xl' : 'max-w-md sm:max-w-lg'}`}>
        <div className={wide ? 'w-full' : 'rounded-[28px] border border-white/10 bg-slate-900/90 p-1 shadow-2xl shadow-blue-950/40 backdrop-blur-xl'}>
          {children}
        </div>
      </div>
    </div>
  );
}
