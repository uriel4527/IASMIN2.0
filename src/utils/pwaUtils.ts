// PWA Utility functions

export const isStandalone = (): boolean => {
  return window.matchMedia('(display-mode: standalone)').matches || 
         (window.navigator as any).standalone === true;
};

export const isIOS = (): boolean => {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
};

export const isAndroid = (): boolean => {
  return /Android/.test(navigator.userAgent);
};

export const isMobile = (): boolean => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

export const canInstallPWA = (): boolean => {
  // Check if browser supports PWA installation
  return 'serviceWorker' in navigator && 'BeforeInstallPromptEvent' in window;
};

export const getInstallPromptDelay = (): number => {
  // Different delays for different platforms
  if (isIOS()) return 8000; // iOS users need more time to understand
  if (isAndroid()) return 5000; // Android users are more familiar
  return 6000; // Desktop users
};

export const shouldShowInstallPrompt = (): boolean => {
  if (isStandalone()) return false;
  
  const dismissed = localStorage.getItem('pwa-install-dismissed');
  if (dismissed) {
    const dismissedTime = parseInt(dismissed);
    const now = Date.now();
    const twentyFourHours = 24 * 60 * 60 * 1000;
    
    if (now - dismissedTime < twentyFourHours) {
      return false;
    }
  }
  
  return true;
};

export const dismissInstallPrompt = (): void => {
  localStorage.setItem('pwa-install-dismissed', Date.now().toString());
};

export const trackPWAUsage = (event: string, data?: any): void => {
  // Track PWA usage events
  console.log(`PWA Event: ${event}`, data);
  
  // You can integrate with analytics here
  if ((window as any).gtag) {
    (window as any).gtag('event', event, {
      event_category: 'PWA',
      ...data
    });
  }
};