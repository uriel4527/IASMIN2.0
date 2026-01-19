import { supabase, Message, User } from '@/lib/supabase';

interface MonitorConfig {
  pollInterval: number; // em milissegundos
  lastCheckTimestamp: string;
  isRunning: boolean;
}

interface SoundEffect {
  userId: string;
  username: string;
  audioUrl?: string;
  frequency?: number; // para beeps simples
  duration?: number;
}

class MessageMonitor {
  private config: MonitorConfig = {
    pollInterval: 5000, // 5 segundos
    lastCheckTimestamp: new Date().toISOString(),
    isRunning: false
  };

  private intervalId: NodeJS.Timeout | null = null;
  private audioContext: AudioContext | null = null;
  private currentUserId: string | null = null;

  // IDs dos usuários conforme definido no AuthContext
  private readonly userIds = {
    Sr: '11111111-1111-1111-1111-111111111111',
    Iasm: '22222222-2222-2222-2222-222222222222'
  };

  // Configurações de som para cada usuário
  private readonly soundEffects: Record<string, SoundEffect> = {
    [this.userIds.Sr]: {
      userId: this.userIds.Sr,
      username: 'Sr',
      frequency: 800, // Tom mais grave para Sr
      duration: 300
    },
    [this.userIds.Iasm]: {
      userId: this.userIds.Iasm,
      username: 'Iasm',
      frequency: 1200, // Tom mais agudo para Iasm
      duration: 300
    }
  };

  constructor() {
    this.initializeAudioContext();
  }

  private initializeAudioContext(): void {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (error) {
      console.error('Erro ao inicializar AudioContext:', error);
    }
  }

  async startMonitoring(): Promise<void> {
    if (this.config.isRunning) {
      console.log('Monitoramento já está em execução');
      return;
    }

    console.log('🎵 Iniciando monitoramento de mensagens...');
    this.config.isRunning = true;
    this.config.lastCheckTimestamp = new Date().toISOString();

    // Primeira verificação imediata
    await this.checkForNewMessages();

    // Configurar polling a cada 10 segundos
    this.intervalId = setInterval(async () => {
      await this.checkForNewMessages();
    }, this.config.pollInterval);
  }

  stopMonitoring(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.config.isRunning = false;
    console.log('🔇 Monitoramento de mensagens parado');
  }

  private async checkForNewMessages(): Promise<void> {
    try {
      // Buscar mensagens mais recentes que o último timestamp verificado
      const { data: newMessages, error } = await supabase
        .from('messages')
        .select(`
          *,
          sender:sender_id (
            id,
            username,
            email
          )
        `)
        .gt('created_at', this.config.lastCheckTimestamp)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Erro ao buscar mensagens:', error);
        return;
      }

      if (newMessages && newMessages.length > 0) {
        console.log(`📬 ${newMessages.length} nova(s) mensagem(ns) detectada(s)`);
        
        // Processar cada mensagem nova
        for (const message of newMessages) {
          await this.processNewMessage(message);
        }

        // Atualizar timestamp da última verificação
        this.config.lastCheckTimestamp = newMessages[newMessages.length - 1].created_at;
      }
    } catch (error) {
      console.error('Erro no monitoramento de mensagens:', error);
    }
  }

  private async processNewMessage(message: Message): Promise<void> {
    const senderId = message.sender_id;
    
    // Filtrar mensagens do próprio usuário
    if (senderId === this.currentUserId) {
      console.log('💬 Mensagem própria detectada - som não reproduzido');
      return;
    }
    
    const senderInfo = this.getSenderInfo(senderId);
    
    if (!senderInfo) {
      console.log('Remetente desconhecido:', senderId);
      return;
    }

    console.log(`🔔 Nova mensagem de ${senderInfo.username}: "${message.content}"`);
    
    // Reproduzir efeito sonoro específico do usuário
    await this.playUserSound(senderId);
    
    // Log adicional para debug
    console.log(`🎵 Som reproduzido para ${senderInfo.username}`);
  }

  private getSenderInfo(senderId: string): { username: string; userId: string } | null {
    if (senderId === this.userIds.Sr) {
      return { username: 'Sr', userId: senderId };
    } else if (senderId === this.userIds.Iasm) {
      return { username: 'Iasm', userId: senderId };
    }
    return null;
  }

  private async playUserSound(userId: string): Promise<void> {
    const soundConfig = this.soundEffects[userId];
    if (!soundConfig || !this.audioContext) {
      console.error('Configuração de som não encontrada ou AudioContext indisponível');
      return;
    }

    try {
      // Criar oscilador para gerar o beep
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();

      // Conectar oscilador -> ganho -> destino
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      // Configurar frequência específica do usuário
      oscillator.frequency.value = soundConfig.frequency || 1000;
      oscillator.type = 'sine';

      // Configurar envelope de volume (fade in/out)
      const now = this.audioContext.currentTime;
      const duration = (soundConfig.duration || 300) / 1000; // converter para segundos

      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(0.3, now + 0.01); // fade in rápido
      gainNode.gain.linearRampToValueAtTime(0.3, now + duration - 0.05); // sustain
      gainNode.gain.linearRampToValueAtTime(0, now + duration); // fade out

      // Tocar o som
      oscillator.start(now);
      oscillator.stop(now + duration);

    } catch (error) {
      console.error('Erro ao reproduzir som:', error);
    }
  }

  // Método para obter status do monitoramento
  getStatus(): MonitorConfig & { totalUsers: number } {
    return {
      ...this.config,
      totalUsers: Object.keys(this.userIds).length
    };
  }

  // Método para configurar intervalo de polling
  setPollInterval(intervalMs: number): void {
    this.config.pollInterval = Math.max(1000, intervalMs); // mínimo 1 segundo
    
    if (this.config.isRunning) {
      // Reiniciar com novo intervalo
      this.stopMonitoring();
      this.startMonitoring();
    }
  }

  // Método para definir o usuário atual
  setCurrentUser(userId: string): void {
    this.currentUserId = userId;
    console.log(`👤 Usuário atual definido: ${userId}`);
  }

  // Método para obter o ID do usuário atual
  getCurrentUserId(): string | null {
    return this.currentUserId;
  }
}

// Instância singleton do monitor
export const messageMonitor = new MessageMonitor();

// Funções utilitárias para uso no frontend
export const startMessageMonitoring = () => messageMonitor.startMonitoring();
export const stopMessageMonitoring = () => messageMonitor.stopMonitoring();
export const getMonitoringStatus = () => messageMonitor.getStatus();
export const setPollingInterval = (intervalMs: number) => messageMonitor.setPollInterval(intervalMs);