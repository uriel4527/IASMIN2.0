import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/hooks/useNotifications';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bell, BellOff, RefreshCw, Send, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';

const VAPID_PUBLIC_KEY = 'BNCiMZRUNS9EXK67XmH0L0IuBvX_-59N3UTl2JVupiDz5Wr5GiIJHdrJxvTc5qrXZQrBdWnXzjGuYFUyLHkbmvU';

export default function PushDebug() {
  const { user } = useAuth();
  const { permission, requestPermission, registerPushSubscription, getPushSubscription } = useNotifications();
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [dbSubscription, setDbSubscription] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [debugInfo, setDebugInfo] = useState({
    isHTTPS: window.location.protocol === 'https:',
    hasServiceWorker: 'serviceWorker' in navigator,
    hasNotificationAPI: 'Notification' in window,
    hasPushManager: 'PushManager' in window,
    userAgent: navigator.userAgent
  });

  useEffect(() => {
    loadSubscriptionStatus();
  }, [user]);

  const loadSubscriptionStatus = async () => {
    if (!user) return;
    
    // Get browser subscription
    const sub = await getPushSubscription();
    setSubscription(sub);
    
    // Get database subscription
    const { data } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .single();
    
    setDbSubscription(data);
  };

  const handleEnableNotifications = async () => {
    setLoading(true);
    try {
      console.log('🚀 Iniciando ativação de notificações...');
      
      // Request permission
      console.log('📋 Solicitando permissão...');
      const granted = await requestPermission();
      if (!granted) {
        console.error('❌ Permissão negada pelo usuário');
        toast.error('Permissão negada');
        return;
      }
      console.log('✅ Permissão concedida');

      // Register push subscription (now includes backend registration)
      console.log('📝 Registrando subscription (navegador + backend)...');
      const registered = await registerPushSubscription(VAPID_PUBLIC_KEY, user?.id);
      if (!registered) {
        console.error('❌ Falha ao registrar subscription');
        toast.error('Erro ao registrar subscription');
        return;
      }
      console.log('✅ Subscription registrada com sucesso');

      toast.success('Notificações push ativadas!');
      await loadSubscriptionStatus();
      console.log('✅ Status atualizado');
    } catch (error) {
      console.error('❌ Erro no processo:', error);
      if (error instanceof Error) {
        console.error('Detalhes:', error.message);
      }
      toast.error('Erro ao ativar notificações: ' + (error instanceof Error ? error.message : 'Erro desconhecido'));
    } finally {
      setLoading(false);
    }
  };

  const handleDisableNotifications = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke('push-notification/unregister', {
        body: { userId: user?.id }
      });

      if (error) throw error;

      toast.success('Notificações push desativadas');
      await loadSubscriptionStatus();
    } catch (error) {
      console.error('Error:', error);
      toast.error('Erro ao desativar notificações');
    } finally {
      setLoading(false);
    }
  };

  const handleSendTestNotification = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke('push-notification/send', {
        body: {
          recipientId: user.id,
          senderName: 'Sistema de Teste',
          messageContent: 'Esta é uma notificação de teste! 🔔',
          messageId: 'test-' + Date.now()
        }
      });

      if (error) throw error;

      toast.success('Notificação de teste enviada!');
    } catch (error) {
      console.error('Error:', error);
      toast.error('Erro ao enviar notificação de teste');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="container max-w-4xl mx-auto p-8">
        <Card>
          <CardHeader>
            <CardTitle>Push Notifications Debug</CardTitle>
            <CardDescription>Faça login para ver o status das notificações</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-y-auto">
      <div className="container max-w-4xl mx-auto p-4 md:p-8 space-y-6 pb-20">
        <div className="flex items-center gap-4">
        <Link to="/chat">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Push Notifications Debug</h1>
          <p className="text-muted-foreground">Visualize e teste o status das notificações push</p>
        </div>
      </div>

      {/* Permission Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Status de Permissão
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="font-medium">HTTPS:</span>
            <Badge variant={debugInfo.isHTTPS ? 'default' : 'destructive'}>
              {debugInfo.isHTTPS ? 'Sim' : 'Não (necessário)'}
            </Badge>
          </div>

          <div className="flex items-center justify-between">
            <span className="font-medium">Service Worker:</span>
            <Badge variant={debugInfo.hasServiceWorker ? 'default' : 'destructive'}>
              {debugInfo.hasServiceWorker ? 'Suportado' : 'Não suportado'}
            </Badge>
          </div>

          <div className="flex items-center justify-between">
            <span className="font-medium">Notification API:</span>
            <Badge variant={debugInfo.hasNotificationAPI ? 'default' : 'destructive'}>
              {debugInfo.hasNotificationAPI ? 'Suportado' : 'Não suportado'}
            </Badge>
          </div>

          <div className="flex items-center justify-between">
            <span className="font-medium">Push Manager:</span>
            <Badge variant={debugInfo.hasPushManager ? 'default' : 'destructive'}>
              {debugInfo.hasPushManager ? 'Suportado' : 'Não suportado'}
            </Badge>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="font-medium">Permissão do navegador:</span>
            <Badge variant={permission === 'granted' ? 'default' : permission === 'denied' ? 'destructive' : 'secondary'}>
              {permission}
            </Badge>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="font-medium">Subscription do navegador:</span>
            <Badge variant={subscription ? 'default' : 'secondary'}>
              {subscription ? 'Ativa' : 'Inativa'}
            </Badge>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="font-medium">Subscription no banco:</span>
            <Badge variant={dbSubscription?.is_active ? 'default' : 'secondary'}>
              {dbSubscription?.is_active ? 'Ativa' : 'Inativa'}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Ações</CardTitle>
          <CardDescription>Gerenciar notificações push</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {(!subscription || !dbSubscription?.is_active) && (
            <Button 
              onClick={handleEnableNotifications} 
              disabled={loading}
              className="w-full"
            >
              <Bell className="h-4 w-4 mr-2" />
              Ativar Notificações Push
            </Button>
          )}
          
          {subscription && dbSubscription?.is_active && (
            <Button 
              onClick={handleDisableNotifications} 
              disabled={loading}
              variant="secondary"
              className="w-full"
            >
              <BellOff className="h-4 w-4 mr-2" />
              Desativar Notificações Push
            </Button>
          )}

          <Button 
            onClick={loadSubscriptionStatus} 
            disabled={loading}
            variant="outline"
            className="w-full"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar Status
          </Button>

          {dbSubscription?.is_active && (
            <Button 
              onClick={handleSendTestNotification} 
              disabled={loading}
              variant="default"
              className="w-full"
            >
              <Send className="h-4 w-4 mr-2" />
              Enviar Notificação de Teste
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Subscription Details */}
      {subscription && (
        <Card>
          <CardHeader>
            <CardTitle>Detalhes da Subscription</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 font-mono text-xs break-all">
              <div>
                <span className="font-semibold">Endpoint:</span>
                <p className="text-muted-foreground">{subscription.endpoint}</p>
              </div>
              {dbSubscription && (
                <>
                  <div>
                    <span className="font-semibold">Criada em:</span>
                    <p className="text-muted-foreground">
                      {new Date(dbSubscription.created_at).toLocaleString('pt-BR')}
                    </p>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Test Cases */}
      <Card>
        <CardHeader>
          <CardTitle>Casos de Teste</CardTitle>
          <CardDescription>Checklist para validar o sistema</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            <li>✅ Permissão concedida pelo navegador</li>
            <li>✅ Subscription registrada no banco</li>
            <li>📱 Enviar mensagem com app fechado</li>
            <li>📱 Clicar na notificação abre o chat</li>
            <li>📱 Notificação NÃO aparece quando app está aberto</li>
            <li>📱 Múltiplas mensagens funcionam corretamente</li>
            <li>📱 Notificações funcionam após logout/login</li>
          </ul>
        </CardContent>
      </Card>

      {/* Troubleshooting */}
      <Card>
        <CardHeader>
          <CardTitle>Solução de Problemas</CardTitle>
          <CardDescription>Como resolver problemas comuns</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 text-sm">
            {!debugInfo.isHTTPS && (
              <div className="p-3 bg-destructive/10 rounded-md">
                <p className="font-semibold">❌ HTTPS necessário</p>
                <p className="text-muted-foreground">Push notifications só funcionam em HTTPS. Use localhost para desenvolvimento.</p>
              </div>
            )}
            
            {permission === 'denied' && (
              <div className="p-3 bg-destructive/10 rounded-md">
                <p className="font-semibold">❌ Permissão negada</p>
                <p className="text-muted-foreground">
                  Você negou a permissão de notificações. Para reativar:
                  <br />• Chrome: Clique no ícone de cadeado na barra de URL → Configurações do site → Notificações → Permitir
                  <br />• Firefox: Clique no ícone de cadeado → Limpar permissões → Recarregue a página
                </p>
              </div>
            )}

            {(!debugInfo.hasServiceWorker || !debugInfo.hasNotificationAPI || !debugInfo.hasPushManager) && (
              <div className="p-3 bg-destructive/10 rounded-md">
                <p className="font-semibold">❌ Navegador incompatível</p>
                <p className="text-muted-foreground">
                  Seu navegador não suporta push notifications. Use Chrome, Firefox, Edge ou Safari (iOS 16.4+).
                </p>
              </div>
            )}

            {debugInfo.isHTTPS && permission === 'granted' && subscription && !dbSubscription?.is_active && (
              <div className="p-3 bg-yellow-500/10 rounded-md">
                <p className="font-semibold">⚠️ Subscription não registrada no banco</p>
                <p className="text-muted-foreground">
                  A subscription do navegador existe mas não foi salva no banco. Clique em "Atualizar Status" ou "Ativar Notificações Push".
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
