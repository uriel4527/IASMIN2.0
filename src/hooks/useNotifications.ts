import { useState, useEffect } from 'react';
import { toast } from 'sonner';

interface ExtendedNotificationOptions extends NotificationOptions {
  vibrate?: number[];
  renotify?: boolean;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
}

export const useNotifications = () => {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    // Get current permission status
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }

    // Get service worker registration
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((reg) => {
        setRegistration(reg);
      });
    }
  }, []);

  const requestPermission = async (): Promise<boolean> => {
    if (!('Notification' in window)) {
      console.log('Este navegador não suporta notificações');
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      
      if (result === 'granted') {
        toast.success('Notificações ativadas!');
        return true;
      } else {
        toast.error('Permissão para notificações negada');
        return false;
      }
    } catch (error) {
      console.error('Erro ao solicitar permissão para notificações:', error);
      return false;
    }
  };

  const showNotification = (title: string, options?: ExtendedNotificationOptions) => {
    if (permission !== 'granted') {
      console.log('Permissão para notificações não concedida');
      return;
    }

    const defaultOptions: ExtendedNotificationOptions = {
      icon: '/icons/icon-192x192.png',
      badge: '/icons/favicon-32x32.png',
      vibrate: [100, 50, 100],
      ...options,
    };

    if (registration && registration.showNotification) {
      // Use service worker notification (better for PWAs)
      registration.showNotification(title, defaultOptions);
    } else {
      // Fallback to regular notification
      new Notification(title, defaultOptions);
    }
  };

  const showMessageNotification = (sender: string, message: string) => {
    showNotification(`Nova mensagem de ${sender}`, {
      body: message,
      tag: 'message',
      renotify: true,
      actions: [
        {
          action: 'reply',
          title: 'Responder',
          icon: '/icons/icon-192x192.png'
        },
        {
          action: 'mark-read',
          title: 'Marcar como lida',
          icon: '/icons/favicon-32x32.png'
        }
      ]
    });
  };

  const showWelcomeNotification = () => {
    showNotification('Bem-vindo ao ChatApp!', {
      body: 'Você receberá notificações de novas mensagens',
      tag: 'welcome',
      actions: [
        {
          action: 'start-chat',
          title: 'Começar a conversar',
          icon: '/icons/icon-192x192.png'
        }
      ]
    });
  };

  const scheduleNotificationInServiceWorker = async (
    title: string,
    options: ExtendedNotificationOptions,
    delayMs: number
  ): Promise<boolean> => {
    if (!registration) {
      console.error('Service Worker não está registrado');
      return false;
    }

    if (permission !== 'granted') {
      console.error('Permissão para notificações não concedida');
      return false;
    }

    try {
      // Create a message channel for response
      const messageChannel = new MessageChannel();
      
      // Wait for response from service worker
      const response = await new Promise<boolean>((resolve) => {
        messageChannel.port1.onmessage = (event) => {
          resolve(event.data.success);
        };
        
        // Send message to service worker
        registration.active?.postMessage(
          {
            type: 'SCHEDULE_NOTIFICATION',
            id: `notif-${Date.now()}`,
            title,
            options,
            delay: delayMs
          },
          [messageChannel.port2]
        );
        
        // Timeout after 5 seconds
        setTimeout(() => resolve(false), 5000);
      });
      
      return response;
    } catch (error) {
      console.error('Erro ao agendar notificação no Service Worker:', error);
      return false;
    }
  };

  const registerPushSubscription = async (
    vapidPublicKey: string, 
    userId?: string
  ): Promise<boolean> => {
    if (!registration || permission !== 'granted') {
      console.error('❌ Service Worker ou permissão não disponível');
      return false;
    }
    
    try {
      console.log('🔄 Iniciando registro de push subscription...');
      
      // Get existing subscription or create new
      let subscription = await registration.pushManager.getSubscription();
      
      if (!subscription) {
        console.log('📝 Criando nova push subscription no navegador...');
        const convertedKey = urlBase64ToUint8Array(vapidPublicKey);
        
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedKey as BufferSource
        });
        console.log('✅ Push subscription criada no navegador:', {
          endpoint: subscription.endpoint.substring(0, 50) + '...'
        });
      } else {
        console.log('✅ Usando subscription existente no navegador');
      }

      // If userId is provided, also register in backend
      if (userId) {
        console.log('📤 Enviando subscription para o backend...');
        const { createClient } = await import('@supabase/supabase-js');
        const supabaseUrl = 'https://uxcsfevgygrzrmxhenth.supabase.co';
        const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4Y3NmZXZneWdyenJteGhlbnRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIwNDU4ODEsImV4cCI6MjA3NzYyMTg4MX0.pG3_eMj1ZhrAikrln9Phz_Y9fSat9bjFrdrf_T-UxNM';
        const supabase = createClient(supabaseUrl, supabaseKey);

        const subscriptionData = subscription.toJSON();
        console.log('📋 Subscription data:', {
          endpoint: subscriptionData.endpoint?.substring(0, 50) + '...',
          hasKeys: !!subscriptionData.keys
        });

        const { data, error } = await supabase.functions.invoke('push-notification/register', {
          body: {
            userId,
            subscription: subscriptionData
          }
        });

        if (error) {
          console.error('❌ Erro ao registrar no backend:', error);
          throw error;
        }

        console.log('✅ Subscription registrada no backend com sucesso!', data);
      }
      
      return true;
    } catch (error) {
      console.error('❌ Erro no processo de registro:', error);
      if (error instanceof Error) {
        console.error('Detalhes do erro:', error.message, error.stack);
      }
      toast.error('Erro ao ativar notificações push: ' + (error instanceof Error ? error.message : 'Erro desconhecido'));
      return false;
    }
  };

  const getPushSubscription = async (): Promise<PushSubscription | null> => {
    if (!registration) return null;
    try {
      return await registration.pushManager.getSubscription();
    } catch (error) {
      console.error('Error getting push subscription:', error);
      return null;
    }
  };

  return {
    permission,
    requestPermission,
    showNotification,
    showMessageNotification,
    showWelcomeNotification,
    scheduleNotificationInServiceWorker,
    registerPushSubscription,
    getPushSubscription,
    isSupported: 'Notification' in window
  };
}

// Helper to convert VAPID key from base64 to Uint8Array
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');
  
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}