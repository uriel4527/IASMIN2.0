import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

const b64ToUint8 = (base64: string) => {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const base64Safe = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64Safe);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
};

const Push: React.FC = () => {
  const [ready, setReady] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    const init = async () => {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        setStatus('Push não suportado');
        return;
      }
      let registration: ServiceWorkerRegistration | null = null;
      try {
        registration = await navigator.serviceWorker.ready;
      } catch {
        registration = await navigator.serviceWorker.register('/sw.js');
      }
      setReady(!!registration);
      const sub = await registration.pushManager.getSubscription();
      setSubscribed(!!sub);
      // Reenviar a subscription existente ao servidor (memória) quando a página abre
      if (sub) {
        try {
          await fetch('/api/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(sub)
          });
        } catch (e) {
          console.error('Falha ao re-registrar subscription:', e);
        }
      }
    };
    init();
  }, []);

  const requestPermission = async () => {
    const r = await Notification.requestPermission();
    return r === 'granted';
  };

  const subscribe = async () => {
    setStatus('');
    const granted = await requestPermission();
    if (!granted) {
      setStatus('Permissão negada');
      return;
    }
    const registration = await navigator.serviceWorker.ready;
    const key = import.meta.env.VITE_VAPID_PUBLIC_KEY as string;
    const sub = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: b64ToUint8(key)
    });
    await fetch('/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sub)
    });
    setSubscribed(true);
    setStatus('Dispositivo registrado');
  };

  const sendAll = async () => {
    setStatus('');
    const res = await fetch('/api/send-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Notificação', body: 'Iasmin', url: '/chat' })
    });
    const data = await res.json();
    setStatus(`Enviadas: ${data.sent}, falhas: ${data.failed}`);
  };

  return (
    <div className="flex h-screen-fixed items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        <h1 className="text-xl font-semibold">Push</h1>
        <p className="text-sm text-muted-foreground">Status: {status || (ready ? 'Pronto' : 'Aguardando SW')}</p>
        <div className="flex gap-2">
          <Button onClick={subscribe} disabled={!ready || subscribed}>Ativar Notificações</Button>
          <Button onClick={sendAll} variant="outline">Enviar Notificação</Button>
        </div>
      </div>
    </div>
  );
};

export default Push;
