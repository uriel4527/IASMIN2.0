import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Activity, User } from 'lucide-react';
import { 
  startMessageMonitoring, 
  stopMessageMonitoring, 
  getMonitoringStatus,
  setPollingInterval 
} from '@/services/MessageMonitor';
import { messageMonitor } from '@/services/MessageMonitor';

// Dados fixos dos usuários (igual ao AuthContext)
const USERS = {
  Sr: {
    id: '11111111-1111-1111-1111-111111111111',
    email: 'sr@chat.com',
    username: 'Sr',
    created_at: new Date().toISOString(),
    last_seen: new Date().toISOString(),
    is_online: true,
  },
  Iasm: {
    id: '22222222-2222-2222-2222-222222222222',
    email: 'iasm@chat.com',
    username: 'Iasm',
    created_at: new Date().toISOString(),
    last_seen: new Date().toISOString(),
    is_online: true,
  }
};

export const MonitoringControl: React.FC = () => {
  const [isSelectingUser, setIsSelectingUser] = useState(false);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [status, setStatus] = useState<any>(null);
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isWaitingForLogin, setIsWaitingForLogin] = useState(true);
  const [monitoredUser, setMonitoredUser] = useState<string>('');

  // Verificação contínua de login
  useEffect(() => {
    const loginCheckInterval = setInterval(() => {
      const storedUser = localStorage.getItem('chatapp_user');
      
      if (storedUser && !currentUser) {
        try {
          const userData = JSON.parse(storedUser);
          setCurrentUser(userData);
          setIsWaitingForLogin(false);
          
          // Definir usuário monitorado (o oposto)
          const opposite = userData.username === 'Sr' ? 'Iasm' : 'Sr';
          setMonitoredUser(opposite);
          
          // Configurar usuário atual no monitor
          messageMonitor.setCurrentUser(userData.id);
          
          // Configurar intervalo de 5s e iniciar
          setPollingInterval(5000);
          startMessageMonitoring();
          
          console.log(`✅ Usuário detectado: ${userData.username}`);
          console.log(`🎵 Monitoramento iniciado para mensagens de: ${opposite}`);
        } catch (error) {
          console.error('Erro ao processar usuário:', error);
        }
      } else if (!storedUser && currentUser) {
        // Logout detectado
        setCurrentUser(null);
        setIsWaitingForLogin(true);
        stopMessageMonitoring();
      }
    }, 2000); // Verifica a cada 2 segundos
    
    return () => clearInterval(loginCheckInterval);
  }, [currentUser]);

  // Atualizar status a cada segundo
  useEffect(() => {
    if (!isWaitingForLogin) {
      const statusInterval = setInterval(() => {
        const currentStatus = getMonitoringStatus();
        setStatus(currentStatus);
        setIsMonitoring(currentStatus.isRunning);
        setLastUpdate(new Date().toLocaleTimeString());
      }, 1000);

      return () => clearInterval(statusInterval);
    }
  }, [isWaitingForLogin]);

  const handleIntervalChange = (newInterval: number) => {
    setPollingInterval(newInterval * 1000); // converter segundos para ms
  };

  const handleUserSelect = async (username: 'Sr' | 'Iasm') => {
    setIsSelectingUser(true);
    try {
      const userData = USERS[username];
      
      // Salvar no localStorage (como se fosse login)
      localStorage.setItem('chatapp_user', JSON.stringify(userData));
      localStorage.setItem('chatapp_user_timestamp', new Date().toISOString());
      localStorage.setItem('chatapp_preferred_user', username);
      
      // Aplicar configurações
      setCurrentUser(userData);
      setIsWaitingForLogin(false);
      
      const opposite = username === 'Sr' ? 'Iasm' : 'Sr';
      setMonitoredUser(opposite);
      
      messageMonitor.setCurrentUser(userData.id);
      setPollingInterval(5000);
      startMessageMonitoring();
      
      console.log(`✅ Usuário selecionado: ${username}`);
      console.log(`🎵 Monitoramento iniciado para mensagens de: ${opposite}`);
    } catch (error) {
      console.error('Erro ao selecionar usuário:', error);
    } finally {
      setIsSelectingUser(false);
    }
  };

  // Estado de aguardando login
  if (isWaitingForLogin) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Sistema de Monitoramento de Mensagens
          </CardTitle>
          <CardDescription>
            Aguardando autenticação para iniciar monitoramento
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <div className="py-8 space-y-6">
            <div className="text-center space-y-2">
              <User className="h-12 w-12 mx-auto text-muted-foreground" />
              <h3 className="text-xl font-semibold">
                Selecione seu usuário
              </h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                Escolha quem você é para iniciar o monitoramento automático de mensagens
              </p>
            </div>
            
            <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
              <Button
                size="lg"
                onClick={() => handleUserSelect('Sr')}
                disabled={isSelectingUser}
                className="h-24 flex-col gap-2 bg-blue-600 hover:bg-blue-700"
              >
                <User className="h-8 w-8" />
                <span className="text-lg font-semibold">Sr</span>
              </Button>
              
              <Button
                size="lg"
                onClick={() => handleUserSelect('Iasm')}
                disabled={isSelectingUser}
                className="h-24 flex-col gap-2 bg-pink-600 hover:bg-pink-700"
              >
                <User className="h-8 w-8" />
                <span className="text-lg font-semibold">Iasm</span>
              </Button>
            </div>

            <div className="bg-muted/50 p-4 rounded-lg max-w-md mx-auto">
              <p className="text-xs text-muted-foreground">
                ℹ️ Ao selecionar, o monitoramento iniciará automaticamente e você receberá notificações sonoras para mensagens do outro usuário.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Sistema de Monitoramento de Mensagens
        </CardTitle>
        <CardDescription>
          Monitoramento ativo para mensagens de {monitoredUser}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Informações do Usuário */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <span className="text-sm font-medium text-muted-foreground">Você está logado como:</span>
            <Badge variant="default" className={currentUser?.username === 'Sr' ? 'bg-blue-600' : 'bg-pink-600'}>
              👤 {currentUser?.username}
            </Badge>
          </div>
          <div className="space-y-2">
            <span className="text-sm font-medium text-muted-foreground">Monitorando mensagens de:</span>
            <Badge variant="outline" className={monitoredUser === 'Sr' ? 'border-blue-600 text-blue-600' : 'border-pink-600 text-pink-600'}>
              🔔 {monitoredUser}
            </Badge>
          </div>
        </div>

        <Separator />

        {/* Status do Sistema */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant={isMonitoring ? "default" : "secondary"}>
              {isMonitoring ? "Monitoramento Ativo" : "Inativo"}
            </Badge>
          </div>
          <span className="text-xs text-muted-foreground">
            Última atualização: {lastUpdate}
          </span>
        </div>

        <Separator />

        {/* Informações do Status */}
        {status && (
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">Intervalo de verificação:</span>
              <p className="text-muted-foreground">{status.pollInterval / 1000}s</p>
            </div>
            <div>
              <span className="font-medium">Última verificação:</span>
              <p className="text-muted-foreground">
                {new Date(status.lastCheckTimestamp).toLocaleTimeString()}
              </p>
            </div>
            <div>
              <span className="font-medium">Usuários monitorados:</span>
              <p className="text-muted-foreground">{status.totalUsers} (Sr, Iasm)</p>
            </div>
            <div>
              <span className="font-medium">Status:</span>
              <p className="text-muted-foreground">
                {isMonitoring ? "Monitorando ativamente" : "Pausado"}
              </p>
            </div>
          </div>
        )}

        <Separator />

        {/* Configurações de Intervalo */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium">Intervalo de Verificação</h4>
          <div className="flex items-center gap-2 flex-wrap">
            {[5, 10, 15, 30].map((seconds) => (
              <Button
                key={seconds}
                variant={status?.pollInterval === seconds * 1000 ? "default" : "outline"}
                size="sm"
                onClick={() => handleIntervalChange(seconds)}
                className="text-xs"
              >
                {seconds}s
              </Button>
            ))}
          </div>
        </div>

        <Separator />

        {/* Configurações de Som */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium">Configurações de Efeitos Sonoros</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="space-y-1">
              <span className="font-medium text-blue-600">👨 Sr</span>
              <p className="text-muted-foreground">Tom grave (800Hz)</p>
            </div>
            <div className="space-y-1">
              <span className="font-medium text-pink-600">👩 Iasm</span>
              <p className="text-muted-foreground">Tom agudo (1200Hz)</p>
            </div>
          </div>
        </div>

        {/* Informações Importantes */}
        <div className="bg-muted/50 p-4 rounded-lg">
          <h4 className="text-sm font-medium mb-2">ℹ️ Como funciona:</h4>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>• Monitoramento inicia automaticamente ao detectar login</li>
            <li>• Verifica novas mensagens a cada 5 segundos (padrão)</li>
            <li>• Reproduz som apenas para mensagens do usuário oposto</li>
            <li>• Sons são gerados localmente usando Web Audio API</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};