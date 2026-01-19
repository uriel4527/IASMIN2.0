import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useNotifications } from '@/hooks/useNotifications';
import { toast } from 'sonner';
import { Bell, Clock } from 'lucide-react';

const TestPushNotification = () => {
  const { permission, requestPermission, scheduleNotificationInServiceWorker, isSupported } = useNotifications();
  const [isScheduled, setIsScheduled] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  const scheduleNotification = async () => {
    // Request permission if not granted
    if (permission !== 'granted') {
      const granted = await requestPermission();
      if (!granted) {
        toast.error('Permissão de notificação negada');
        return;
      }
    }

    // Schedule notification for 10 seconds via Service Worker
    setIsScheduled(true);
    setCountdown(10);
    toast.success('Notificação agendada para 10 segundos via Service Worker!');

    // Countdown timer (only visual)
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          setIsScheduled(false);
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    // Schedule notification in Service Worker (works even if app is closed)
    const success = await scheduleNotificationInServiceWorker(
      'Teste de Notificação Push',
      {
        body: 'Esta notificação foi agendada via Service Worker e funciona mesmo com o app fechado!',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/favicon-32x32.png',
        vibrate: [200, 100, 200],
        tag: 'test-notification',
        requireInteraction: true,
      },
      10000 // 10 seconds
    );

    if (!success) {
      toast.error('Erro ao agendar notificação no Service Worker');
      clearInterval(interval);
      setIsScheduled(false);
      setCountdown(null);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6 flex items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-6 w-6" />
            Test Push Notification
          </CardTitle>
          <CardDescription>
            Teste o sistema de notificações push do PWA
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {!isSupported ? (
            <div className="text-center p-4 bg-destructive/10 rounded-lg">
              <p className="text-destructive">
                Notificações não são suportadas neste navegador
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <span className="text-sm font-medium">Status da Permissão:</span>
                  <span className={`text-sm font-bold ${
                    permission === 'granted' ? 'text-green-500' : 
                    permission === 'denied' ? 'text-destructive' : 
                    'text-yellow-500'
                  }`}>
                    {permission === 'granted' ? 'Concedida' : 
                     permission === 'denied' ? 'Negada' : 
                     'Não solicitada'}
                  </span>
                </div>
              </div>

              {countdown !== null && (
                <div className="text-center p-6 bg-primary/10 rounded-lg animate-pulse">
                  <Clock className="h-12 w-12 mx-auto mb-2 text-primary" />
                  <p className="text-2xl font-bold text-primary">{countdown}s</p>
                  <p className="text-sm text-muted-foreground">
                    Notificação será enviada em breve...
                  </p>
                </div>
              )}

              <Button
                onClick={scheduleNotification}
                disabled={isScheduled || !isSupported}
                className="w-full"
                size="lg"
              >
                {isScheduled ? 'Aguardando...' : 'Agendar Notificação (10s)'}
              </Button>

              <div className="text-xs text-muted-foreground space-y-1">
                <p>• A notificação será exibida após 10 segundos</p>
                <p>• Agendada via Service Worker - funciona com app fechado!</p>
                <p>• Certifique-se de conceder permissão quando solicitado</p>
                <p>• Funciona melhor em dispositivos móveis instalados como PWA</p>
                <p>• Pode fechar o app e a notificação ainda aparecerá</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TestPushNotification;
