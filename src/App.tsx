import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';
import { ConditionalAuthProvider } from '@/components/providers/ConditionalAuthProvider';
import { LazyPWAProvider } from '@/components/providers/LazyPWAProvider';
import { DeveloperModeRedirect } from '@/components/routing/DeveloperModeRedirect';
import { usePWANavigation } from '@/hooks/usePWANavigation';
import { registerServiceWorkerAsync } from '@/utils/serviceWorkerOptimized';
import { RequestPermissions } from '@/components/RequestPermissions';

// Lazy load components for maximum code splitting
const OptimizedFlyboard = lazy(() => import('@/components/flyboard/OptimizedFlyboard'));
const Chat = lazy(() => import('@/pages/Chat'));
const Chat2 = lazy(() => import('@/pages/Chat2'));
const Monitor = lazy(() => import('@/pages/Monitor'));
const Monitoring = lazy(() => import('@/pages/Monitoring'));
const Install = lazy(() => import('@/pages/Install'));
const TestPushNotification = lazy(() => import('@/pages/TestPushNotification'));
const PushDebug = lazy(() => import('@/pages/PushDebug'));
const Push = lazy(() => import('@/pages/Push'));
const NotFound = lazy(() => import('@/pages/NotFound'));

// Initialize query client outside component with optimized settings
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
      retry: 1, // Reduce retries for faster failures
      refetchOnWindowFocus: false, // Disable auto-refetch
    },
  },
});

// Lightweight PWA Provider component
const PWAProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Use PWA navigation hook
  usePWANavigation();
  
  // Register service worker asynchronously without blocking
  React.useEffect(() => {
    registerServiceWorkerAsync();
  }, []);
  
  return (
    <>
      <RequestPermissions />
      {children}
    </>
  );
};

// Optimized loading fallback component
const RouteLoadingFallback = () => (
  <div className="flex h-screen-fixed items-center justify-center">
    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
  </div>
);

// Route wrapper to determine if auth is needed
const RouteWrapper: React.FC<{ 
  element: React.ReactElement; 
  needsAuth?: boolean;
  needsPWA?: boolean;
}> = ({ element, needsAuth = false, needsPWA = false }) => (
  <ConditionalAuthProvider needsAuth={needsAuth}>
    <LazyPWAProvider 
      enableInstallPrompt={needsPWA} 
      enableOfflineIndicator={needsPWA}
    >
      {element}
    </LazyPWAProvider>
  </ConditionalAuthProvider>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} forcedTheme="dark">
      <TooltipProvider>
        <BrowserRouter>
          <PWAProvider>
            <Suspense fallback={<RouteLoadingFallback />}>
              <Routes>
                {/* Flyboard - No auth, minimal PWA */}
                <Route 
                  path="/" 
                  element={
                    <RouteWrapper 
                      element={<OptimizedFlyboard />} 
                      needsAuth={false}
                      needsPWA={false}
                    />
                  } 
                />
                
                {/* Chat - Needs auth and full PWA */}
                <Route 
                  path="/chat" 
                  element={
                    <RouteWrapper 
                      element={<Chat />} 
                      needsAuth={true}
                      needsPWA={true}
                    />
                  } 
                />

                {/* Chat2 - Needs auth and full PWA */}
                <Route 
                  path="/chat2" 
                  element={
                    <RouteWrapper 
                      element={<Chat2 />} 
                      needsAuth={true}
                      needsPWA={true}
                    />
                  } 
                />
                
                {/* Monitoring pages - Need auth */}
                <Route 
                  path="/monitor" 
                  element={
                    <RouteWrapper 
                      element={<Monitor />} 
                      needsAuth={true}
                      needsPWA={false}
                    />
                  } 
                />
                <Route 
                  path="/monitoring" 
                  element={
                    <RouteWrapper 
                      element={<Monitoring />} 
                      needsAuth={true}
                      needsPWA={false}
                    />
                  } 
                />
                
                {/* Install page - Needs PWA */}
                <Route 
                  path="/install" 
                  element={
                    <RouteWrapper 
                      element={<Install />} 
                      needsAuth={false}
                      needsPWA={true}
                    />
                  } 
                />
                
                {/* Test Push Notification - Needs PWA */}
                <Route 
                  path="/test-push" 
                  element={
                    <RouteWrapper 
                      element={<TestPushNotification />} 
                      needsAuth={false}
                      needsPWA={true}
                    />
                  } 
                />
                
                {/* Push - Simple global sender */}
                <Route 
                  path="/push" 
                  element={
                    <RouteWrapper 
                      element={<Push />} 
                      needsAuth={false}
                      needsPWA={true}
                    />
                  } 
                />
                
                {/* Push Debug - Needs auth and PWA */}
                <Route 
                  path="/push-debug" 
                  element={
                    <RouteWrapper 
                      element={<PushDebug />} 
                      needsAuth={true}
                      needsPWA={true}
                    />
                  } 
                />
                
                {/* 404 - Minimal requirements */}
                <Route 
                  path="*" 
                  element={
                    <RouteWrapper 
                      element={<NotFound />} 
                      needsAuth={false}
                      needsPWA={false}
                    />
                  } 
                />
              </Routes>
            </Suspense>
            <Toaster />
          </PWAProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
