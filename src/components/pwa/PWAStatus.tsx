import React from 'react';
import { usePWA } from '@/hooks/usePWA';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Smartphone, WifiOff, Download } from 'lucide-react';

const PWAStatus = () => {
  const { isInstalled, isInstallable, isOnline, installApp } = usePWA();

  if (isInstalled) {
    return (
      <div className="flex items-center gap-2">
        <Badge variant="default" className="bg-success text-success-foreground">
          <Smartphone className="h-3 w-3 mr-1" />
          App Instalado
        </Badge>
        {!isOnline && (
          <Badge variant="destructive">
            <WifiOff className="h-3 w-3 mr-1" />
            Offline
          </Badge>
        )}
      </div>
    );
  }

  if (isInstallable) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={installApp}
        className="text-xs gap-1"
      >
        <Download className="h-3 w-3" />
        Instalar
      </Button>
    );
  }

  return null;
};

export default PWAStatus;