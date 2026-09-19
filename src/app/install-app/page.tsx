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
      <Card className="w-full max-w-4xl overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-2">
          <div className="flex items-center justify-center bg-gradient-to-b from-primary/5 to-transparent p-8">
            <div className="relative flex h-[420px] w-[240px] items-center justify-center rounded-3xl bg-gradient-to-b from-white to-muted/30 shadow-md dark:from-muted/10 dark:to-muted/20">
              <div className="absolute inset-4 flex flex-col items-center justify-center gap-4 rounded-2xl bg-background p-4">
                <div className="h-12 w-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <Smartphone className="h-6 w-6" />
                </div>
                <div className="h-64 w-full rounded-md border border-dashed border-muted/30 bg-gradient-to-b from-transparent to-muted/5 flex items-center justify-center text-sm text-muted-foreground">
                  App preview
                </div>
                <div className="flex w-full items-center justify-between text-xs text-muted-foreground">
                  <span>Finva • 1.0.0</span>
                  <span>Lightweight • Fast</span>
                </div>
              </div>
            </div>
          </div>

          <div className="p-8">
            <CardHeader className="p-0">
              <CardTitle className="text-3xl font-extrabold">Get Finva</CardTitle>
              <CardDescription className="mt-2 text-base">
                Install Finva for quick trades, secure sync across devices, and a native-like experience.
              </CardDescription>
            </CardHeader>

            <CardContent className="mt-6 space-y-6 p-0">
              {isStandalone ? (
                <div className="rounded-md bg-green-500/10 p-4 text-sm text-green-700 dark:text-green-300">
                  The app is already installed on this device.
                </div>
              ) : (
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button onClick={handleInstall} size="lg" className="flex-1">
                    <Download className="mr-2 h-5 w-5" />
                    {canInstall ? "Get Finva" : "Get Finva"}
                  </Button>
                  <Button variant="outline" onClick={() => {
                    toast({
                      title: 'How to install',
                      description: 'Follow the steps below to add Finva to your device.',
                    });
                  }} className="hidden sm:inline-flex">
                    How to Get Finva
                  </Button>
                </div>
              )}

              <div className="grid gap-3 md:grid-cols-2">
                <div className="flex items-start gap-3">
                  <div className="mt-1 flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    ✓
                  </div>
                  <div>
                    <div className="font-medium">Fast & Lightweight</div>
                    <div className="text-sm text-muted-foreground">Quick load times and optimized for trading flows.</div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="mt-1 flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    ✓
                  </div>
                  <div>
                    <div className="font-medium">Secure Sync</div>
                    <div className="text-sm text-muted-foreground">Your settings and auth stay safe with Firebase.</div>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border bg-muted/40 p-4 text-left text-sm text-muted-foreground">
                <p className="font-medium text-foreground mb-2">If the install popup does not show</p>
                <ul className="list-disc pl-5">
                  <li>On Android Chrome: open the browser menu and tap Add to Home Screen.</li>
                  <li>On iPhone Safari: tap Share and then Add to Home Screen.</li>
                </ul>
              </div>
            </CardContent>
          </div>
        </div>
      </Card>
    </main>
  );
}
