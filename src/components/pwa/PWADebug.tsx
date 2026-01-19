import React from 'react';
import { usePWA } from '@/hooks/usePWA';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { isStandalone, isIOS, isAndroid, isMobile } from '@/utils/pwaUtils';

const PWADebug = () => {
  const { 
    deferredPrompt, 
    isInstallable, 
    isInstalled, 
    isOnline, 
    installApp, 
    registerServiceWorker 
  } = usePWA();

  const debugInfo = {
    'Service Worker Support': 'serviceWorker' in navigator,
    'Standalone Mode': isStandalone(),
    'iOS Device': isIOS(),
    'Android Device': isAndroid(),
    'Mobile Device': isMobile(),
    'Online Status': isOnline,
    'Has Deferred Prompt': !!deferredPrompt,
    'Is Installable': isInstallable,
    'Is Installed': isInstalled,
    'User Agent': navigator.userAgent,
    'Display Mode': window.matchMedia('(display-mode: standalone)').matches ? 'standalone' : 'browser'
  };

  const testServiceWorker = async () => {
    console.log('Testing service worker registration...');
    const result = await registerServiceWorker();
    console.log('SW registration result:', result);
  };

  const testInstall = async () => {
    console.log('Testing PWA installation...');
    const result = await installApp();
    console.log('Install result:', result);
  };

  return (
    <Card className="w-full max-w-2xl mx-auto m-4">
      <CardHeader>
        <CardTitle>PWA Debug Information</CardTitle>
        <CardDescription>
          Informações técnicas sobre o Progressive Web App
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-2 text-sm">
          {Object.entries(debugInfo).map(([key, value]) => (
            <div key={key} className="flex justify-between items-center p-2 border rounded">
              <span className="font-medium">{key}:</span>
              <Badge variant={
                typeof value === 'boolean' 
                  ? (value ? 'default' : 'secondary')
                  : 'outline'
              }>
                {String(value)}
              </Badge>
            </div>
          ))}
        </div>
        
        <div className="flex flex-wrap gap-2">
          <Button onClick={testServiceWorker} variant="outline" size="sm">
            Test Service Worker
          </Button>
          <Button onClick={testInstall} variant="outline" size="sm">
            Test Install
          </Button>
          <Button 
            onClick={() => window.location.reload()} 
            variant="outline" 
            size="sm"
          >
            Reload Page
          </Button>
        </div>

        <div className="text-xs text-muted-foreground">
          <p>Verifique o console do navegador para logs detalhados.</p>
          <p>Para testar a instalação, abra as ferramentas de desenvolvedor → Application → Manifest</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default PWADebug;