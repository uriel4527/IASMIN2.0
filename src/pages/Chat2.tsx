import { useRef, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { WebSocketChatInterface } from "@/components/chat/WebSocketChatInterface";
import { isStandalone } from "@/utils/pwaUtils";
import { useAuth } from "@/contexts/AuthContext";
import { SimpleLoginForm } from "@/components/auth/SimpleLoginForm";

const Chat2 = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Acesso ao chat: conceder quando em modo desenvolvedor ou usuário autenticado
  useEffect(() => {
    const isDeveloperMode = localStorage.getItem('developer_mode') === 'enabled';
    
    if (isDeveloperMode || user) {
      sessionStorage.setItem('chatAccess', 'granted');
    }
    return () => {
      if (!isDeveloperMode) {
        sessionStorage.removeItem('chatAccess');
      }
    };
  }, [user]);

  // PWA Auto-redirect após 30 segundos sem interação
  useEffect(() => {
    const isDeveloperMode = localStorage.getItem('developer_mode') === 'enabled';
    
    // Modo desenvolvedor: desabilitar timeout completamente
    if (isDeveloperMode) {
      console.log('🔧 Modo desenvolvedor: timeout desabilitado');
      return;
    }

    if (!isStandalone()) return;

    const TIMEOUT_DURATION = 30000; // 30 segundos
    let timeoutId: NodeJS.Timeout;

    const resetTimeout = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        navigate('/', { replace: true });
      }, TIMEOUT_DURATION);
    };

    const handleInteraction = () => {
      resetTimeout();
    };

    // Iniciar o timeout
    resetTimeout();

    // Eventos para detectar qualquer interação do usuário
    const events = [
      'click',
      'touchstart',
      'touchmove',
      'touchend',
      'keydown',
      'scroll',
      'mousemove',
      'mousedown',
      'mouseup',
      'focus',
      'input',
      'change',        // Seleção de arquivo na galeria
      'submit',        // Envio de formulários
      'reset',         // Reset de formulários
      'loadstart',     // Início de carregamento de mídia
      'canplay',       // Mídia pronta para reproduzir
      'dragstart',     // Início de arrastar
      'dragend',       // Fim de arrastar
      'select',        // Seleção de texto
      'selectstart',   // Início de seleção
      'audiostart',    // Início de áudio (se disponível)
      'audioend',      // Fim de áudio (se disponível)
      'recording',     // Eventos de gravação (se disponível)
      'timeupdate'     // Atualização de tempo de mídia
    ];

    // Adicionar listeners para todos os tipos de interação
    events.forEach(event => {
      document.addEventListener(event, handleInteraction, { passive: true });
    });

    return () => {
      clearTimeout(timeoutId);
      events.forEach(event => {
        document.removeEventListener(event, handleInteraction);
      });
    };
  }, [navigate]);

  // Handle visual viewport for mobile keyboard
  const [viewportHeight, setViewportHeight] = useState('100%');

  useEffect(() => {
    if (!window.visualViewport) return;

    const handleResize = () => {
      // Use visualViewport height to ensure keyboard doesn't cover content
      setViewportHeight(`${window.visualViewport.height}px`);
    };

    window.visualViewport.addEventListener('resize', handleResize);
    // Initial set
    handleResize();

    return () => window.visualViewport.removeEventListener('resize', handleResize);
  }, []);

  if (!user) {
    return (
      <div className="h-full flex items-center justify-center tech-pattern-bg overflow-hidden" style={{ height: viewportHeight }}>
        <SimpleLoginForm />
      </div>
    );
  }

  return (
    <div className="bg-background flex flex-col overflow-hidden" style={{ height: viewportHeight }}>
      <WebSocketChatInterface currentUser={user} />
    </div>
  );
};

export default Chat2;
