import React, { useState, useRef, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Message } from '@/lib/supabase';

interface EditMessageModalProps {
  message: Message | null;
  open: boolean;
  onClose: () => void;
  onSave: (newContent: string) => void;
}

export const EditMessageModal: React.FC<EditMessageModalProps> = ({
  message,
  open,
  onClose,
  onSave
}) => {
  const [content, setContent] = useState(message?.content || '');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (message) {
      setContent(message.content);
    }
  }, [message]);

  useEffect(() => {
    if (open && textareaRef.current) {
      // Pequeno delay para garantir que o modal esteja renderizado
      setTimeout(() => {
        const textarea = textareaRef.current;
        if (textarea) {
          textarea.focus();
          // Posicionar cursor no final do texto
          const length = textarea.value.length;
          textarea.setSelectionRange(length, length);
        }
      }, 100);
    }
  }, [open]);

  const handleSave = () => {
    if (content.trim()) {
      onSave(content.trim());
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] top-[30%] translate-y-0">
        <DialogHeader>
          <DialogTitle>Editar mensagem</DialogTitle>
          <DialogDescription>
            Faça alterações na sua mensagem abaixo.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Digite sua mensagem..."
            className="min-h-[100px]"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!content.trim()}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};