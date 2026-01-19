import React from 'react';
import { Button } from '@/components/ui/button';
import { ChevronDown } from 'lucide-react';

interface NewMessageNotificationProps {
  show: boolean;
  messageCount: number;
  onClick: () => void;
}

export const NewMessageNotification: React.FC<NewMessageNotificationProps> = ({ 
  show, 
  messageCount, 
  onClick 
}) => {
  if (!show) return null;

  return (
    <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 z-50 animate-in slide-in-from-bottom-2 duration-300">
      <Button
        onClick={onClick}
        variant="secondary"
        size="sm"
        className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg border-0 rounded-full px-4 py-2 flex items-center gap-2"
      >
        <ChevronDown className="w-4 h-4" />
        <span className="text-sm font-medium">
          {messageCount === 1 
            ? 'Nova mensagem' 
            : `${messageCount} novas mensagens`
          }
        </span>
      </Button>
    </div>
  );
};