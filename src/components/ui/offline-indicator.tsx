import React from 'react';
import { usePWA } from '@/hooks/usePWA';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { WifiOff, Wifi } from 'lucide-react';

const OfflineIndicator = () => {
  const { isOnline } = usePWA();

  if (isOnline) {
    return null;
  }

  return (
    <Alert className="fixed top-4 left-4 right-4 z-40 bg-destructive/90 border-destructive text-destructive-foreground backdrop-blur-sm">
      <WifiOff className="h-4 w-4" />
      <AlertDescription className="text-sm">
        Você está offline. Algumas funcionalidades podem estar limitadas.
      </AlertDescription>
    </Alert>
  );
};

export default OfflineIndicator;