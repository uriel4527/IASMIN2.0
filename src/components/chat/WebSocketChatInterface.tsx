import React, { useState, useEffect, useRef } from 'react';
import { Message, User } from '@/lib/supabase';
import { ChatBubble } from './ChatBubble';
import { MessageInput } from './MessageInput';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, WifiOff, Bell } from 'lucide-react';
import { toast } from 'sonner';

export const WebSocketChatInterface: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [otherUsers, setOtherUsers] = useState<Map<string, User & { is_online?: boolean, last_seen?: string }>>(new Map());
  const [timeAgo, setTimeAgo] = useState<string>('');
  const [pushSending, setPushSending] = useState(false);
  const [pushSendStats, setPushSendStats] = useState<{ sent: number; failed: number; total: number } | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [ping, setPing] = useState<number | null>(null);
  const [serverSupportsPing, setServerSupportsPing] = useState(true);
  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const scrollViewportRef = useRef<HTMLElement | null>(null);
  const lastMessageIdRef = useRef<string | null>(null);
  const processedReadIds = useRef<Set<string>>(new Set());
  const [isVisible, setIsVisible] = useState(document.visibilityState === 'visible');

  // Handle visibility change
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsVisible(document.visibilityState === 'visible');
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Load user from localStorage
  useEffect(() => {
    const loadUser = () => {
      try {
        const storedUser = localStorage.getItem('chatapp_user');
        if (storedUser) {
          const parsedUser = JSON.parse(storedUser);
          // Ensure it has at least the basic fields
          if (parsedUser && (parsedUser.id || parsedUser.username)) {
             // Adapt if necessary to match User interface
             const validUser: User = {
                 id: parsedUser.id || 'unknown-id',
                 username: parsedUser.username || 'Guest',
                 email: parsedUser.email || '',
                 created_at: parsedUser.created_at || new Date().toISOString(),
                 last_seen: new Date().toISOString(),
                 is_online: true,
                 avatar_url: parsedUser.avatar_url
             };
             setUser(validUser);
             return;
          }
        }
        console.warn('No valid chatapp_user found in localStorage');
        // Optional: Redirect or show error? For now, we wait.
      } catch (error) {
        console.error('Error parsing chatapp_user:', error);
      }
    };
    loadUser();
  }, []);

  // WebSocket Connection
  useEffect(() => {
    if (!user) return;

    const connectWebSocket = () => {
      try {
        // Determine WebSocket URL based on current environment
        const wsUrl = 'wss://iasmin.duckdns.org'; // Default to public domain
        
        console.log('Connecting to WebSocket at:', wsUrl);
        const ws = new WebSocket(wsUrl);
        
        ws.onopen = () => {
          console.log('WebSocket Connected');
          setIsConnected(true);
          setConnectionError(false);
          
          // Optional: Send join message
          ws.send(JSON.stringify({
            type: 'join',
            user: user
          }));
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log('WS Message received:', data);
            
            // Handle different message types if backend sends them
            if (data.type === 'pong') {
                const now = Date.now();
                const latency = now - data.timestamp;
                setPing(latency);
                return;
            }

            if (data.type === 'ping') {
                console.warn('Server echoed ping as message. Disabling ping.');
                setServerSupportsPing(false);
                return;
            }

            if (data.type === 'history_batch') {
                const messagesList = Array.isArray(data.messages) ? data.messages : [];
                const newHistory = messagesList
                    .filter((msg: any) => msg.type !== 'ping')
                    .map((msg: any) => ({
                    id: msg.id || Date.now().toString(),
                    content: msg.content || '',
                    sender_id: msg.sender_id || 'unknown',
                    receiver_id: msg.receiver_id || 'broadcast',
                    created_at: msg.created_at || new Date().toISOString(),
                    is_read: false,
                    sender: msg.sender || { username: 'Unknown' },
                    ...msg
                }));

                setMessages(prev => {
                    const existingIds = new Set(prev.map(m => m.id));
                    const uniqueHistory = newHistory.filter((m: any) => !existingIds.has(m.id));
                    return [...uniqueHistory, ...prev];
                });
                setIsLoadingMore(false);
                return;
            }

            if (data.type === 'history_end') {
                setHasMoreMessages(false);
                setIsLoadingMore(false);
                return;
            }

            if (data.type === 'typing_update') {
                setTypingUsers(prev => {
                    const next = new Set(prev);
                    const name = data.username || 'Alguém';
                    if (data.isTyping) {
                        next.add(name);
                    } else {
                        next.delete(name);
                    }
                    return next;
                });
                return;
            }

            if (data.type === 'system') {
                // Handle system messages if needed
                return;
            }

            if (data.type === 'users_list') {
                const newUsers = new Map();
                if (Array.isArray(data.users)) {
                    data.users.forEach((u: any) => {
                        if (u.id !== user.id) {
                            newUsers.set(u.id, u);
                        }
                    });
                }
                setOtherUsers(newUsers);
                return;
            }

            if (data.type === 'user_status') {
                setOtherUsers(prev => {
                    const next = new Map(prev);
                    if (data.userId !== user.id) {
                         if (data.status === 'online') {
                             next.set(data.userId, { ...data.user, is_online: true });
                         } else {
                             const existing = next.get(data.userId);
                             if (existing) {
                                 next.set(data.userId, { ...existing, is_online: false, last_seen: data.last_seen });
                             } else {
                                 next.set(data.userId, { id: data.userId, username: 'User', ...data.user, is_online: false, last_seen: data.last_seen } as any);
                             }
                         }
                    }
                    return next;
                });
                return;
            }

            if (data.type === 'edit') {
                setMessages(prev => prev.map(msg => {
                    if (msg.id === data.id) {
                        return {
                            ...msg,
                            content: data.content,
                            is_edited: true
                        };
                    }
                    return msg;
                }));
                return;
            }

            if (data.type === 'delete') {
                setMessages(prev => prev.map(msg => {
                    if (msg.id === data.id) {
                        return {
                            ...msg,
                            deleted_at: data.deleted_at
                        };
                    }
                    return msg;
                }));
                return;
            }

            if (data.type === 'reaction_update') {
                setMessages(prev => prev.map(msg => {
                    if (msg.id === data.messageId) {
                        return {
                            ...msg,
                            reactions: data.reactions
                        };
                    }
                    return msg;
                }));
                return;
            }

            if (data.type === 'read_update') {
                setMessages(prev => prev.map(msg => {
                    if (msg.id === data.messageId) {
                        return { ...msg, is_read: true };
                    }
                    return msg;
                }));
                return;
            }

            // Assume it's a chat message
            // Ensure it looks like a Message
            const newMessage: Message = {
                id: data.id || Date.now().toString(),
                content: data.content || '',
                sender_id: data.sender_id || 'unknown',
                receiver_id: data.receiver_id || 'broadcast', // WebSocket is broadcast
                created_at: data.created_at || new Date().toISOString(),
                is_read: false,
                sender: data.sender || { username: 'Unknown' }, // Fallback
                ...data
            };
            
            setMessages(prev => {
                // Avoid duplicates
                if (prev.some(m => m.id === newMessage.id)) return prev;
                return [...prev, newMessage];
            });

          } catch (e) {
            console.error('Error parsing WS message:', e);
          }
        };

        ws.onclose = () => {
          console.log('WebSocket Disconnected');
          setIsConnected(false);
          // Try to reconnect after a delay
          setTimeout(() => {
              if (wsRef.current === null || wsRef.current.readyState === WebSocket.CLOSED) {
                  connectWebSocket();
              }
          }, 3000);
        };

        ws.onerror = (error) => {
          console.error('WebSocket Error:', error);
          setConnectionError(true);
        };

        wsRef.current = ws;
      } catch (e) {
        console.error('WebSocket connection failed:', e);
        setConnectionError(true);
      }
    };

    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [user]);

  // Ping interval
  useEffect(() => {
    if (!isConnected || !serverSupportsPing) return;
    
    const interval = setInterval(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                type: 'ping',
                timestamp: Date.now()
            }));
        }
    }, 2000);

    return () => clearInterval(interval);
  }, [isConnected, serverSupportsPing]);

  // Auto-scroll logic (updated to handle history loading)
  useEffect(() => {
    if (messages.length === 0) return;
    const lastMsg = messages[messages.length - 1];
    
    // Only scroll if the last message is different (new message arrived or sent)
    // This prevents scrolling to bottom when loading old history (prepending)
    if (lastMessageIdRef.current !== lastMsg.id) {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        lastMessageIdRef.current = lastMsg.id;
    }
  }, [messages]);

  // Infinite Scroll Handler
  useEffect(() => {
    // Find the viewport element inside ScrollArea (Radix UI structure)
    const scrollContainer = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement;
    
    if (!scrollContainer) return;
    scrollViewportRef.current = scrollContainer;

    const handleScroll = () => {
        // Check if scrolled to top
        if (scrollContainer.scrollTop < 10 && !isLoadingMore && hasMoreMessages && messages.length >= 20) {
            setIsLoadingMore(true);
            const oldestMessage = messages[0];
            
            if (oldestMessage) {
                console.log('Loading more messages before:', oldestMessage.created_at);
                wsRef.current?.send(JSON.stringify({
                    type: 'load_more',
                    lastTimestamp: oldestMessage.created_at
                }));
            }
        }
    };

    scrollContainer.addEventListener('scroll', handleScroll);
    return () => scrollContainer.removeEventListener('scroll', handleScroll);
  }, [messages, isLoadingMore, hasMoreMessages]);

  // Mark unread messages as read
  useEffect(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN || !user) return;
    
    // Only mark as read if visible
    if (!isVisible) return;

    const unreadMessages = messages.filter(m => !m.is_read && m.sender_id !== user.id);
    unreadMessages.forEach(msg => {
        if (!processedReadIds.current.has(msg.id)) {
            processedReadIds.current.add(msg.id);
            wsRef.current?.send(JSON.stringify({
                type: 'mark_read',
                messageId: msg.id
            }));
        }
    });
  }, [messages, user, isConnected, isVisible]);

  // Timer for "last seen"
  useEffect(() => {
    const partner = Array.from(otherUsers.values())[0];
    if (!partner || partner.is_online) {
        setTimeAgo('');
        return;
    }

    const updateTime = () => {
        if (!partner.last_seen) return;
        const lastSeenDate = new Date(partner.last_seen);
        if (isNaN(lastSeenDate.getTime())) return;
        
        const diff = new Date().getTime() - lastSeenDate.getTime();
        const totalMinutes = Math.floor(diff / 60000);

        if (totalMinutes >= 60) {
            const hours = Math.floor(totalMinutes / 60);
            const minutes = totalMinutes % 60;
            setTimeAgo(`Visto por último há ${hours} h ${minutes} min`);
        } else {
            const seconds = Math.floor((diff % 60000) / 1000);
            setTimeAgo(`Visto por último há ${totalMinutes} min ${seconds} s`);
        }
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [otherUsers]);

  const handleReaction = (messageId: string, emoji: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN || !user) return;

    const message = messages.find(m => m.id === messageId);
    if (!message) return;

    const reactions = (message as any).reactions || [];
    const existingReaction = reactions.find((r: any) => r.user_id === user.id && r.emoji === emoji);
    const action = existingReaction ? 'remove' : 'add';

    // Optimistic update
    setMessages(prev => prev.map(m => {
        if (m.id === messageId) {
            let newReactions = m.reactions ? [...m.reactions] : [];
            if (action === 'add') {
                 newReactions.push({
                     id: `temp-${Date.now()}`,
                     message_id: messageId,
                     user_id: user.id,
                     emoji,
                     created_at: new Date().toISOString()
                 } as any);
            } else {
                 newReactions = newReactions.filter((r: any) => !(r.user_id === user.id && r.emoji === emoji));
            }
            return { ...m, reactions: newReactions };
        }
        return m;
    }));

    wsRef.current.send(JSON.stringify({
        type: 'reaction',
        messageId,
        userId: user.id,
        emoji,
        action
    }));
  };

  const sendGlobalPush = async () => {
    try {
      setPushSending(true);
      const res = await fetch('/api/send-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Notificação', body: 'Iasmin', url: '/chat2' })
      });
      const data = await res.json();
      setPushSendStats(data);
      toast.success('Notificação enviada com sucesso!');
    } catch {
      setPushSendStats(null);
      toast.error('Erro ao enviar notificação');
    } finally {
      setPushSending(false);
    }
  };

  const handleStartTyping = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN || !user) return;
    
    wsRef.current.send(JSON.stringify({
        type: 'typing_start',
        userId: user.id,
        username: user.username
    }));
  };

  const handleStopTyping = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN || !user) return;
    
    wsRef.current.send(JSON.stringify({
        type: 'typing_stop',
        userId: user.id,
        username: user.username
    }));
  };

  const handleSendMessage = async (
    content: string, 
    imageData?: string, 
    audioData?: string, 
    audioDuration?: number, 
    replyToId?: string, 
    videoPath?: string, 
    videoDuration?: number, 
    videoThumbnail?: string, 
    viewOnce?: boolean
  ) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        toast.error('Not connected to chat server');
        return;
    }
    if (!user) return;

    // Construct message
    const replyMessage = replyToId ? messages.find(m => m.id === replyToId) : undefined;

    const newMessage: Partial<Message> = {
        type: 'chat', // Explicitly set type
        id: Date.now().toString(),
        content: content,
        sender_id: user.id,
        receiver_id: 'broadcast', // Broadcast to all
        created_at: new Date().toISOString(),
        is_read: false,
        sender: user,
        has_image: !!imageData,
        image_data: imageData,
        has_audio: !!audioData,
        audio_data: audioData,
        audio_duration: audioDuration,
        reply_to_id: replyToId,
        reply_to: replyMessage,
        has_video: !!videoPath,
        video_storage_path: videoPath,
        video_duration: videoDuration,
        video_thumbnail: videoThumbnail,
        view_once: viewOnce
    };

    // Optimistic update
    setMessages(prev => [...prev, newMessage as Message]);

    // Send to WebSocket
    wsRef.current.send(JSON.stringify(newMessage));
  };

  const handleEditMessage = (messageId: string, newContent: string) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
          toast.error('Not connected to chat server');
          return;
      }

      // Optimistic update
      setMessages(prev => prev.map(msg => {
          if (msg.id === messageId) {
              return { ...msg, content: newContent, is_edited: true };
          }
          return msg;
      }));

      // Send edit event to WebSocket
      wsRef.current.send(JSON.stringify({
          type: 'edit',
          id: messageId,
          content: newContent
      }));
  };

  const handleDeleteMessage = (messageId: string) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
          toast.error('Not connected to chat server');
          return;
      }

      // Optimistic update
      setMessages(prev => prev.map(msg => {
          if (msg.id === messageId) {
              return { ...msg, deleted_at: new Date().toISOString() };
          }
          return msg;
      }));

      // Send delete event to WebSocket
      wsRef.current.send(JSON.stringify({
          type: 'delete',
          id: messageId
      }));
  };

  const handleReplyMessage = (message: Message) => {
      setReplyingTo(message);
  };

  const handleCancelReply = () => {
      setReplyingTo(null);
  };

  if (!user) {
      return (
          <div className="h-full flex items-center justify-center text-white">
              <div className="text-center p-4">
                  <h2 className="text-xl mb-2">User Not Found</h2>
                  <p>Please set 'chatapp_user' in localStorage.</p>
              </div>
          </div>
      );
  }

  return (
    <div className="flex flex-col h-full bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-2 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 h-8">
        <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            {ping !== null && isConnected && (
                <span className="text-[9px] text-muted-foreground font-mono">{ping}ms</span>
            )}
            {Array.from(otherUsers.values())[0] && (
                <div className={`w-1.5 h-1.5 rounded-full ${Array.from(otherUsers.values())[0].is_online ? 'bg-green-500' : 'bg-zinc-400'}`} />
            )}
            <div className="flex items-center gap-1.5">
                <span className="font-semibold text-xs text-foreground">{user.username}</span>
                {typingUsers.size > 0 ? (
                    <span className="text-[10px] text-primary animate-pulse flex items-center gap-1">
                        <Loader2 className="h-2.5 w-2.5 animate-spin" />
                        {Array.from(typingUsers).join(', ')} digitando...
                    </span>
                ) : (
                    Array.from(otherUsers.values())[0] && (
                        <span className="text-[10px] text-muted-foreground">
                            • {Array.from(otherUsers.values())[0].is_online 
                                ? 'Online' 
                                : timeAgo}
                        </span>
                    )
                )}
            </div>
        </div>
        <div className="flex items-center gap-1">
            <Button
               variant="ghost"
               size="icon"
               onClick={sendGlobalPush}
               className="relative h-6 w-6"
               title={pushSending ? 'Enviando...' : 'Enviar notificação global'}
             >
               {pushSending ? (
                 <Bell className="h-3 w-3 text-pink-500 animate-pulse" />
               ) : (
                 <Bell className="h-3 w-3 text-pink-500" />
               )}
             </Button>
             {pushSendStats && (
                <span className="text-[9px] text-muted-foreground">Enviadas: {pushSendStats.sent}/{pushSendStats.total}</span>
             )}
             {!isConnected && <WifiOff className="text-destructive w-4 h-4" />}
        </div>
      </div>

      {/* Messages Area */}
      <ScrollArea className="flex-1 p-2 mt-8" ref={scrollAreaRef}>
        <div className="flex flex-col gap-4 min-h-0">
          {messages.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground min-h-[200px]">
              No messages yet. Say hello!
            </div>
          ) : (
            messages.map((msg) => (
              <ChatBubble
                key={msg.id}
                message={msg}
                isOwn={msg.sender_id === user.id}
                currentUserId={user.id}
                onReply={handleReplyMessage}
                onDelete={handleDeleteMessage}
                onEdit={handleEditMessage}
                onReaction={(emoji) => handleReaction(msg.id, emoji)}
                reactions={(msg as any).reactions}
                onScrollToMessage={() => {}}
                downloadOnDemand={true}
              />
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="bg-background">
        <MessageInput 
            onSendMessage={handleSendMessage}
            disabled={!isConnected}
            userId={user.id}
            onStartTyping={handleStartTyping} 
            onStopTyping={handleStopTyping}
            replyingTo={replyingTo}
            onCancelReply={handleCancelReply}
            onActionToggle={() => {
              // Scroll to bottom after a small delay to allow transition to start/finish
              setTimeout(() => {
                messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
              }, 100);
            }}
        />
      </div>
    </div>
  );
};
