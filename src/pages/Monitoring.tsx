import React from 'react';
import { MonitoringControl } from '@/components/monitoring/MonitoringControl';

const Monitoring: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 p-4">
      <div className="container mx-auto py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Sistema de Monitoramento Automático
          </h1>
          <p className="text-muted-foreground">
            Notificações sonoras em tempo real para mensagens recebidas
          </p>
        </div>
        
        <MonitoringControl />
      </div>
    </div>
  );
};

export default Monitoring;