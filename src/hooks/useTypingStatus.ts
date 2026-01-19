import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase, TypingStatus } from '@/lib/supabase';

export const useTypingStatus = (currentUserId: string, otherUserId: string) => {
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const typingTimeoutRef = useRef<number | null>(null);
  const heartbeatTimeoutRef = useRef<number | null>(null);
  const fallbackTimeoutRef = useRef<number | null>(null);
  const periodicCheckRef = useRef<number | null>(null);
  const minVisibleTimeoutRef = useRef<number | null>(null);
  const isTypingRef = useRef(false);
  const lastTypingTimestamp = useRef<number>(0);
  const showingTypingRef = useRef(false);

  // Função para definir status de digitação usando UPSERT
  const setTypingStatus = useCallback(async (isTyping: boolean) => {
    try {
      console.log('Setting typing status:', { currentUserId, otherUserId, isTyping });
      
      if (currentUserId === otherUserId) {
        console.warn('Cannot set typing status for same user');
        return;
      }
      
      if (isTyping) {
        const timestamp = new Date().toISOString();
        lastTypingTimestamp.current = Date.now();
        
        // Usar UPSERT em vez de delete+insert
        const { error } = await supabase
          .from('typing_status')
          .upsert({
            user_id: currentUserId,
            conversation_with: otherUserId,
            is_typing: true,
            last_updated: timestamp,
          }, {
            onConflict: 'user_id,conversation_with'
          });
        
        if (error) {
          console.error('Error upserting typing status:', error);
        } else {
          console.log('Typing status updated successfully');
        }
      } else {
        // Ao parar de digitar, atualizar para false em vez de deletar
        const { error } = await supabase
          .from('typing_status')
          .update({ is_typing: false, last_updated: new Date().toISOString() })
          .eq('user_id', currentUserId)
          .eq('conversation_with', otherUserId);
        
        if (error) {
          console.error('Error updating typing status to false:', error);
        } else {
          console.log('Typing status set to false');
        }
      }
    } catch (error) {
      console.error('Error updating typing status:', error);
    }
  }, [currentUserId, otherUserId]);

  // Função para limpar completamente o status (para cleanup)
  const clearTypingStatus = useCallback(async () => {
    try {
      if (!currentUserId || !otherUserId) return;
      
      console.log('Clearing typing status completely');
      
      await supabase
        .from('typing_status')
        .update({ is_typing: false })
        .eq('user_id', currentUserId)
        .eq('conversation_with', otherUserId);
      
    } catch (error) {
      console.error('Error clearing typing status:', error);
    }
  }, [currentUserId, otherUserId]);

  // Heartbeat para manter o status atualizado
  const startHeartbeat = useCallback(() => {
    if (heartbeatTimeoutRef.current) {
      window.clearTimeout(heartbeatTimeoutRef.current);
    }
    
    heartbeatTimeoutRef.current = window.setTimeout(() => {
      if (isTypingRef.current) {
        console.log('Heartbeat: updating typing timestamp');
        setTypingStatus(true);
        startHeartbeat(); // Continue heartbeat
      }
    }, 2500); // Atualizar a cada 2.5 segundos
  }, [setTypingStatus]);

  // Função para mostrar typing com tempo mínimo visível
  const showTypingIndicator = useCallback((show: boolean) => {
    if (show && !showingTypingRef.current) {
      showingTypingRef.current = true;
      setOtherUserTyping(true);
      console.log('Showing typing indicator');
    } else if (!show && showingTypingRef.current) {
      // Garantir tempo mínimo visível de 700ms
      if (minVisibleTimeoutRef.current) {
        window.clearTimeout(minVisibleTimeoutRef.current);
      }
      
      minVisibleTimeoutRef.current = window.setTimeout(() => {
        showingTypingRef.current = false;
        setOtherUserTyping(false);
        console.log('Hiding typing indicator after minimum time');
      }, 700);
    }
  }, []);

  // Função chamada quando usuário começa a digitar
  const startTyping = useCallback(() => {
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      setTypingStatus(true);
      startHeartbeat();
    }

    // Limpar timeouts anteriores
    if (typingTimeoutRef.current) {
      window.clearTimeout(typingTimeoutRef.current);
    }
    if (fallbackTimeoutRef.current) {
      window.clearTimeout(fallbackTimeoutRef.current);
    }

    // Parar de "digitar" após 2 segundos de inatividade
    typingTimeoutRef.current = window.setTimeout(() => {
      stopTyping();
    }, 2000);

    // Fallback de segurança - sempre limpar após 6 segundos
    fallbackTimeoutRef.current = window.setTimeout(() => {
      if (isTypingRef.current) {
        console.log('Fallback: Force stopping typing after 6 seconds');
        stopTyping();
      }
    }, 6000);
  }, [setTypingStatus, startHeartbeat]);

  // Função para parar indicador de digitação
  const stopTyping = useCallback(() => {
    if (isTypingRef.current) {
      isTypingRef.current = false;
      setTypingStatus(false);
    }

    // Limpar todos os timeouts
    if (typingTimeoutRef.current) {
      window.clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    if (heartbeatTimeoutRef.current) {
      window.clearTimeout(heartbeatTimeoutRef.current);
      heartbeatTimeoutRef.current = null;
    }
    if (fallbackTimeoutRef.current) {
      window.clearTimeout(fallbackTimeoutRef.current);
      fallbackTimeoutRef.current = null;
    }
  }, [setTypingStatus]);

  // Verificação periódica para sincronizar estado
  const startPeriodicCheck = useCallback(() => {
    if (periodicCheckRef.current) {
      window.clearInterval(periodicCheckRef.current);
    }
    
    periodicCheckRef.current = window.setInterval(async () => {
      try {
        const { data, error } = await supabase
          .from('typing_status')
          .select('*')
          .eq('user_id', otherUserId)
          .eq('conversation_with', currentUserId)
          .single();
        
        if (error || !data) {
          // Não há status no banco, limpar estado local
          if (showingTypingRef.current) {
            console.log('Periodic check: No typing status in DB, clearing local state');
            showTypingIndicator(false);
          }
          return;
        }
        
        // Verificar se o timestamp é muito antigo (mais de 8 segundos)
        const timeDiff = Date.now() - new Date(data.last_updated).getTime();
        if (timeDiff > 8000 || !data.is_typing) {
          console.log('Periodic check: Typing status is stale or false, clearing');
          showTypingIndicator(false);
        } else if (data.is_typing && !showingTypingRef.current) {
          console.log('Periodic check: Should show typing indicator');
          showTypingIndicator(true);
        }
      } catch (error) {
        console.error('Error in periodic check:', error);
      }
    }, 4000); // Verificar a cada 4 segundos
  }, [currentUserId, otherUserId, showTypingIndicator]);

  // Detectar quando usuário sai da página
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (isTypingRef.current) {
        console.log('Page unload: clearing typing status');
        clearTypingStatus();
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden && isTypingRef.current) {
        console.log('Page hidden: stopping typing');
        stopTyping();
      }
    };

    const handleOffline = () => {
      if (isTypingRef.current) {
        console.log('Went offline: stopping typing');
        stopTyping();
      }
    };

    // Adicionar event listeners
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('pagehide', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('pagehide', handleBeforeUnload);
    };
  }, [clearTypingStatus, stopTyping]);

  // Subscription para monitorar status do outro usuário
  useEffect(() => {
    if (!currentUserId || !otherUserId) return;

    console.log('Setting up typing subscription:', { currentUserId, otherUserId });

    // Limpar estado local inicialmente
    showTypingIndicator(false);

    // Iniciar verificação periódica
    startPeriodicCheck();

    const channel = supabase
      .channel(`typing-${currentUserId}-${otherUserId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'typing_status',
        filter: `user_id=eq.${otherUserId}`,
      }, (payload) => {
        console.log('Typing payload received:', payload);
        
        // Filtrar apenas conversas relevantes
        const typingData = payload.new as TypingStatus;
        
        if (payload.eventType === 'DELETE') {
          console.log('Typing status deleted via subscription');
          showTypingIndicator(false);
          return;
        }
        
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          if (!typingData || typingData?.conversation_with !== currentUserId) {
            return; // Não é nossa conversa
          }
          
          console.log(`${otherUserId} typing status via subscription:`, typingData.is_typing);
          
          if (typingData.is_typing) {
            showTypingIndicator(true);
          } else {
            showTypingIndicator(false);
          }
        }
      })
      .subscribe((status) => {
        console.log('Typing subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('Typing subscription successful');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('Typing subscription error');
        }
      });

    return () => {
      console.log('Cleaning up typing subscription and timers');
      
      // Limpar próprio status
      if (isTypingRef.current) {
        clearTypingStatus();
      }
      
      // Limpar todos os timeouts
      if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
      if (heartbeatTimeoutRef.current) window.clearTimeout(heartbeatTimeoutRef.current);
      if (fallbackTimeoutRef.current) window.clearTimeout(fallbackTimeoutRef.current);
      if (periodicCheckRef.current) window.clearInterval(periodicCheckRef.current);
      if (minVisibleTimeoutRef.current) window.clearTimeout(minVisibleTimeoutRef.current);
      
      // Limpar subscription
      channel.unsubscribe();
      
      // Limpar estado local
      showingTypingRef.current = false;
      setOtherUserTyping(false);
    };
  }, [currentUserId, otherUserId, clearTypingStatus, startPeriodicCheck, showTypingIndicator]);

  return {
    otherUserTyping,
    startTyping,
    stopTyping,
  };
};