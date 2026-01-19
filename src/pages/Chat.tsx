import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { SimpleLoginForm } from "@/components/auth/SimpleLoginForm";
import { LazyChatInterface } from "@/components/chat/LazyChatInterface";
import { isStandalone } from "@/utils/pwaUtils";
const Chat = () => {
  const {
    user
  } = useAuth();
  const navigate = useNavigate();
  const [position, setPosition] = useState({
    x: 20,
    y: window.innerHeight - 300
  });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({
    x: 0,
    y: 0
  });
  const buttonRef = useRef<HTMLDivElement>(null);

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
    
    // Modo desenvolvedor: desabilitar timeout
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
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  };
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    setIsDragging(true);
    setDragStart({
      x: touch.clientX - position.x,
      y: touch.clientY - position.y
    });
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (isDragging) {
      const touch = e.touches[0];
      setPosition({
        x: touch.clientX - dragStart.x,
        y: touch.clientY - dragStart.y
      });
    }
  };
  const handleMouseUp = () => {
    setIsDragging(false);
  };
  const handleTouchEnd = () => {
    setIsDragging(false);
  };
  const handleClick = () => {
    if (!isDragging) {
      navigate('/');
    }
  };
  if (!user) {
    return <div className="h-screen-fixed flex items-center justify-center tech-pattern-bg overflow-hidden">
        <SimpleLoginForm />
      </div>;
  }
  return <div className="tech-pattern-bg h-screen-fixed">
      <LazyChatInterface />
      
      {/* Draggable Floating Button */}
      
    </div>;
};
export default Chat;
