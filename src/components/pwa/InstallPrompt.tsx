import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { X, Download, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { trackPWAUsage, shouldShowInstallPrompt, dismissInstallPrompt, getInstallPromptDelay } from '@/utils/pwaUtils';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

const InstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    console.log('InstallPrompt: Component mounted');
    
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      console.log('InstallPrompt: App is already installed');
      setIsInstalled(true);
      return;
    }

    // Check if iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    console.log('InstallPrompt: iOS detected:', iOS);
    setIsIOS(iOS);

    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      console.log('InstallPrompt: beforeinstallprompt event received');
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      
      // Show prompt after a delay to not be intrusive
      setTimeout(() => {
        if (shouldShowInstallPrompt()) {
          console.log('InstallPrompt: Showing install prompt');
          setShowPrompt(true);
        } else {
          console.log('InstallPrompt: Prompt dismissed recently, not showing');
        }
      }, getInstallPromptDelay());
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // For iOS, show prompt after delay since there's no beforeinstallprompt
    if (iOS && !(window.navigator as any).standalone) {
      console.log('InstallPrompt: Setting up iOS prompt delay');
      setTimeout(() => {
        if (shouldShowInstallPrompt()) {
          console.log('InstallPrompt: Showing iOS install prompt');
          setShowPrompt(true);
        }
      }, getInstallPromptDelay());
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      trackPWAUsage('install_prompt_clicked');
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        trackPWAUsage('pwa_installed', { method: 'prompt' });
        toast.success('App instalado com sucesso! 🎉');
        setDeferredPrompt(null);
        setShowPrompt(false);
      } else {
        trackPWAUsage('install_prompt_dismissed', { method: 'declined' });
      }
    }
  };

  const handleDismiss = () => {
    trackPWAUsage('install_prompt_dismissed', { method: 'manual' });
    dismissInstallPrompt();
    setShowPrompt(false);
  };

  // Check if dismissed recently
  useEffect(() => {
    // This is now handled by shouldShowInstallPrompt utility
  }, []);

  if (isInstalled || !showPrompt) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-sm z-50">
      <Card className="shadow-lg border-primary/20 bg-card/95 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-primary" />
              <CardTitle className="text-sm">Instalar App</CardTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
              className="h-6 w-6 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <CardDescription className="text-xs">
            {isIOS 
              ? 'Adicione o Fly Bird à sua tela inicial para uma experiência melhor!'
              : 'Instalar Fly Bird'
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          {isIOS ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Para instalar no iOS:
              </p>
              <ol className="text-xs text-muted-foreground space-y-1">
                <li>1. Toque no ícone de compartilhar (□↑)</li>
                <li>2. Selecione "Adicionar à Tela Inicial"</li>
                <li>3. Toque em "Adicionar"</li>
              </ol>
            </div>
          ) : (
            <Button 
              onClick={handleInstallClick}
              className="w-full bg-primary hover:bg-primary/90"
              size="sm"
            >
              <Download className="h-4 w-4 mr-2" />
              Instalar App
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default InstallPrompt;