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
      <Card className="w-full max-w-xl text-center">
        <CardHeader>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Smartphone className="h-8 w-8" />
          </div>
          <CardTitle className="text-3xl font-bold">Download Our App</CardTitle>
          <CardDescription>
            Install the web app on your phone or desktop for quick access and a full-screen app experience.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isStandalone ? (
            <p className="rounded-lg bg-green-500/10 p-4 text-sm text-green-700 dark:text-green-300">
              The app is already installed on this device.
            </p>
          ) : (
            <Button onClick={handleInstall} size="lg" className="w-full sm:w-auto">
              <Download className="mr-2 h-5 w-5" />
              {canInstall ? "Install App" : "How to Install App"}
            </Button>
          )}
          <div className="rounded-lg border bg-muted/40 p-4 text-left text-sm text-muted-foreground">
            <p className="font-medium text-foreground">If the install popup does not show:</p>
            <p>On Android Chrome, open the browser menu and tap Add to Home Screen or Install App.</p>
            <p>On iPhone Safari, tap Share and then Add to Home Screen.</p>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
