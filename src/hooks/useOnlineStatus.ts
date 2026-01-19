import { useEffect, useRef, useState } from 'react';
import { supabase, User } from '@/lib/supabase';

export const useOnlineStatus = (currentUserId: string) => {
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const cleanupIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isOnlineRef = useRef(false);
  const channelRef = useRef<any>(null);

  // Função para atualizar status online
  const updateOnlineStatus = async (isOnline: boolean) => {
    if (!currentUserId) return;

    try {
      console.log('Updating online status:', { currentUserId, isOnline });
      
      // Apenas atualizar os campos essenciais para status online
      const { error } = await supabase
        .from('users')
        .update({
          is_online: isOnline,
          last_seen: new Date().toISOString(),
        })
        .eq('id', currentUserId);

      if (error) {
        console.error('Error updating online status:', error);
      } else {
        console.log('Online status updated successfully');
      }
    } catch (error) {
      console.error('Error updating online status:', error);
    }
  };

  // Buscar usuários online atuais
  const fetchOnlineUsers = async () => {
    try {
      // Primeiro executa limpeza de usuários offline
      await supabase.rpc('cleanup_offline_users');
      
      const { data, error } = await supabase
        .from('users')
        .select('id')
        .eq('is_online', true)
        .neq('id', currentUserId);

      if (error) {
        console.error('Error fetching online users:', error);
        return;
      }

      const onlineUserIds = data?.map(user => user.id) || [];
      setOnlineUsers(new Set(onlineUserIds));
      console.log('Current online users after cleanup:', onlineUserIds);
    } catch (error) {
      console.error('Error fetching online users:', error);
    }
  };

  // Função para forçar limpeza de usuários offline
  const forceCleanupOfflineUsers = async () => {
    try {
      console.log('Running cleanup of offline users...');
      const { data, error } = await supabase.rpc('cleanup_offline_users');
      
      if (error) {
        console.error('Error running cleanup:', error);
      } else {
        console.log('Cleanup completed, affected rows:', data);
        // Refresh local state after cleanup
        await fetchOnlineUsers();
      }
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  };

  // Função para iniciar o heartbeat
  const startHeartbeat = () => {
    if (heartbeatIntervalRef.current || !currentUserId) return;

    // Marcar como online imediatamente
    updateOnlineStatus(true);
    isOnlineRef.current = true;

    // Atualizar status a cada 30 segundos
    heartbeatIntervalRef.current = setInterval(() => {
      if (isOnlineRef.current && !document.hidden) {
        updateOnlineStatus(true);
      }
    }, 30000);

    // Iniciar limpeza automática a cada 2 minutos
    if (!cleanupIntervalRef.current) {
      cleanupIntervalRef.current = setInterval(() => {
        forceCleanupOfflineUsers();
      }, 120000); // 2 minutos
    }

    console.log('Heartbeat and cleanup started');
  };

  // Função para parar o heartbeat
  const stopHeartbeat = () => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }

    if (cleanupIntervalRef.current) {
      clearInterval(cleanupIntervalRef.current);
      cleanupIntervalRef.current = null;
    }

    if (isOnlineRef.current && currentUserId) {
      updateOnlineStatus(false);
      isOnlineRef.current = false;
    }

    console.log('Heartbeat and cleanup stopped');
  };

  // Gerenciar visibilidade da página
  useEffect(() => {
    if (!currentUserId) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log('Page hidden, stopping heartbeat');
        stopHeartbeat();
      } else {
        console.log('Page visible, starting heartbeat');
        startHeartbeat();
      }
    };

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      console.log('Before unload event triggered');
      if (isOnlineRef.current && currentUserId) {
        // Marcar como offline usando fetch com keepalive
        fetch(`https://uxcsfevgygrzrmxhenth.supabase.co/rest/v1/users?id=eq.${currentUserId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4Y3NmZXZneWdyenJteGhlbnRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIwNDU4ODEsImV4cCI6MjA3NzYyMTg4MX0.pG3_eMj1ZhrAikrln9Phz_Y9fSat9bjFrdrf_T-UxNM',
            'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4Y3NmZXZneWdyenJteGhlbnRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIwNDU4ODEsImV4cCI6MjA3NzYyMTg4MX0.pG3_eMj1ZhrAikrln9Phz_Y9fSat9bjFrdrf_T-UxNM',
          },
          body: JSON.stringify({
            is_online: false,
            last_seen: new Date().toISOString(),
          }),
          keepalive: true // Garante que a requisição continue mesmo se a página for fechada
        }).catch(error => console.error('Failed to update offline status:', error));
        
        isOnlineRef.current = false;
      }
    };

    const handlePageHide = (e: PageTransitionEvent) => {
      console.log('Page hide event triggered');
      if (isOnlineRef.current && currentUserId) {
        // Usar fetch com keepalive para pageHide também
        fetch(`https://uxcsfevgygrzrmxhenth.supabase.co/rest/v1/users?id=eq.${currentUserId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4Y3NmZXZneWdyenJteGhlbnRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIwNDU4ODEsImV4cCI6MjA3NzYyMTg4MX0.pG3_eMj1ZhrAikrln9Phz_Y9fSat9bjFrdrf_T-UxNM',
            'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4Y3NmZXZneWdyenJteGhlbnRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIwNDU4ODEsImV4cCI6MjA3NzYyMTg4MX0.pG3_eMj1ZhrAikrln9Phz_Y9fSat9bjFrdrf_T-UxNM',
          },
          body: JSON.stringify({
            is_online: false,
            last_seen: new Date().toISOString(),
          }),
          keepalive: true
        }).catch(error => console.error('Failed to update offline status:', error));
        
        isOnlineRef.current = false;
      }
    };

    // Detectar quando a janela perde o foco por muito tempo
    const handleWindowBlur = () => {
      setTimeout(() => {
        if (document.hidden && isOnlineRef.current) {
          console.log('Window has been hidden for too long, marking offline');
          updateOnlineStatus(false);
          isOnlineRef.current = false;
        }
      }, 10000); // 10 segundos
    };

    // Iniciar heartbeat se a página está visível
    if (!document.hidden) {
      startHeartbeat();
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('blur', handleWindowBlur);
      stopHeartbeat();
    };
  }, [currentUserId]);

  // Subscription para monitorar status online de outros usuários
  useEffect(() => {
    if (!currentUserId) return;

    console.log('Setting up online status subscription');

    channelRef.current = supabase
      .channel('online-users')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'users',
      }, (payload) => {
        console.log('Online status payload:', payload);
        
        const userData = payload.new as User;
        const userId = userData?.id;
        
        if (!userId || userId === currentUserId) return;

        setOnlineUsers(prev => {
          const newSet = new Set(prev);
          
          if (payload.eventType === 'DELETE') {
            newSet.delete(userId);
          } else if (userData?.is_online) {
            newSet.add(userId);
          } else {
            newSet.delete(userId);
          }
          
          return newSet;
        });
      })
      .subscribe((status) => {
        console.log('Online status subscription:', status);
      });

    // Buscar usuários online atuais na inicialização
    fetchOnlineUsers();

    return () => {
      if (channelRef.current) {
        channelRef.current.unsubscribe();
      }
    };
  }, [currentUserId]);

  // Função para verificar se um usuário está online
  const isUserOnline = (userId: string) => {
    return onlineUsers.has(userId);
  };

  // Função para obter informações de último acesso
  const getLastSeenInfo = async (userId: string) => {
    try {
      const { data, error } = await supabase.rpc('get_user_last_seen_info', {
        user_id: userId
      });

      if (error) {
        console.error('Error getting last seen info:', error);
        return null;
      }

      return data?.[0] || null;
    } catch (error) {
      console.error('Error getting last seen info:', error);
      return null;
    }
  };

  // Função para forçar atualização do status
  const refreshOnlineStatus = () => {
    if (currentUserId && !document.hidden) {
      updateOnlineStatus(true);
    }
  };

  return {
    onlineUsers: Array.from(onlineUsers),
    isUserOnline,
    getLastSeenInfo,
    refreshOnlineStatus,
  };
};