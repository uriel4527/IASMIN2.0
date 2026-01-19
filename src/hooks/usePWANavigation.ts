import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { isAndroid, isStandalone } from '@/utils/pwaUtils';

export const usePWANavigation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isRedirectingRef = useRef(false);

  useEffect(() => {
    // Só interceptar se for PWA no Android
    if (!isAndroid() || !isStandalone()) {
      return;
    }

    console.log('PWA Android detected - Setting up navigation control');

    // Interceptar o botão voltar do sistema
    const handlePopState = (event: PopStateEvent) => {
      console.log('PWA Android: Back button pressed, redirecting');
      event.preventDefault();
      const target = localStorage.getItem('developer_mode') === 'enabled' ? '/chat' : '/';
      navigate(target, { replace: true });
    };

    // Detectar quando o app volta a ficar visível (retorno do segundo plano)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('PWA Android: App became visible again');
        
        // Verificar se não está na página inicial e não está já redirecionando
        if (location.pathname !== '/' && !isRedirectingRef.current) {
          console.log(`PWA Android: Redirecting from ${location.pathname}`);
          isRedirectingRef.current = true;
          const target = localStorage.getItem('developer_mode') === 'enabled' ? '/chat' : '/';
          navigate(target, { replace: true });
          
          // Reset da flag após um pequeno delay
          setTimeout(() => {
            isRedirectingRef.current = false;
          }, 500);
        }
      } else if (document.visibilityState === 'hidden') {
        console.log('PWA Android: App went to background');
        localStorage.setItem('pwa-went-background', Date.now().toString());
      }
    };

    // Fallback para casos onde visibilitychange não funciona
    const handleWindowFocus = () => {
      const backgroundTime = localStorage.getItem('pwa-went-background');
      if (backgroundTime) {
        const timeDiff = Date.now() - parseInt(backgroundTime);
        
        // Se passou mais de 1 segundo no background, considerar como retorno ao app
        if (timeDiff > 1000 && location.pathname !== '/' && !isRedirectingRef.current) {
          console.log(`PWA Android: Window focus - Redirecting from ${location.pathname}`);
          isRedirectingRef.current = true;
          const target = localStorage.getItem('developer_mode') === 'enabled' ? '/chat' : '/';
          navigate(target, { replace: true });
          
          setTimeout(() => {
            isRedirectingRef.current = false;
          }, 500);
        }
        
        localStorage.removeItem('pwa-went-background');
      }
    };

    const handleWindowBlur = () => {
      console.log('PWA Android: Window lost focus');
      localStorage.setItem('pwa-went-background', Date.now().toString());
    };

    // Limpar histórico e substituir por página inicial
    const resetHistory = () => {
      // Substituir toda a pilha de histórico pela página inicial
      window.history.replaceState(null, '', '/');
      
      // Adicionar uma entrada extra para capturar o botão voltar
      window.history.pushState(null, '', location.pathname);
    };

    // Adicionar todos os listeners
    window.addEventListener('popstate', handlePopState);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('blur', handleWindowBlur);
    
    // Reset do histórico apenas se não estivermos na página inicial
    if (location.pathname !== '/') {
      resetHistory();
    }

    return () => {
      window.removeEventListener('popstate', handlePopState);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [navigate, location.pathname]);
};
