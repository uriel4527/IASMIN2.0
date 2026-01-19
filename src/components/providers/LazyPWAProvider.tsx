import React, { lazy, Suspense, useState, useEffect } from 'react';

// Lazy load PWA components
const InstallPrompt = lazy(() => import('@/components/pwa/InstallPrompt'));
const OfflineIndicator = lazy(() => import('@/components/ui/offline-indicator'));

interface LazyPWAProviderProps {
  children: React.ReactNode;
  enableInstallPrompt?: boolean;
  enableOfflineIndicator?: boolean;
}

export const LazyPWAProvider: React.FC<LazyPWAProviderProps> = ({ 
  children, 
  enableInstallPrompt = false,
  enableOfflineIndicator = false
}) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [shouldShowInstall, setShouldShowInstall] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (enableInstallPrompt) {
      const timer = setTimeout(() => setShouldShowInstall(true), 3000);
      return () => clearTimeout(timer);
    }
  }, [enableInstallPrompt]);

  return (
    <>
      {children}
      
      {/* Only load install prompt when needed and after delay */}
      {enableInstallPrompt && shouldShowInstall && (
        <Suspense fallback={null}>
          <InstallPrompt />
        </Suspense>
      )}
      
      {/* Only load offline indicator when offline and needed */}
      {enableOfflineIndicator && !isOnline && (
        <Suspense fallback={null}>
          <OfflineIndicator />
        </Suspense>
      )}
    </>
  );
};