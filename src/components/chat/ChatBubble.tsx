import React, { useState } from 'react';
import { Message } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from '@/components/ui/alert-dialog';
import { AudioPlayer } from './AudioPlayer';
import { VideoPlayer } from './VideoPlayer';
import { SecureImage } from './SecureImage';
import { ImageViewer } from './ImageViewer';
import { EditMessageModal } from './EditMessageModal';
import { ReactionBar } from './ReactionBar';
import { MessageReactions } from './MessageReactions';
import { LinkifiedText } from './LinkifiedText';
import { useSwipe } from '@/hooks/useSwipe';
import { useReactions, ReactionSummary } from '@/hooks/useReactions';
import { X, Reply, Trash2, Edit, Check, CheckCheck, Download, Image as ImageIcon } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ChatBubbleProps {
  message: Message & {
    image_data?: string;
    has_image?: boolean;
    reactions?: any[];
  };
  isOwn: boolean;
  currentUserId: string;
  onDelete?: (messageId: string) => void;
  onEdit?: (messageId: string, newContent: string) => void;
  onReply?: (message: Message) => void;
  onScrollToMessage?: (messageId: string) => void;
  reactions?: any[];
  onReaction?: (emoji: string) => void;
  downloadOnDemand?: boolean;
}

export const ChatBubble: React.FC<ChatBubbleProps> = ({ 
  message, 
  isOwn,
  currentUserId,
  onDelete,
  onEdit,
  onReply,
  onScrollToMessage,
  reactions: externalReactions,
  onReaction,
  downloadOnDemand = false
}) => {
  const [isImageOpen, setIsImageOpen] = useState(false);
  const [isImageLoaded, setIsImageLoaded] = useState(!downloadOnDemand);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [showReactionBar, setShowReactionBar] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);
  const sender = message.sender;
  const timestamp = format(new Date(message.created_at), 'HH:mm', { locale: ptBR });
  const isDeleted = !!message.deleted_at;
  
  // Reaction system - skip internal logic if external handler is provided
  const { toggleReaction: hookToggleReaction, reactionSummary: hookReactionSummary } = useReactions(message.id, !!onReaction);

  const toggleReaction = onReaction || hookToggleReaction;
  
  // Compute summary for external reactions
  const computeSummary = (reactions: any[], currentUserId: string): ReactionSummary[] => {
    const summary = new Map<string, ReactionSummary>();
    reactions.forEach(reaction => {
        const existing = summary.get(reaction.emoji);
        if (existing) {
            existing.count++;
            existing.users.push(reaction.user_id);
            if (reaction.user_id === currentUserId) {
                existing.hasUserReacted = true;
            }
        } else {
            summary.set(reaction.emoji, {
                emoji: reaction.emoji,
                count: 1,
                users: [reaction.user_id],
                hasUserReacted: reaction.user_id === currentUserId
            });
        }
    });
    return Array.from(summary.values()).sort((a, b) => b.count - a.count);
  };

  const reactionSummary = (externalReactions || message.reactions) 
    ? computeSummary(externalReactions || message.reactions || [], currentUserId)
    : hookReactionSummary;


  // Combined touch handlers for both swipe and long press
  const handleCombinedTouchStart = (e: React.TouchEvent) => {
    // Start swipe tracking
    handlers.onTouchStart(e);
    
    // Start long press timer
    const timer = setTimeout(() => {
      setShowReactionBar(true);
      if ('vibrate' in navigator) {
        navigator.vibrate(50);
      }
    }, 800);
    setLongPressTimer(timer);
  };

  const handleCombinedTouchMove = (e: React.TouchEvent) => {
    // Handle swipe tracking
    handlers.onTouchMove(e);
    
    // Cancel long press if user is swiping
    if (isSwipeActive && longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  };

  const handleCombinedTouchEnd = (e: React.TouchEvent) => {
    // Handle swipe end
    handlers.onTouchEnd();
    
    // Cancel long press timer
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  };

  const { isSwipeActive, swipeDistance, swipeType, handlers } = useSwipe({
    onSwipeRight: () => {
      if (onReply) {
        onReply(message);
      }
    },
    onSwipeRightLong: () => {
      // For own messages, long swipe right = edit
      if (isOwn && !message.has_image && !message.has_audio) {
        setIsEditModalOpen(true);
      } else if (onReply && !isOwn) {
        // For other users' messages, long swipe also just replies
        onReply(message);
      }
    },
    onSwipeLeft: () => {
      if (isOwn && onDelete) {
        // For own messages, swipe left = show delete confirmation
        setShowDeleteConfirm(true);
      } else if (!isOwn && onReply) {
        // For other users' messages, swipe left = reply
        onReply(message);
      }
    },
    threshold: 60,
    deleteThreshold: isOwn ? 120 : 60, // Same threshold for non-own messages (just reply)
    isOwn: isOwn
  });

  const handleDelete = () => {
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = () => {
    onDelete?.(message.id);
    setShowDeleteConfirm(false);
  };

  const handleEdit = () => {
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = (newContent: string) => {
    onEdit?.(message.id, newContent);
    setIsEditModalOpen(false);
  };

  const handleReply = () => {
    onReply?.(message);
  };

  const handleClickReply = () => {
    if (message.reply_to && onScrollToMessage) {
      onScrollToMessage(message.reply_to.id);
    }
  };

  return (
    <>
      <div className={cn(
        "flex items-end gap-2 max-w-[80%]",
        isOwn ? "ml-auto flex-row-reverse" : "mr-auto"
      )}>
        {!isOwn && (
          <Avatar className="w-8 h-8 flex-shrink-0">
            <AvatarImage src={sender?.avatar_url} />
            <AvatarFallback className="text-[10px] bg-primary text-primary-foreground">
              {sender?.username?.charAt(0).toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
        )}
        
        <div className="relative">
            {/* Swipe indicator */}
            {isSwipeActive && Math.abs(swipeDistance) > 30 && (
              <div className={cn(
                "absolute top-1/2 -translate-y-1/2 transition-all duration-200 z-10",
                "opacity-70",
                swipeDistance < 0 ? "right-[-50px]" : "left-[-50px]"
              )}>
                <div className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center transition-colors",
                  swipeType === 'delete'
                    ? "bg-red-500/20 border-2 border-red-500/50 text-red-500" 
                    : swipeType === 'edit' && isOwn
                    ? "bg-blue-500/20 border-2 border-blue-500/50 text-blue-500"
                    : "bg-primary/20 border-2 border-primary/50 text-primary"
                )}>
                  {swipeType === 'delete' ? (
                    <Trash2 className="w-4 h-4" />
                  ) : swipeType === 'edit' && isOwn ? (
                    <Edit className="w-4 h-4" />
                  ) : (
                    <Reply className="w-4 h-4" />
                  )}
                </div>
              </div>
            )}
            
            <div 
              {...handlers}
              onTouchStart={handleCombinedTouchStart}
              onTouchEnd={handleCombinedTouchEnd}
              onTouchMove={handleCombinedTouchMove}
              className={cn(
                "rounded-lg px-4 py-2 shadow-sm transition-all duration-200 relative break-words overflow-wrap-anywhere min-w-0 max-w-full min-w-[16rem]",
                isOwn 
                  ? "bg-chat-sent text-chat-sent-foreground rounded-br-sm" 
                  : "bg-chat-received text-chat-received-foreground rounded-bl-sm",
                isDeleted && "opacity-60",
                isSwipeActive && "select-none"
              )}
              style={{
                transform: isSwipeActive 
                  ? `translateX(${swipeDistance > 0 
                    ? Math.min(swipeDistance * 0.3, 40)
                    : Math.max(swipeDistance * 0.3, -40)}px)`
                  : 'translateX(0)',
              }}
            >
              {/* Display reply reference if present */}
              {message.reply_to && (
                <div 
                  className={cn(
                    "mb-2 p-2 rounded border-l-2 cursor-pointer transition-all duration-200 hover:scale-[1.02] hover-scale",
                    isOwn 
                      ? "bg-chat-sent/20 border-chat-sent-foreground/50 hover:bg-chat-sent/30" 
                      : "bg-chat-received/20 border-chat-received-foreground/50 hover:bg-chat-received/30"
                  )}
                  onClick={handleClickReply}
                >
                  <p className="text-[10px] font-medium opacity-70">
                    {message.reply_to.sender?.username || 'Usuário'}
                  </p>
                  <p className="text-[10px] opacity-60 truncate">
                    {message.reply_to.has_image ? '📷 Imagem' : 
                     message.reply_to.has_audio ? '🎤 Áudio' : 
                     message.reply_to.has_video ? '🎥 Vídeo' :
                     message.reply_to.content && message.reply_to.content.length > 40 
                       ? `${message.reply_to.content.substring(0, 40)}...`
                       : message.reply_to.content}
                  </p>
                </div>
              )}
              
              {/* Display deleted message */}
              {isDeleted ? (
                <p className="text-sm leading-relaxed italic opacity-70">
                  [Mensagem excluída]
                </p>
              ) : (
                <>
                  {/* Display audio if present */}
                  {message.has_audio && message.audio_data && message.audio_duration && (
                    <div className="mb-2">
                      <AudioPlayer
                        audioData={message.audio_data}
                        duration={message.audio_duration}
                        isOwn={isOwn}
                        className="interactive"
                      />
                    </div>
                  )}

                  {/* Display video if present */}
                  {message.has_video && message.video_storage_path && (
                    <div className="mb-2">
                      <VideoPlayer
                        videoPath={message.video_storage_path}
                        thumbnail={message.video_thumbnail}
                        duration={message.video_duration || 0}
                        viewOnce={message.view_once}
                        viewed={!!message.viewed_at}
                        messageId={message.id}
                        currentUserId={currentUserId}
                        senderId={message.sender_id}
                        className="interactive"
                      />
                    </div>
                  )}

                  {/* Display image if present */}
                  {message.has_image && (
                    message.image_data ? (
                      <>
                        <div className="mb-2">
                          {!isImageLoaded ? (
                            <div 
                              className="w-full h-48 sm:h-64 bg-muted/20 flex flex-col items-center justify-center rounded-md border border-border/50 cursor-pointer hover:bg-muted/30 transition-colors interactive"
                              onClick={() => setIsImageLoaded(true)}
                            >
                              <div className="bg-background/80 p-3 rounded-full mb-2 shadow-sm">
                                <Download className="w-6 h-6 text-primary" />
                              </div>
                              <span className="text-xs font-medium text-foreground">Baixar Imagem</span>
                              <span className="text-[10px] text-muted-foreground mt-1">Clique para visualizar</span>
                            </div>
                          ) : (
                            <SecureImage 
                              src={message.image_data}
                              alt="Imagem enviada"
                              className="max-w-full max-h-64 rounded-md object-cover cursor-pointer hover:opacity-90 transition-opacity interactive"
                              loading="lazy"
                              onClick={() => setIsImageOpen(true)}
                              onError={(e) => {
                                console.error('Erro ao carregar imagem:', {
                                  messageId: message.id,
                                  hasImageData: !!message.image_data,
                                  imageDataLength: message.image_data?.length,
                                  imageDataPrefix: message.image_data?.substring(0, 50)
                                });
                                e.currentTarget.style.display = 'none';
                              }}
                              onLoad={() => {
                                console.log('Imagem carregada com sucesso:', message.id);
                              }}
                            />
                          )}
                        </div>
                        
                        {/* Image Modal */}
                        <Dialog open={isImageOpen} onOpenChange={setIsImageOpen}>
                          <DialogContent className="max-w-screen w-screen h-screen p-0 m-0 border-none bg-black/95 backdrop-blur-none overflow-hidden">
                            {message.image_data && (
                              <ImageViewer 
                                src={message.image_data}
                                alt="Imagem ampliada"
                                onClose={() => setIsImageOpen(false)}
                              />
                            )}
                          </DialogContent>
                        </Dialog>
                      </>
                    ) : (
                      <div className="mb-2">
                        <Button 
                          variant="outline" 
                          className="w-full h-32 flex flex-col items-center justify-center gap-2 bg-background/20 backdrop-blur border-dashed hover:bg-background/30"
                          onClick={(e) => {
                            e.stopPropagation();
                            onRequestImage?.(message.id);
                          }}
                        >
                          <Download className="w-8 h-8 opacity-70" />
                          <span className="text-xs opacity-70">Clique para baixar imagem</span>
                        </Button>
                      </div>
                    )
                  )}
                  
                  {/* Display text content if not just an image/audio/video placeholder */}
                  {message.content && message.content !== '📷 Imagem' && message.content !== '🎤 Áudio' && message.content !== '🎥 Vídeo' && (
                    <LinkifiedText 
                      text={message.content} 
                      className="text-sm leading-relaxed break-words overflow-wrap-anywhere"
                    />
                  )}
                </>
              )}
          
              <div className={cn(
                "flex items-center gap-1 mt-1",
                isOwn ? "justify-end" : "justify-start"
              )}>
                <span className={cn(
                  "text-[10px] opacity-70",
                  isOwn ? "text-chat-sent-foreground" : "text-chat-received-foreground"
                )}>
                  {timestamp}
                </span>
                
                {isOwn && (
                     <span className="ml-1" title={message.is_read ? "Lida" : "Enviada"}>
                         {message.is_read ? (
                             <CheckCheck className="w-3 h-3 text-[#53bdeb]" />
                         ) : (
                             <CheckCheck className="w-3 h-3 opacity-70" />
                         )}
                     </span>
                 )}

                {((message as any).is_edited || message.edited_at) && !isDeleted && (
                  <span className={cn(
                    "text-[10px] opacity-50",
                    isOwn ? "text-chat-sent-foreground" : "text-chat-received-foreground"
                  )}>
                    (editado)
                  </span>
                )}
              </div>
            </div>

            {/* Message Reactions */}
            <MessageReactions
              reactions={reactionSummary}
              onReactionClick={toggleReaction}
              isOwn={isOwn}
            />
          </div>
      </div>

      {/* Edit Message Modal */}
      <EditMessageModal
        message={message}
        open={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSave={handleSaveEdit}
      />

      {/* Reaction Bar */}
      <ReactionBar
        isVisible={showReactionBar}
        onReaction={toggleReaction}
        onClose={() => setShowReactionBar(false)}
        messageId={message.id}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir mensagem</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta mensagem? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Sim, excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};