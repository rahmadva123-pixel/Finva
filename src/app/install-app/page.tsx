"use client";

import { useEffect, useState } from "react";
import { Download, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

declare global {
  interface Window {
    deferredPwaInstallPrompt?: BeforeInstallPromptEvent;
  }

  interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  }
}

export default function InstallAppPage() {
  const { toast } = useToast();
  const [canInstall, setCanInstall] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone === true;
    setIsStandalone(standalone);
    setCanInstall(Boolean(window.deferredPwaInstallPrompt));

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      window.deferredPwaInstallPrompt = event as BeforeInstallPromptEvent;
      setCanInstall(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    const promptEvent = window.deferredPwaInstallPrompt;

    if (!promptEvent) {
      toast({
        title: "Install from your browser",
        description: "Open your browser menu and choose Add to Home Screen or Install App.",
      });
      return;
    }

    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    window.deferredPwaInstallPrompt = undefined;
    setCanInstall(false);

    toast({
      title: choice.outcome === "accepted" ? "App install started" : "Install cancelled",
      description: choice.outcome === "accepted" ? "The app is being added to your device." : "You can install it later from this page.",
    });
  };

  return (
    <main className="container mx-auto flex min-h-[70vh] items-center justify-center px-4 py-16">
      <div className="w-full max-w-[640px] px-4">
        <div className="rounded-2xl bg-gradient-to-b from-[#060712] to-[#071026] p-6 shadow-lg">
          <div className="flex flex-col items-start gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
                <Smartphone className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Get Finva</h1>
                <p className="text-sm text-muted-foreground">Fast trades. Pro charts. Native-like experience.</p>
              </div>
            </div>

            <div className="w-full overflow-hidden rounded-md bg-[#071430] p-3">
              <svg viewBox="0 0 300 120" className="w-full h-36" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="g1" x1="0" x2="1">
                    <stop offset="0%" stopColor="#0ea5a4" stopOpacity="0.9" />
                    <stop offset="100%" stopColor="#2563EB" stopOpacity="0.9" />
                  </linearGradient>
                </defs>
                <rect width="300" height="120" fill="#061222" />
                <path d="M0 80 C40 60, 80 40, 120 50 C160 60, 200 30, 240 45 C280 60, 300 40, 300 40" fill="none" stroke="url(#g1)" strokeWidth="3" strokeLinecap="round" />
                <circle cx="120" cy="50" r="3" fill="#fff" />
              </svg>
              <div className="mt-2 flex items-center justify-between">
                <div className="text-xs text-muted-foreground">Live preview • Simulated</div>
                <div className="text-xs text-muted-foreground">v1.0</div>
              </div>
            </div>

            <div className="w-full">
              {isStandalone ? (
                <div className="rounded-md bg-green-500/10 p-3 text-sm text-green-300">App installed on this device.</div>
              ) : (
                <div className="flex w-full flex-col gap-3">
                  <Button onClick={handleInstall} size="lg" className="w-full bg-primary text-primary-foreground">
                    <Download className="mr-2 h-5 w-5" />
                    Get Finva
                  </Button>
                  <Button variant="ghost" onClick={() => toast({ title: 'How to install', description: 'Open your browser menu and choose Add to Home Screen.' })} className="w-full text-sm text-muted-foreground">
                    How to install
                  </Button>
                </div>
              )}
            </div>

            <div className="flex w-full flex-col gap-2 pt-2">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-white/6 flex items-center justify-center text-xs">✓</div>
                <div className="text-sm text-white">Pro-style charts optimized for quick decisions</div>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-white/6 flex items-center justify-center text-xs">🔒</div>
                <div className="text-sm text-white">Secure sync with Firebase</div>
              </div>
            </div>

            <div className="text-xs text-muted-foreground pt-3">If the prompt doesn't appear, open your browser menu and choose Add to Home Screen.</div>
          </div>
        </div>
      </div>
    </main>
  );
}
