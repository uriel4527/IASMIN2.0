// Optimized service worker registration with deferred loading
export const registerServiceWorkerAsync = () => {
  // Only register if service workers are supported
  if (!('serviceWorker' in navigator)) {
    return Promise.resolve(null);
  }

  // Defer service worker registration until page is loaded
  return new Promise<ServiceWorkerRegistration | null>((resolve) => {
    // Wait for page load to avoid blocking initial render
    const registerSW = async () => {
      try {
        console.log('Registering service worker (async)...');
        const registration = await navigator.serviceWorker.register('/sw.js');
        console.log('SW registered successfully (async): ', registration);
        resolve(registration);
      } catch (error) {
        console.error('SW registration failed (async): ', error);
        resolve(null);
      }
    };

    // Register after page is fully loaded
    if (document.readyState === 'complete') {
      // Use requestIdleCallback for better performance if available
      if ('requestIdleCallback' in window) {
        requestIdleCallback(registerSW);
      } else {
        setTimeout(registerSW, 1000);
      }
    } else {
      window.addEventListener('load', () => {
        if ('requestIdleCallback' in window) {
          requestIdleCallback(registerSW);
        } else {
          setTimeout(registerSW, 1000);
        }
      });
    }
  });
};