import React, { lazy, Suspense } from 'react';

// Lazy load AuthContext only when needed
const AuthProvider = lazy(() => import('@/contexts/AuthContext').then(module => ({ default: module.AuthProvider })));

interface ConditionalAuthProviderProps {
  children: React.ReactNode;
  needsAuth?: boolean;
}

export const ConditionalAuthProvider: React.FC<ConditionalAuthProviderProps> = ({ 
  children, 
  needsAuth = false 
}) => {
  // If auth is not needed (like on the flyboard page), don't load AuthProvider
  if (!needsAuth) {
    return <>{children}</>;
  }

  // Only load AuthProvider when authentication is actually needed
  return (
    <Suspense fallback={<div className="flex h-screen-fixed items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>}>
      <AuthProvider>{children}</AuthProvider>
    </Suspense>
  );
};