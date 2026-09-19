
"use client";

import type {Metadata} from 'next';
import { Toaster } from "@/components/ui/toaster"
import './globals.css';
import { AuthProvider } from '@/hooks/use-auth';
import { LiveChat } from '@/components/ui/live-chat';
import { Favicon } from '@/components/ui/favicon';
import { SiteTitleUpdater } from '@/components/ui/site-title-updater';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { Footer } from '@/components/layout/footer';
import { PreloaderProvider } from '@/components/providers/preloader-provider';
import { PwaInstaller } from '@/components/pwa/pwa-installer';
import React from 'react';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;700&display=swap" rel="stylesheet" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0f172a" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="apple-touch-icon" href="/icon.jpeg?v=2" />
      </head>
      <body className="font-body antialiased" suppressHydrationWarning>
        <ThemeProvider>
          <AuthProvider>
            <PreloaderProvider>
                <PwaInstaller />
                <Favicon />
                <SiteTitleUpdater />
                <main className="flex-grow">{children}</main>
                <Footer />
                <LiveChat />
                <Toaster />
            </PreloaderProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
