import React, { Suspense, lazy, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { SimpleChatInterface } from '@/components/chat/SimpleChatInterface';
import { SimpleLoginForm } from '@/components/auth/SimpleLoginForm';

// Preload the Chat component for faster navigation
const LazyChat = lazy(() => import('@/pages/Chat'));

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  // Modo desenvolvedor: redirecionar automaticamente para /chat (REMOVIDO A PEDIDO DO USUÁRIO)
  // useEffect(() => {
  //   if (localStorage.getItem('developer_mode') === 'enabled') {
  //     navigate('/chat', { replace: true });
  //   }
  // }, [navigate]);

  // Se modo desenvolvedor está ativo, não renderizar nada (redirecionamento já ocorreu)
  // if (localStorage.getItem('developer_mode') === 'enabled') {
  //   return null;
  // }

  if (loading) {
    return (
      <div className="flex h-screen-fixed items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 overflow-hidden">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-screen-fixed items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4 overflow-hidden">
        <SimpleLoginForm />
      </div>
    );
  }

  return (
    <>
      <SimpleChatInterface />
      {/* Preload Chat component in background for faster navigation */}
      <div style={{ display: 'none' }}>
        <Suspense fallback={null}>
          <LazyChat />
        </Suspense>
      </div>
    </>
  );
};

export default Index;
