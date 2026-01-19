import React from 'react';
import { X } from 'lucide-react';
import { Message } from '@/lib/supabase';
import { Button } from '@/components/ui/button';

interface ReplyPreviewProps {
  message: Message;
  onCancel: () => void;
}

export const ReplyPreview: React.FC<ReplyPreviewProps> = ({
  message,
  onCancel
}) => {
  const getPreviewContent = () => {
    if (message.has_image) return '📷 Imagem';
    if (message.has_audio) return '🎤 Áudio';
    if (message.content.length > 50) {
      return message.content.substring(0, 50) + '...';
    }
    return message.content;
  };

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-muted/50 border-l-4 border-primary">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-primary">
          Respondendo a {message.sender?.username || 'Usuário'}
        </p>
        <p className="text-sm text-muted-foreground truncate">
          {getPreviewContent()}
        </p>
      </div>
      <Button
        size="icon"
        variant="ghost"
        className="h-6 w-6"
        onClick={onCancel}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
};