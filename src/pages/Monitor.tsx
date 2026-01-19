import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { RefreshCw, Database, HardDrive, Users, MessageCircle, Trash2, AlertTriangle, Code2 } from 'lucide-react';


// Configuração do Supabase
const supabaseUrl = 'https://uxcsfevgygrzrmxhenth.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4Y3NmZXZneWdyenJteGhlbnRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIwNDU4ODEsImV4cCI6MjA3NzYyMTg4MX0.pG3_eMj1ZhrAikrln9Phz_Y9fSat9bjFrdrf_T-UxNM';

const supabase = createClient(supabaseUrl, supabaseKey);

interface DatabaseStats {
  totalUsers: number;
  totalMessages: number;
  estimatedSizeKB: number;
  lastUpdated: string;
}

interface MessageStats {
  total_messages: number;
  text_messages: number;
  image_messages: number;
  audio_messages: number;
  estimated_text_size_kb: number;
  estimated_image_size_kb: number;
  estimated_audio_size_kb: number;
  total_estimated_size_kb: number;
}

const Monitor = () => {
  const [stats, setStats] = useState<DatabaseStats | null>(null);
  const [messageStats, setMessageStats] = useState<MessageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [clearingMessages, setClearingMessages] = useState(false);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [developerMode, setDeveloperMode] = useState(() => {
    return localStorage.getItem('developer_mode') === 'enabled';
  });
  

  const fetchDatabaseStats = async () => {
    setLoading(true);
    try {
      // Buscar estatísticas das tabelas
      const [usersResult, messagesResult, messageStatsResult] = await Promise.all([
        supabase.from('users').select('*', { count: 'exact', head: true }),
        supabase.from('messages').select('*', { count: 'exact', head: true }),
        supabase.rpc('get_messages_storage_stats')
      ]);

      if (usersResult.error) {
        console.error('Erro ao buscar usuários:', usersResult.error);
      }

      if (messagesResult.error) {
        console.error('Erro ao buscar mensagens:', messagesResult.error);
      }

      if (messageStatsResult.error) {
        console.error('Erro ao buscar estatísticas de mensagens:', messageStatsResult.error);
      }

      const totalUsers = usersResult.count || 0;
      const totalMessages = messagesResult.count || 0;

      // Usar dados detalhados se disponíveis, senão usar estimativa básica
      const detailedStats = messageStatsResult.data?.[0];
      const estimatedSizeKB = detailedStats 
        ? Math.round(detailedStats.total_estimated_size_kb)
        : Math.round((totalUsers * 0.2) + (totalMessages * 0.1));

      setStats({
        totalUsers,
        totalMessages,
        estimatedSizeKB,
        lastUpdated: new Date().toLocaleString('pt-BR')
      });

      if (detailedStats) {
        setMessageStats(detailedStats);
      }

      console.log("Dados atualizados - Estatísticas do banco de dados carregadas com sucesso");

    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClearAllMessages = async () => {
    setClearingMessages(true);
    try {
      const { data, error } = await supabase.rpc('clear_all_messages');
      
      if (error) {
        throw error;
      }

      const result = data?.[0];
      
      console.log(`✅ Limpeza completa realizada!`);
      console.log(`📨 ${result?.deleted_messages_count || 0} mensagens removidas`);
      console.log(`❤️ ${result?.deleted_reactions_count || 0} reações removidas`);
      console.log(`⌨️ ${result?.cleared_typing_status_count || 0} status de digitação limpos`);
      console.log(`💾 Espaço liberado: ${result?.estimated_freed_space_kb || 0} KB`);

      setShowClearDialog(false);
      await fetchDatabaseStats();

    } catch (err) {
      console.warn('RPC falhou, aplicando fallback seguro (REST)...', err);
      try {
        // Deletar reações (se existir a tabela)
        await supabase.from('message_reactions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      } catch (_) {}
      try {
        // Limpar status de digitação
        await supabase.from('typing_status').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      } catch (_) {}
      // Deletar todas as mensagens com filtro seguro
      const { error: delErr } = await supabase
        .from('messages')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');
      if (delErr) throw delErr;

      console.log('✅ Limpeza via fallback concluída.');
      setShowClearDialog(false);
      await fetchDatabaseStats();
    } finally {
      setClearingMessages(false);
    }
  };

  const handleDeveloperModeToggle = (checked: boolean) => {
    setDeveloperMode(checked);
    localStorage.setItem('developer_mode', checked ? 'enabled' : 'disabled');
    console.log(`🔧 Modo Desenvolvedor: ${checked ? 'ATIVADO' : 'DESATIVADO'}`);
  };

  useEffect(() => {
    fetchDatabaseStats();
  }, []);

  const formatBytes = (kb: number) => {
    if (kb < 1024) return `${kb} KB`;
    if (kb < 1024 * 1024) return `${(kb / 1024).toFixed(2)} MB`;
    return `${(kb / (1024 * 1024)).toFixed(2)} GB`;
  };

  // Estimativa de uso do limite (assumindo um limite de 500MB para projetos gratuitos)
  const limitKB = 500 * 1024; // 500MB em KB
  const usagePercentage = stats ? Math.min((stats.estimatedSizeKB / limitKB) * 100, 100) : 0;

  return (
    <div className="h-screen-fixed bg-background p-6 overflow-y-auto overflow-x-hidden">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Monitor do Banco de Dados</h1>
            <p className="text-muted-foreground mt-2">
              Acompanhe o uso de espaço e estatísticas do seu projeto
            </p>
          </div>
          <Button onClick={fetchDatabaseStats} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>

        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Usuários</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalUsers || 0}</div>
              <p className="text-xs text-muted-foreground">
                Usuários cadastrados
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Mensagens</CardTitle>
              <MessageCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalMessages || 0}</div>
              <p className="text-xs text-muted-foreground">
                Mensagens enviadas
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tamanho Estimado</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats ? formatBytes(stats.estimatedSizeKB) : '0 KB'}
              </div>
              <p className="text-xs text-muted-foreground">
                Espaço utilizado
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Uso do Limite</CardTitle>
              <HardDrive className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{usagePercentage.toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground">
                de 500MB (estimativa)
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Usage Progress */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HardDrive className="w-5 h-5" />
              Uso de Armazenamento
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Espaço Utilizado</span>
                <span>{stats ? formatBytes(stats.estimatedSizeKB) : '0 KB'} / 500MB</span>
              </div>
              <Progress value={usagePercentage} className="h-2" />
            </div>
            
            <div className="flex items-center gap-2">
              <Badge variant={usagePercentage > 80 ? "destructive" : usagePercentage > 50 ? "secondary" : "default"}>
                {usagePercentage > 80 ? "Alto" : usagePercentage > 50 ? "Médio" : "Baixo"}
              </Badge>
              <span className="text-sm text-muted-foreground">
                Uso de armazenamento
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Message Statistics */}
        {messageStats && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="w-5 h-5" />
                Estatísticas Detalhadas de Mensagens
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="text-center p-3 bg-muted/30 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{messageStats.text_messages}</div>
                  <div className="text-muted-foreground">Mensagens de Texto</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    ~{messageStats.estimated_text_size_kb.toFixed(1)} KB
                  </div>
                </div>
                <div className="text-center p-3 bg-muted/30 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{messageStats.image_messages}</div>
                  <div className="text-muted-foreground">Imagens</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    ~{messageStats.estimated_image_size_kb.toFixed(1)} KB
                  </div>
                </div>
                <div className="text-center p-3 bg-muted/30 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">{messageStats.audio_messages}</div>
                  <div className="text-muted-foreground">Áudios</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    ~{messageStats.estimated_audio_size_kb.toFixed(1)} KB
                  </div>
                </div>
                <div className="text-center p-3 bg-muted/30 rounded-lg">
                  <div className="text-2xl font-bold">{messageStats.total_messages}</div>
                  <div className="text-muted-foreground">Total</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    ~{messageStats.total_estimated_size_kb.toFixed(1)} KB
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Developer Mode */}
        <Card className="border-primary/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary">
              <Code2 className="w-5 h-5" />
              Configurações de Desenvolvedor
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="font-semibold text-foreground mb-1">Modo Desenvolvedor</h4>
                  <p className="text-sm text-muted-foreground">
                    Desativa proteções de segurança para desenvolvimento
                  </p>
                </div>
                <Switch
                  checked={developerMode}
                  onCheckedChange={handleDeveloperModeToggle}
                />
              </div>
              
              {developerMode && (
                <div className="mt-4 p-3 bg-background/50 rounded border border-primary/30">
                  <p className="text-sm font-medium text-foreground mb-2">
                    ⚠️ Funcionalidades ativadas:
                  </p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Acesso direto ao chat (sem senha)</li>
                    <li>• Sem timeout de 30 segundos</li>
                    <li>• Redirecionamento automático para /chat</li>
                  </ul>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Danger Zone - Clear All Messages */}
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Zona de Perigo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-destructive/10 rounded-lg border border-destructive/20">
              <h4 className="font-semibold text-destructive mb-2">Apagar Todas as Mensagens</h4>
              <p className="text-sm text-muted-foreground mb-4">
                Esta ação irá remover permanentemente todas as mensagens do banco de dados. Esta ação é irreversível.
              </p>

              <Dialog open={showClearDialog} onOpenChange={setShowClearDialog}>
                <DialogTrigger asChild>
                  <Button variant="destructive" className="w-full">
                    <Trash2 className="w-4 h-4 mr-2" />
                    Apagar Todas as Mensagens
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-destructive">
                      <AlertTriangle className="w-5 h-5" />
                      Tem certeza?
                    </DialogTitle>
                    <DialogDescription>
                      Esta ação irá apagar todas as mensagens permanentemente. Não é possível desfazer esta ação.
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="flex gap-2 mt-4">
                    <Button 
                      variant="outline" 
                      onClick={() => setShowClearDialog(false)}
                      className="flex-1"
                    >
                      Cancelar
                    </Button>
                    <Button 
                      variant="destructive" 
                      onClick={handleClearAllMessages}
                      disabled={clearingMessages}
                      className="flex-1"
                    >
                      {clearingMessages ? (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                          Apagando...
                        </>
                      ) : (
                        <>
                          <Trash2 className="w-4 h-4 mr-2" />
                          Apagar Tudo
                        </>
                      )}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>

        {/* Database Info */}
        <Card>
          <CardHeader>
            <CardTitle>Informações do Banco de Dados</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <strong>URL do Supabase:</strong>
                <p className="text-muted-foreground font-mono">
                  {supabaseUrl}
                </p>
              </div>
              <div>
                <strong>Última Atualização:</strong>
                <p className="text-muted-foreground">
                  {stats?.lastUpdated || 'Nunca'}
                </p>
              </div>
            </div>
            
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">
                <strong>Nota:</strong> Os valores apresentados são estimativas baseadas nos registros das tabelas. 
                O uso real pode variar devido a índices, metadados e outras estruturas do banco de dados.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Monitor;