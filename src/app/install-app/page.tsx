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
    <main className="container mx-auto flex min-h-[70vh] items-center justify-center px-6 py-20">
      <Card className="w-full max-w-4xl bg-background/60 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2">
          <div className="flex items-center justify-center p-10">
            <div className="h-[420px] w-[260px] rounded-2xl border border-muted/10 bg-gradient-to-b from-white to-muted/5 shadow-sm flex items-center justify-center">
              <div className="text-sm text-muted-foreground">Phone preview</div>
            </div>
          </div>

          <div className="p-10 flex flex-col justify-center gap-6">
            <CardHeader className="p-0">
              <CardTitle className="text-3xl font-semibold">Get Finva</CardTitle>
              <CardDescription className="mt-2 text-sm text-muted-foreground">
                A lightweight trading companion — fast access, secure sync, and a native-like experience.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-0 space-y-4">
              {isStandalone ? (
                <div className="rounded-md bg-green-500/10 p-3 text-sm text-green-700">App already installed on this device.</div>
              ) : (
                <div className="flex gap-3">
                  <Button onClick={handleInstall} size="lg" className="flex-1">
                    <Download className="mr-2 h-5 w-5" />
                    Get Finva
                  </Button>
                  <Button variant="outline" onClick={() => toast({ title: 'How to install', description: 'Open your browser menu and choose Add to Home Screen.' })} className="hidden sm:inline-flex">
                    How to
                  </Button>
                </div>
              )}

              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><strong>Fast load</strong> — optimized for quick trade flows.</li>
                <li><strong>Secure</strong> — Firebase-backed auth and sync.</li>
                <li><strong>Native feel</strong> — installs to full-screen.</li>
              </ul>

              <div className="text-xs text-muted-foreground">If the install prompt doesn't appear, open your browser menu and choose Add to Home Screen.</div>
            </CardContent>
          </div>
        </div>
      </Card>
    </main>
  );
}
