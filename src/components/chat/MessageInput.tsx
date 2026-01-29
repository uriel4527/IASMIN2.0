import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Image as ImageIcon, X, AlertCircle, Send, Link, RotateCcw, MapPin, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useImageUpload } from '@/hooks/useImageUpload';
import { LazyAudioRecorder } from './LazyAudioRecorder';
import { LazyVideoRecorder } from './LazyVideoRecorder';
import { ReplyPreview } from './ReplyPreview';
import { EmojiPicker } from './EmojiPicker';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Message } from '@/lib/supabase';
interface MessageInputProps {
  onSendMessage: (content: string, imageData?: string, audioData?: string, audioDuration?: number, replyToId?: string, videoPath?: string, videoDuration?: number, videoThumbnail?: string, viewOnce?: boolean) => void;
  disabled?: boolean;
  onStartTyping?: () => void;
  onStopTyping?: () => void;
  replyingTo?: Message | null;
  onCancelReply?: () => void;
  userId: string;
  onActionToggle?: () => void;
}
export const MessageInput: React.FC<MessageInputProps> = ({
  onSendMessage,
  disabled,
  onStartTyping,
  onStopTyping,
  replyingTo,
  onCancelReply,
  userId,
  onActionToggle
}) => {
  const [message, setMessage] = useState('');
  const [imageUploadState, imageUploadActions] = useImageUpload();
  const [isRecording, setIsRecording] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isTypingRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const STORAGE_KEY = `chat_draft_${userId}`;

  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [showActions, setShowActions] = useState(false);

  // Auto-expand actions when recording
  useEffect(() => {
    if (isRecording) {
      setShowActions(true);
    }
  }, [isRecording]);

  // Load draft from localStorage on mount
  useEffect(() => {
    const savedDraft = localStorage.getItem(STORAGE_KEY);
    if (savedDraft) {
      setMessage(savedDraft);
    }
  }, [STORAGE_KEY]);

  const stopTypingDelayed = useCallback(() => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      if (isTypingRef.current) {
        console.log('Stopping typing due to inactivity');
        isTypingRef.current = false;
        onStopTyping?.();
      }
    }, 1000); // Para de digitar após 1 segundo de inatividade
  }, [onStopTyping]);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() && !imageUploadState.selectedImage || disabled || imageUploadState.isUploading) return;
    const messageContent = message.trim() || (imageUploadState.selectedImage ? '📷 Imagem' : '');

    // Handle image upload with the hook
    if (imageUploadState.selectedImage) {
      await imageUploadActions.processAndUpload(async imageData => {
        await onSendMessage(messageContent, imageData, undefined, undefined, replyingTo?.id);
      });
    } else {
      // Send text-only message
      try {
        await onSendMessage(messageContent, undefined, undefined, undefined, replyingTo?.id);
        setMessage('');
        localStorage.removeItem(STORAGE_KEY);
        onCancelReply?.();
      } catch (error) {
        console.error('❌ Failed to send text message:', error);
        alert('Erro ao enviar mensagem. Tente novamente.');
        return;
      }
    }

    // Clear text input and reply state on success (image is cleared by the hook)
    if (!imageUploadState.error && imageUploadState.selectedImage) {
      setMessage('');
      localStorage.removeItem(STORAGE_KEY);
      onCancelReply?.();
    }

    // Clear timeout and stop typing immediately
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    isTypingRef.current = false;
    onStopTyping?.();
  };
  const handleSendAudio = (audioData: string, duration: number) => {
    onSendMessage("🎤 Áudio", undefined, audioData, duration, replyingTo?.id);
    onCancelReply?.();
    setIsRecording(false);

    // Stop typing indicator
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    isTypingRef.current = false;
    onStopTyping?.();
  };
  const handleSendVideo = async (videoPath: string, duration: number, thumbnail: string, viewOnce?: boolean) => {
    try {
      await onSendMessage("🎥 Vídeo", undefined, undefined, undefined, replyingTo?.id, videoPath, duration, thumbnail, viewOnce);
      onCancelReply?.();

      // Stop typing indicator
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      isTypingRef.current = false;
      onStopTyping?.();
    } catch (error) {
      console.error('❌ Failed to send video:', error);
    }
  };
  const handleEmojiSelect = (emoji: string) => {
    const input = inputRef.current;
    if (input) {
      const cursorPosition = input.selectionStart || message.length;
      const newMessage = message.slice(0, cursorPosition) + emoji + message.slice(cursorPosition);
      setMessage(newMessage);
      localStorage.setItem(STORAGE_KEY, newMessage);

      // Set cursor position after the emoji
      setTimeout(() => {
        input.focus();
        input.setSelectionRange(cursorPosition + emoji.length, cursorPosition + emoji.length);
      }, 0);
    }
  };
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    imageUploadActions.selectImage(file);

    // Clear file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  const removeImage = () => {
    imageUploadActions.removeImage();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setMessage(value);

    // Save draft to localStorage
    if (value) {
      localStorage.setItem(STORAGE_KEY, value);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }

    if (!disabled) {
      if (value.length > 0) {
        // Começou a digitar
        if (!isTypingRef.current) {
          console.log('Starting typing');
          isTypingRef.current = true;
          onStartTyping?.();
        }
        stopTypingDelayed();
      } else {
        // Campo vazio, parar de digitar
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
        if (isTypingRef.current) {
          console.log('Stopping typing - empty field');
          isTypingRef.current = false;
          onStopTyping?.();
        }
      }
    }
  };
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    } else if (!disabled) {
      // Qualquer tecla pressionada conta como digitação
      if (!isTypingRef.current && message.length >= 0) {
        console.log('Key pressed - starting typing');
        isTypingRef.current = true;
        onStartTyping?.();
      }
      stopTypingDelayed();
    }
  };
  const handleBlur = () => {
    // Para de digitar quando perde o foco
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    if (isTypingRef.current) {
      console.log('Stopping typing - blur');
      isTypingRef.current = false;
      onStopTyping?.();
    }
  };

  const handlePasteLink = async () => {
    try {
      const clipboardText = await navigator.clipboard.readText();
      if (clipboardText.trim()) {
        // Envia diretamente o link copiado
        await onSendMessage(clipboardText.trim(), undefined, undefined, undefined, replyingTo?.id);
        onCancelReply?.();
        
        // Clear timeout and stop typing immediately
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
        isTypingRef.current = false;
        onStopTyping?.();
      }
    } catch (error) {
      console.error('❌ Failed to read clipboard:', error);
      alert('Erro ao acessar área de transferência. Verifique as permissões do navegador.');
    }
  };
  const handleSendLocation = async () => {
    if (isGettingLocation) return;
    
    setIsGettingLocation(true);
    
    if (!navigator.geolocation) {
      alert("Seu navegador não suporta geolocalização.");
      setIsGettingLocation(false);
      return;
    }

    try {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          const googleMapsLink = `https://www.google.com/maps?q=${latitude},${longitude}`;
          
          onSendMessage(googleMapsLink, undefined, undefined, undefined, replyingTo?.id);
          onCancelReply?.();
          setIsGettingLocation(false);
          
          // Clear timeout and stop typing immediately
          if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
          }
          isTypingRef.current = false;
          onStopTyping?.();
        },
        (error) => {
          console.error("Erro ao obter localização:", error);
          let errorMessage = "Erro ao obter localização.";
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = "Permissão de localização negada. Por favor, permita o acesso à localização nas configurações do seu navegador.";
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = "Informações de localização indisponíveis.";
              break;
            case error.TIMEOUT:
              errorMessage = "Tempo esgotado ao tentar obter localização.";
              break;
          }
          alert(errorMessage);
          setIsGettingLocation(false);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    } catch (error) {
      console.error("Erro inesperado ao obter localização:", error);
      alert("Ocorreu um erro inesperado ao tentar obter sua localização.");
      setIsGettingLocation(false);
    }
  };

  return <div className="bg-card shrink-0" style={{
    position: 'relative',
    zIndex: 10
  }}>
      {/* Reply Preview */}
      {replyingTo && <ReplyPreview message={replyingTo} onCancel={() => onCancelReply?.()} />}
      
      {/* Error Alert */}
      {imageUploadState.error && <div className="p-4 pb-2">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {imageUploadState.error}
              <Button variant="ghost" size="sm" className="ml-2 h-auto p-0 text-destructive hover:text-destructive" onClick={imageUploadActions.clearError}>
                Dispensar
              </Button>
            </AlertDescription>
          </Alert>
        </div>}
      
      {/* Image Preview */}
      {imageUploadState.imagePreview && <div className="p-4 pb-2">
          <div className="relative inline-block">
            <img src={imageUploadState.imagePreview} alt="Preview" className="max-w-32 max-h-32 rounded-lg border object-cover" />
            <Button variant="destructive" size="sm" className="absolute -top-2 -right-2 w-6 h-6 rounded-full p-0" onClick={removeImage} disabled={imageUploadState.isUploading}>
              <X className="w-3 h-3" />
            </Button>
            
            {/* Upload progress indicator */}
            {imageUploadState.isUploading && (
              <div className="absolute inset-0 bg-black/60 rounded-lg flex flex-col items-center justify-center p-2 gap-2">
                <div className="w-full space-y-1">
                  <div className="flex justify-between text-[10px] text-white">
                    <span>Enviando...</span>
                    <span>{Math.round(imageUploadState.uploadProgress)}%</span>
                  </div>
                  <Progress value={imageUploadState.uploadProgress} className="h-2 w-full bg-white/20" />
                </div>
              </div>
            )}
          </div>
        </div>}
      
      <form onSubmit={handleSubmit} className="flex flex-col py-0 my-0 px-0">
        <div className="flex items-center gap-0">
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelect} className="hidden" disabled={disabled || imageUploadState.isUploading} />
          
          <Input 
            ref={inputRef} 
            value={message} 
            onChange={handleInputChange} 
            onKeyDown={handleKeyPress} 
            onBlur={handleBlur} 
            placeholder="Digite sua mensagem..." 
            className="flex-1 h-7 text-xs border-0 focus-visible:ring-0 focus-visible:ring-offset-0 px-2 bg-transparent shadow-none" 
            disabled={disabled || imageUploadState.isUploading} 
            autoComplete="off"
            autoCorrect="off"
            spellCheck="false"
            name="chat_message_field_no_autofill"
          />

          {/* Toggle Button */}
          {!isRecording && (
            <Button 
              type="button" 
              variant="ghost" 
              size="sm" 
              onClick={() => {
                setShowActions(!showActions);
                onActionToggle?.();
              }} 
              className="shrink-0 h-7 w-7 p-0 hover:bg-transparent"
            >
              {showActions ? <ChevronRight className="w-4 h-4 text-muted-foreground rotate-90" /> : <ChevronLeft className="w-4 h-4 text-muted-foreground -rotate-90" />}
            </Button>
          )}
          
          {/* Send button - only appears when image is selected */}
          {imageUploadState.selectedImage && <Button type="submit" size="sm" disabled={disabled || imageUploadState.isUploading} className="shrink-0 h-7 w-7 p-0">
              <Send className="w-3 h-3" />
            </Button>}
        </div>

        {/* Action Buttons - Expandable Row */}
        <div className={cn(
          "flex items-center justify-center gap-2 transition-all duration-300 overflow-hidden",
          showActions ? "mt-2 max-h-12 opacity-100" : "max-h-0 opacity-0"
        )}>
            {/* HD Button - hidden when recording */}
            {!isRecording && <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={disabled || imageUploadState.isUploading} className="shrink-0 flex flex-col items-center justify-center gap-0.5 h-8 w-8">
                <ImageIcon className="w-3 h-3 text-green-500" />
                <span className="text-[6px] font-bold leading-none text-green-600">HD</span>
              </Button>}
            
            {/* LazyAudioRecorder - always mounted */}
            <LazyAudioRecorder onSendAudio={handleSendAudio} disabled={disabled} className="shrink-0 h-8 w-8" onRecordingChange={setIsRecording} />
            
            {/* Video Button - hidden when recording */}
            {!isRecording && <LazyVideoRecorder onSendVideo={handleSendVideo} disabled={disabled} userId={userId} className="shrink-0 h-8 w-8" />}
            
            {/* Link Button - hidden when recording */}
            {!isRecording && <Button type="button" variant="outline" size="sm" onClick={handlePasteLink} disabled={disabled} className="shrink-0 flex flex-col items-center justify-center gap-0.5 h-8 w-8">
                <Link className="w-3 h-3 text-purple-500" />
                <span className="text-[6px] font-bold leading-none text-purple-600">LINK</span>
              </Button>}
            
            {/* Emoji Button - hidden when recording */}
            {!isRecording && <EmojiPicker onEmojiSelect={handleEmojiSelect} disabled={disabled} className="h-8 w-8" />}

            {/* Location Button - hidden when recording */}
            {!isRecording && <Button type="button" variant="outline" size="sm" onClick={handleSendLocation} disabled={disabled || isGettingLocation} className="shrink-0 flex flex-col items-center justify-center gap-0.5 h-8 w-8">
                {isGettingLocation ? (
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-red-500" />
                ) : (
                  <MapPin className="w-3 h-3 text-red-500" />
                )}
                <span className="text-[6px] font-bold leading-none text-red-600">GPS</span>
              </Button>}
        </div>
      </form>
    </div>;
};