import { useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { isStandalone } from '@/utils/pwaUtils';

export const useNativeLinkHandler = () => {
  const navigate = useNavigate();
  const visibilityRef = useRef<boolean>(false);
  
  const openLink = useCallback(async (webUrl: string, nativeUrl?: string) => {
    console.log('Opening link:', { webUrl, nativeUrl, isStandalone: isStandalone() });
    
    // SEMPRE tentar app nativo primeiro se temos nativeUrl
    if (nativeUrl) {
      try {
        // Verificar modo desenvolvedor
        const isDeveloperMode = localStorage.getItem('developer_mode') === 'enabled';
        
        // SEMPRE navegar para home primeiro (exceto em modo desenvolvedor)
        if (!isDeveloperMode) {
          console.log('Navigating to home before opening native app');
          navigate('/');
        } else {
          console.log('🔧 Developer mode: Staying on current page');
        }
        
        // Detectar se usuário saiu da PWA (app nativo abriu)
        let appOpened = false;
        
        const handleVisibilityChange = () => {
          if (document.hidden) {
            console.log('App became hidden - native app likely opened');
            appOpened = true;
            visibilityRef.current = true;
          }
        };
        
        document.addEventListener('visibilitychange', handleVisibilityChange);
        
        // Wait for navigation to complete before trying to open native app
        setTimeout(() => {
          console.log('Attempting to open native app:', nativeUrl);
          
          // Tentar abrir app nativo
          try {
            // Método 1: Usar window.location para iOS
            if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
              window.location.href = nativeUrl;
            } else {
              // Método 2: Criar link temporário para Android/Desktop
              const testLink = document.createElement('a');
              testLink.href = nativeUrl;
              testLink.style.display = 'none';
              document.body.appendChild(testLink);
              testLink.click();
              document.body.removeChild(testLink);
            }
          } catch (error) {
            console.error('Error opening native app:', error);
          }
          
          // Fallback após 300ms se app nativo não abriu
          setTimeout(() => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            
            if (!appOpened && !visibilityRef.current) {
              console.log('Native app did not open, falling back to web browser');
              window.open(webUrl, '_blank', 'noopener,noreferrer');
            } else {
              console.log('Native app opened successfully');
            }
            
            visibilityRef.current = false;
          }, 300);
        }, 300);
        
        return;
      } catch (error) {
        console.error('Error in native link handling:', error);
      }
    }
    
    // Fallback padrão: abrir no navegador web
    console.log('Opening in web browser:', webUrl);
    window.open(webUrl, '_blank', 'noopener,noreferrer');
  }, [navigate]);

  return { openLink };
};