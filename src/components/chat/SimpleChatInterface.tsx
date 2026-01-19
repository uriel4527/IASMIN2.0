import React, { useState, useEffect, useRef } from 'react';
import { supabase, Message, User } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/hooks/useNotifications';
import { useMessageCleanup } from '@/hooks/useMessageCleanup';
import { useTypingStatus } from '@/hooks/useTypingStatus';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useNativeLinkHandler } from '@/hooks/useNativeLinkHandler';
import { ChatBubble } from './ChatBubble';
import { MessageInput } from './MessageInput';
import { TypingIndicator } from './TypingIndicator';
import { NewMessageNotification } from './NewMessageNotification';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getPlatformInfo } from '@/utils/linkUtils';
import { toast } from 'sonner';

import { LogOut, MessageCircle, Bell, BellOff } from 'lucide-react';
export const SimpleChatInterface: React.FC = () => {
  const {
    user,
    logout
  } = useAuth();
  const {
    cleanupOldMessages,
    isCleaningUp
  } = useMessageCleanup();
  const { permission, requestPermission, registerPushSubscription, getPushSubscription } = useNotifications();
  const [messages, setMessages] = useState<Message[]>([]);
  const [otherUser, setOtherUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const subscriptionsRef = useRef<any[]>([]);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const isPrependingRef = useRef<boolean>(false);
  const PAGE_SIZE = 30;
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [lastMessageCount, setLastMessageCount] = useState(0);
  const [showNewMessageNotification, setShowNewMessageNotification] = useState(false);
  const [pendingMessagesCount, setPendingMessagesCount] = useState(0);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const [pushSending, setPushSending] = useState(false);
  const [pushSendStats, setPushSendStats] = useState<{ sent: number; failed: number; total: number } | null>(null);
  
  // Refs for reliable real-time state tracking
  const isUserScrollingRef = useRef(false);
  const atBottomRef = useRef(false);

  // Get the other user (Sr or Sr1)
  const getOtherUserId = () => {
    if (!user) return null;
    return user.username === 'Sr' ? '22222222-2222-2222-2222-222222222222' // Sr1's ID
    : '11111111-1111-1111-1111-111111111111'; // Sr's ID
  };
  const syncLatestMessages = async () => {
    if (!user || !otherUser || messages.length === 0) return;
    const lastTs = messages[messages.length - 1]?.created_at;
    if (!lastTs) return;
    try {
      const selectBase = `
        *,
        sender:users!messages_sender_id_fkey(*),
        receiver:users!messages_receiver_id_fkey(*)
      `;
      const res = await supabase
        .from('messages')
        .select(selectBase)
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${otherUser.id}),and(sender_id.eq.${otherUser.id},receiver_id.eq.${user.id})`)
        .gt('created_at', lastTs)
        .order('created_at', { ascending: true })
        .limit(PAGE_SIZE);
      if (res.error) return;
      const newItems = (res.data as any[]) as Message[];
      if (!newItems || newItems.length === 0) return;
      const hydrated = await hydrateReplies(newItems);
      setMessages(prev => {
        const existingIds = new Set(prev.map(m => m.id));
        const merged = [...prev, ...hydrated.filter(m => !existingIds.has(m.id))];
        return merged;
      });
    } catch {}
  };

  // Hook para gerenciar typing status
  const {
    otherUserTyping,
    startTyping,
    stopTyping
  } = useTypingStatus(user?.id || '', getOtherUserId() || '');

  // Hook para gerenciar status online
  const {
    isUserOnline,
    getLastSeenInfo
  } = useOnlineStatus(user?.id || '');

  // Hook para gerenciar abertura de links nativos
  const { openLink } = useNativeLinkHandler();

  // Estado para informações de último acesso
  const [lastSeenInfo, setLastSeenInfo] = useState<{
    last_seen_formatted: string;
    is_online: boolean;
  } | null>(null);
  const scrollToBottom = (instant: boolean = false) => {
    const container = messagesContainerRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior: instant ? 'auto' : 'smooth' });
  };

  const scrollToMessage = (messageId: string) => {
    const messageElement = document.getElementById(`message-${messageId}`);
    if (messageElement) {
      messageElement.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center' 
      });
      
      // Destaque a mensagem
      setHighlightedMessageId(messageId);
      
      // Remove o destaque após 2 segundos
      setTimeout(() => {
        setHighlightedMessageId(null);
      }, 2000);
    }
  };

  useEffect(() => {
    if (user) {
      // Parallelize data loading for better performance
      Promise.all([
        loadOtherUser(),
        loadMessages()
      ]).catch(error => {
        console.error('Error loading initial data:', error);
      });
    }
  }, [user]);

  // Log when otherUser becomes available to track timing
  useEffect(() => {
    if (otherUser) {
      console.log('👤 otherUser loaded:', otherUser.username, '- subscriptions will be set up now');
    }
  }, [otherUser]);

  // Auto-scroll to bottom after initial messages load
  useEffect(() => {
    if (!loading && messages.length > 0) {
      console.log('📍 Initial load complete, scrolling to bottom');
      scrollToBottom(true); // Instant scroll for initial load
    }
  }, [loading, messages.length]);

  // Carregar informações de último acesso quando otherUser estiver disponível
  useEffect(() => {
    if (otherUser?.id && getLastSeenInfo) {
      loadLastSeenInfo();
      // Reduzir frequência para 5 minutos para evitar sobrecarga
      const interval = setInterval(loadLastSeenInfo, 300000);
      return () => clearInterval(interval);
    }
  }, [otherUser?.id, getLastSeenInfo]);

  // Check push notification status on mount
  useEffect(() => {
    const checkPushStatus = async () => {
      if (!user) return;
      
      try {
        const { data } = await supabase
          .from('push_subscriptions')
          .select('is_active')
          .eq('user_id', user.id)
          .single();
        
        setPushEnabled(data?.is_active || false);
      } catch (error) {
        console.error('Error checking push status:', error);
      }
    };
    
    checkPushStatus();
  }, [user]);


  const loadLastSeenInfo = async () => {
    if (!otherUser?.id || !getLastSeenInfo) return;
    
    try {
      const info = await getLastSeenInfo(otherUser.id);
      if (info) {
        setLastSeenInfo({
          last_seen_formatted: info.last_seen_formatted,
          is_online: info.is_online
        });
      }
    } catch (error) {
      console.error('Error loading last seen info:', error);
    }
  };
  
  // Helper: Instagram URL mapping per user (by ID with normalized username fallback)
  const getInstagramUrlForUser = (u: User | null): string | null => {
    if (!u) return null;
    // Prefer stable IDs
    if (u.id === '22222222-2222-2222-2222-222222222222') return 'https://www.instagram.com/iasmin_.mrts/';
    if (u.id === '11111111-1111-1111-1111-111111111111') return 'https://www.instagram.com/urielmoretti/';
    // Fallback by normalized username
    const uname = (u.username || '').toLowerCase();
    if (uname === 'sr1' || uname === 'iasm') return 'https://www.instagram.com/iasmin_.mrts/';
    if (uname === 'sr') return 'https://www.instagram.com/urielmoretti/';
    return null;
  };
  
  // Setup realtime subscriptions when both user and otherUser are available
  useEffect(() => {
    if (user && otherUser) {
      console.log('🔧 Setting up subscriptions for user:', user.id, 'and otherUser:', otherUser.id);
      const cleanup = setupRealtimeSubscriptions();
      return () => {
        if (cleanup) cleanup();
        // Clean up any remaining subscriptions
        subscriptionsRef.current.forEach(sub => {
          if (sub?.unsubscribe) sub.unsubscribe();
        });
        subscriptionsRef.current = [];
      };
    }
  }, [user, otherUser]);
  // Check if user is near bottom of chat - immediate calculation
  const checkIsNearBottomNow = () => {
    const container = messagesContainerRef.current;
    if (!container) return false;
    
    const { scrollTop, scrollHeight, clientHeight } = container;
    const scrollBottom = scrollHeight - scrollTop - clientHeight;
    return scrollBottom < 20; // Tight threshold to avoid false positives
  };

  // Handle scroll to bottom (from notification click or manual)
  const handleScrollToBottom = () => {
    scrollToBottom();
    setShowNewMessageNotification(false);
    setPendingMessagesCount(0);
  };

  // Setup intersection observer for bottom detection (within scroll container)
  useEffect(() => {
    const messagesEnd = messagesEndRef.current;
    const container = messagesContainerRef.current;
    if (!messagesEnd || !container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const isAtBottom = entries[0].isIntersecting;
        atBottomRef.current = isAtBottom;
        
        // Clear notifications when user reaches bottom
        if (isAtBottom && showNewMessageNotification) {
          console.log('🎯 User reached bottom via intersection observer - clearing notifications');
          setShowNewMessageNotification(false);
          setPendingMessagesCount(0);
        }
      },
      { root: container, threshold: 0.01 }
    );

    observer.observe(messagesEnd);
    return () => observer.disconnect();
  }, [showNewMessageNotification]);

  // Handle scroll events for user scrolling detection only
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    let scrollTimeout: NodeJS.Timeout;

    const handleScroll = () => {
      isUserScrollingRef.current = true;
      setIsUserScrolling(true);
      
      const nearBottom = checkIsNearBottomNow();
      setIsNearBottom(nearBottom);

      // Clear scrolling state after scroll ends
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        isUserScrollingRef.current = false;
        setIsUserScrolling(false);
      }, 150);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', handleScroll);
      clearTimeout(scrollTimeout);
    };
  }, []); // Empty dependency to avoid re-attachments

  // Intelligent auto-scroll with immediate position calculation
  useEffect(() => {
    if (isPrependingRef.current) return;
    
    const wasNewMessageAdded = messages.length > lastMessageCount;
    const lastMessage = messages[messages.length - 1];
    
    if (wasNewMessageAdded && lastMessage) {
      const isMyMessage = lastMessage.sender_id === user?.id;
      
      // Calculate position immediately to avoid stale state
      const nearBottomNow = checkIsNearBottomNow();
      const isScrollingNow = isUserScrollingRef.current;
      const atBottomNow = atBottomRef.current;
      
      console.log('🚀 Auto-scroll check (real-time):', {
        isMyMessage,
        nearBottomNow,
        isScrollingNow,
        atBottomNow,
        messageId: lastMessage.id,
        sender: lastMessage.sender?.username
      });
      
      // Unified auto-scroll logic for both own and received messages
      const shouldAutoScroll = atBottomNow && !isScrollingNow;
      
      if (shouldAutoScroll) {
        console.log('✅ Auto-scrolling - user at bottom, not scrolling');
        scrollToBottom();
        // Clear notification if it was showing
        if (showNewMessageNotification) {
          setShowNewMessageNotification(false);
          setPendingMessagesCount(0);
        }
      } else {
        // Show notification instead of auto-scrolling
        const notificationMessage = isMyMessage 
          ? 'own message - user reading history' 
          : 'received message - user not at bottom';
        console.log(`📱 Showing notification for ${notificationMessage}`);
        setShowNewMessageNotification(true);
        setPendingMessagesCount(prev => prev + 1);
      }
    }
    
    setLastMessageCount(messages.length);
  }, [messages, lastMessageCount, user?.id, showNewMessageNotification]);
  const loadOtherUser = async () => {
    const otherUserId = getOtherUserId();
    if (!otherUserId) return;
    try {
      const {
        data,
        error
      } = await supabase.from('users').select('*').eq('id', otherUserId).single();
      if (error) {
        // If user doesn't exist, create it
        const otherUsername = user?.username === 'Sr' ? 'Sr1' : 'Sr';
        const otherEmail = user?.username === 'Sr' ? 'sr1@chat.com' : 'sr@chat.com';
        const {
          data: newUser,
          error: insertError
        } = await supabase.from('users').insert({
          id: otherUserId,
          email: otherEmail,
          username: otherUsername,
          created_at: new Date().toISOString(),
          last_seen: new Date().toISOString(),
          is_online: false
        }).select().single();
        if (insertError) throw insertError;
        setOtherUser(newUser);
      } else {
        setOtherUser(data);
      }
    } catch (error) {
      console.error('Error loading other user:', error);
    }
  };
  const setupRealtimeSubscriptions = () => {
    if (!user || !otherUser) return;
    const otherUserId = otherUser.id;
    console.log('🚀 Setting up realtime subscriptions for user:', user.id, 'and other user:', otherUserId);

    // Create a unique channel name to avoid conflicts
    const channelName = `chat-${Math.random().toString(36).substring(7)}`;

    // Helper function to get sender data with retry
    const getSenderDataWithRetry = async (senderId: string, maxRetries = 3): Promise<User> => {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`🔍 Fetching sender data for ${senderId}, attempt ${attempt}`);
          const { data: senderData, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', senderId)
            .single();
          
          if (error) throw error;
          if (senderData) {
            console.log('✅ Sender data fetched successfully:', senderData.username);
            return senderData;
          }
        } catch (error) {
          console.warn(`⚠️ Attempt ${attempt} failed to fetch sender data:`, error);
          if (attempt === maxRetries) {
            console.error('❌ All attempts failed, using fallback data');
          } else {
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, 200 * attempt));
          }
        }
      }
      
      // Fallback user data
      return {
        id: senderId,
        username: 'Unknown',
        email: '',
        created_at: '',
        last_seen: '',
        is_online: false
      };
    };

    // Subscribe to ALL message insertions (we'll filter in the callback)
    const messagesSubscription = supabase.channel(channelName)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'messages'
    }, async payload => {
      console.log('📨 Realtime message received:', payload);
      const newMessage = payload.new as Message;

      // Enhanced validation: check for data integrity issues
      if (!newMessage.id || !newMessage.sender_id || !newMessage.receiver_id) {
        console.warn('⚠️ Message missing required fields, skipping:', newMessage);
        return;
      }

      // Validate image messages have proper data
      // Reduced minimum length to 20 to support image URLs from backend
      if (newMessage.has_image && (!newMessage.image_data || newMessage.image_data.length < 20)) {
        console.warn('⚠️ Image message without valid image data, likely a failed upload:', {
          messageId: newMessage.id,
          hasImageFlag: newMessage.has_image,
          imageDataLength: newMessage.image_data?.length || 0
        });
        return; // Don't add malformed image messages to chat
      }

      // Only process messages between current user and other user
      const isRelevantMessage = 
        (newMessage.sender_id === user.id && newMessage.receiver_id === otherUser.id) || 
        (newMessage.sender_id === otherUser.id && newMessage.receiver_id === user.id);
      
      if (isRelevantMessage) {
        console.log('✅ Message is relevant, processing...');

        // Add sender information with improved fallback
        if (newMessage.sender_id === user.id) {
          newMessage.sender = user;
        } else if (otherUser && newMessage.sender_id === otherUser.id) {
          newMessage.sender = otherUser;
        } else {
          // Robust fallback: fetch sender data with retry
          newMessage.sender = await getSenderDataWithRetry(newMessage.sender_id);
        }

        // Ensure reply_to is hydrated when needed
        const hydratedArr = await hydrateReplies([newMessage]);
        const finalNewMessage = hydratedArr[0] || newMessage;

        console.log('📝 Adding message to state:', { 
          id: finalNewMessage.id, 
          content: finalNewMessage.content.substring(0, 50) + '...',
          sender: finalNewMessage.sender?.username 
        });
        
        setMessages(prev => {
          const idx = prev.findIndex(msg => msg.id === newMessage.id);
          if (idx !== -1) {
            const updated = [...prev];
            updated[idx] = { ...prev[idx], ...newMessage } as Message;
            return updated;
          }
          return [...prev, newMessage];
        });
      } else {
        console.log('❌ Message not relevant:', {
          senderId: newMessage.sender_id,
          receiverId: newMessage.receiver_id,
          currentUserId: user.id,
          otherUserId: otherUserId
        });
      }
    }).on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'messages'
    }, async payload => {
      console.log('✏️ Realtime message update received:', payload);
      const updatedMessage = payload.new as Message;

      // Only process messages between current user and other user
      const isRelevantMessage = updatedMessage.sender_id === user.id && updatedMessage.receiver_id === otherUser.id || updatedMessage.sender_id === otherUser.id && updatedMessage.receiver_id === user.id;
      if (isRelevantMessage) {
        console.log('✅ Message update is relevant, processing...');

        // Add sender information
        if (updatedMessage.sender_id === user.id) {
          updatedMessage.sender = user;
        } else if (otherUser && updatedMessage.sender_id === otherUser.id) {
          updatedMessage.sender = otherUser;
        } else {
          // Robust fallback: fetch sender data with retry
          updatedMessage.sender = await getSenderDataWithRetry(updatedMessage.sender_id);
        }

        const hydratedArr = await hydrateReplies([updatedMessage]);
        const finalUpdatedMessage = hydratedArr[0] || updatedMessage;
        console.log('✏️ Updating message in state:', finalUpdatedMessage);
        setMessages(prev => {
          const messageIndex = prev.findIndex(msg => msg.id === finalUpdatedMessage.id);
          if (messageIndex !== -1) {
            const newMessages = [...prev];
            newMessages[messageIndex] = finalUpdatedMessage;
            console.log('✅ Message updated in state');
            return newMessages;
          } else {
            console.log('⚠️ Message not found in state, adding as new');
            return [...prev, finalUpdatedMessage];
          }
        });
      } else {
        console.log('❌ Message update not relevant, ignoring');
      }
    }).subscribe(status => {
      console.log('📡 Messages subscription status:', status);
      if (status !== 'SUBSCRIBED') {
        syncLatestMessages();
      }
    });

    // Subscribe to user status changes
    const usersSubscription = supabase.channel(`users-${channelName}`).on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'users',
      filter: `id=eq.${otherUserId}`
    }, payload => {
      console.log('👤 User status update received:', payload);
      setOtherUser(payload.new as User);
      // Atualizar informações de último acesso quando o status do usuário mudar
      loadLastSeenInfo();
    }).subscribe(status => {
      console.log('👤 Users subscription status:', status);
    });

    // Subscribe to message reactions for realtime updates
    const reactionsSubscription = supabase.channel(`reactions-${channelName}`)
    .on('postgres_changes', {
      event: '*', // INSERT, UPDATE, DELETE
      schema: 'public', 
      table: 'message_reactions'
    }, payload => {
      console.log('🎭 Reaction update received:', payload);
      // Individual message components handle their own reaction updates via useReactions hook
    }).subscribe(status => {
      console.log('🎭 Reactions subscription status:', status);
    });

    // Store subscriptions for cleanup
    subscriptionsRef.current = [messagesSubscription, usersSubscription, reactionsSubscription];
    return () => {
      console.log('🧹 Cleaning up subscriptions');
      messagesSubscription.unsubscribe();
      usersSubscription.unsubscribe();
      reactionsSubscription.unsubscribe();
    };
  };
  // Helper: hydrate reply_to for messages when PostgREST relationship is missing
  const hydrateReplies = async (msgs: Message[]): Promise<Message[]> => {
    try {
      const ids = Array.from(new Set(
        msgs
          .filter(m => m.reply_to_id && !m.reply_to)
          .map(m => m.reply_to_id as string)
      ));
      if (ids.length === 0) return msgs;
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          sender:users!messages_sender_id_fkey(*)
        `)
        .in('id', ids);
      if (error) {
        console.error('Error hydrating replies:', error);
        return msgs;
      }
      const map = new Map((data as any[]).map((m: any) => [m.id, m]));
      return msgs.map(m => (m.reply_to_id && !m.reply_to)
        ? { ...m, reply_to: map.get(m.reply_to_id) }
        : m
      );
    } catch (e) {
      console.error('Unexpected error hydrating replies:', e);
      return msgs;
    }
  };
  const loadMessages = async () => {
    if (!user) return;
    const otherUserId = getOtherUserId();
    if (!otherUserId) return;
    try {
      const selectWithReply = `
        *,
        sender:users!messages_sender_id_fkey(*),
        receiver:users!messages_receiver_id_fkey(*),
        reply_to:messages!messages_reply_to_id_fkey(
          *,
          sender:users!messages_sender_id_fkey(*)
        )
      `;
      const selectBase = `
        *,
        sender:users!messages_sender_id_fkey(*),
        receiver:users!messages_receiver_id_fkey(*)
      `;
      let data: any[] | null = null;

      // First try with reply_to relationship
      const res = await supabase.from('messages').select(selectWithReply).or(`and(sender_id.eq.${user.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${user.id})`).order('created_at', {
        ascending: false
      }).limit(PAGE_SIZE);
      if (res.error) {
        const e: any = res.error as any;
        const relationMissing = e?.code === 'PGRST200' || String(e?.message || '').includes('relationship') || String(e?.details || '').includes('messages_reply_to_id_fkey');
        if (relationMissing) {
          console.warn('reply_to relationship missing, falling back to base select');
          const res2 = await supabase.from('messages').select(selectBase).or(`and(sender_id.eq.${user.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${user.id})`).order('created_at', {
            ascending: false
          }).limit(PAGE_SIZE);
          if (res2.error) throw res2.error;
          data = res2.data as any[];
        } else {
          throw res.error;
        }
      } else {
        data = res.data as any[];
      }
      const hydrated = await hydrateReplies((data || []) as Message[]);
      const initial = (hydrated || []).reverse();
      setMessages(initial);
      setHasMore((data || []).length === PAGE_SIZE);
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  };
  const loadMoreMessages = async () => {
    if (!user) return;
    if (loadingMore || !hasMore) return;
    const el = messagesContainerRef.current;
    const prevScrollHeight = el?.scrollHeight || 0;
    const earliest = messages[0]?.created_at;
    if (!earliest) return;
    try {
      setLoadingMore(true);
      const selectWithReply = `
        *,
        sender:users!messages_sender_id_fkey(*),
        receiver:users!messages_receiver_id_fkey(*),
        reply_to:messages!messages_reply_to_id_fkey(
          *,
          sender:users!messages_sender_id_fkey(*)
        )
      `;
      const selectBase = `
        *,
        sender:users!messages_sender_id_fkey(*),
        receiver:users!messages_receiver_id_fkey(*)
      `;
      let data: any[] | null = null;

      // First try with reply_to relationship
      const res = await supabase.from('messages').select(selectWithReply).or(`and(sender_id.eq.${user.id},receiver_id.eq.${getOtherUserId()}),and(sender_id.eq.${getOtherUserId()},receiver_id.eq.${user.id})`).lt('created_at', earliest).order('created_at', {
        ascending: false
      }).limit(PAGE_SIZE);
      if (res.error) {
        const e: any = res.error as any;
        const relationMissing = e?.code === 'PGRST200' || String(e?.message || '').includes('relationship') || String(e?.details || '').includes('messages_reply_to_id_fkey');
        if (relationMissing) {
          console.warn('reply_to relationship missing on paginated load, falling back to base select');
          const res2 = await supabase.from('messages').select(selectBase).or(`and(sender_id.eq.${user.id},receiver_id.eq.${getOtherUserId()}),and(sender_id.eq.${getOtherUserId()},receiver_id.eq.${user.id})`).lt('created_at', earliest).order('created_at', {
            ascending: false
          }).limit(PAGE_SIZE);
          if (res2.error) throw res2.error;
          data = res2.data as any[];
        } else {
          throw res.error;
        }
      } else {
        data = res.data as any[];
      }
      const hydrated = await hydrateReplies((data || []) as Message[]);
      const chunkAsc = (hydrated || []).reverse();
      if (chunkAsc.length === 0) {
        setHasMore(false);
        return;
      }
      isPrependingRef.current = true;
      setMessages(prev => [...chunkAsc, ...prev]);
      requestAnimationFrame(() => {
        const newScrollHeight = el?.scrollHeight || 0;
        if (el) el.scrollTop = newScrollHeight - prevScrollHeight;
        isPrependingRef.current = false;
      });
      if ((data || []).length < PAGE_SIZE) setHasMore(false);
    } catch (err) {
      console.error('Error loading more messages:', err);
    } finally {
      setLoadingMore(false);
    }
  };
  const handleMessagesScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    if (target.scrollTop <= 60 && hasMore && !loadingMore) {
      loadMoreMessages();
    }
  };
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const deleteMessage = async (messageId: string) => {
    try {
      console.log('🗑️ Starting message deletion for:', messageId);
      
      // First, get the message to check if it has a video
      const { data: message, error: fetchError } = await supabase
        .from('messages')
        .select('has_video, video_storage_path')
        .eq('id', messageId)
        .eq('sender_id', user?.id)
        .single();

      if (fetchError) {
        console.error('❌ Error fetching message for deletion:', fetchError);
        throw fetchError;
      }

      console.log('📋 Message data for deletion:', message);

      // If message has a video, delete it from storage first
      if (message?.has_video && message?.video_storage_path) {
        // Skip if it's a full URL (backend upload)
        if (message.video_storage_path.startsWith('http')) {
             console.log('ℹ️ Skipping storage deletion for external URL:', message.video_storage_path);
        } else {
            console.log('🗑️ Deleting video from storage:', message.video_storage_path);
            
            const { error: storageError } = await supabase.storage
            .from('chat-videos')
            .remove([message.video_storage_path]);
            
            if (storageError) {
            console.error('❌ Error deleting video from storage:', storageError);
            // Continue with message deletion even if storage deletion fails
            } else {
            console.log('✅ Video deleted from storage successfully');
            }
        }
      }

      // Delete the message (mark as deleted)
      console.log('🗑️ Marking message as deleted in database');
      const { error } = await supabase.from('messages').update({
        deleted_at: new Date().toISOString(),
        content: '[Mensagem excluída]'
      }).eq('id', messageId).eq('sender_id', user?.id);
      
      if (error) {
        console.error('❌ Error marking message as deleted:', error);
        throw error;
      }
      
      console.log('✅ Message deletion completed successfully');
      
    } catch (error) {
      console.error('❌ Error in deleteMessage:', error);
    }
  };
  const editMessage = async (messageId: string, newContent: string) => {
    try {
      const {
        error
      } = await supabase.from('messages').update({
        content: newContent,
        edited_at: new Date().toISOString()
      }).eq('id', messageId).eq('sender_id', user?.id);
      if (error) throw error;
    } catch (error) {
      console.error('Error editing message:', error);
    }
  };
  const sendGlobalPush = async () => {
    try {
      setPushSending(true);
      const res = await fetch('/api/send-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Notificação', body: 'Iasmin', url: '/chat' })
      });
      const data = await res.json();
      setPushSendStats(data);
    } catch {
      setPushSendStats(null);
    } finally {
      setPushSending(false);
    }
  };
  
  const handleTogglePushNotifications = async () => {
    // IMPORTANTE: Gere suas VAPID keys com: npx web-push generate-vapid-keys
    // Configure as 3 keys (PUBLIC, PRIVATE, EMAIL) como secrets na Edge Function
    const VAPID_PUBLIC_KEY = 'BNCiMZRUNS9EXK67XmH0L0IuBvX_-59N3UTl2JVupiDz5Wr5GiIJHdrJxvTc5qrXZQrBdWnXzjGuYFUyLHkbmvU'; // Substitua pela sua chave pública
    
    if (!pushEnabled) {
      try {
        console.log('🚀 Ativando notificações push...');
        
        // Request permission
        console.log('📋 Solicitando permissão...');
        const granted = await requestPermission();
        if (!granted) {
          console.error('❌ Permissão negada');
          toast.error('Permissão para notificações negada');
          return;
        }
        console.log('✅ Permissão concedida');

        // Register push subscription (now includes backend registration)
        console.log('📝 Registrando subscription (navegador + backend)...');
        const registered = await registerPushSubscription(VAPID_PUBLIC_KEY, user?.id);
        if (!registered) {
          console.error('❌ Falha ao registrar');
          toast.error('Erro ao registrar notificações');
          return;
        }
        console.log('✅ Subscription registrada com sucesso');

        setPushEnabled(true);
        toast.success('Notificações push ativadas!');
      } catch (error) {
        console.error('❌ Erro ao ativar push:', error);
        if (error instanceof Error) {
          console.error('Detalhes:', error.message);
        }
        toast.error('Erro ao ativar notificações push');
      }
    } else {
      try {
        console.log('🔕 Desativando notificações push...');
        // Unregister
        const { error } = await supabase.functions.invoke('push-notification/unregister', {
          body: { userId: user?.id }
        });

        if (error) throw error;

        setPushEnabled(false);
        toast.success('Notificações push desativadas');
        console.log('✅ Notificações desativadas');
      } catch (error) {
        console.error('❌ Erro ao desativar push:', error);
        toast.error('Erro ao desativar notificações push');
      }
    }
  };

  const sendMessage = async (content: string, imageData?: string, audioData?: string, audioDuration?: number, replyToId?: string, videoPath?: string, videoDuration?: number, videoThumbnail?: string, viewOnce?: boolean) => {
    if (!user || !otherUser) return;
    try {
      const messageData: any = {
        content,
        sender_id: user.id,
        receiver_id: otherUser.id,
        created_at: new Date().toISOString(),
        is_read: false,
        reply_to_id: replyToId || null
      };
      if (imageData) {
        messageData.image_data = imageData;
        messageData.has_image = true;
      }
      if (audioData) {
        messageData.audio_data = audioData;
        messageData.has_audio = true;
        messageData.audio_duration = audioDuration;
      }
      if (videoPath) {
        messageData.video_storage_path = videoPath;
        messageData.has_video = true;
        messageData.video_duration = videoDuration;
        messageData.video_thumbnail = videoThumbnail;
        messageData.view_once = viewOnce || false;
      }
      const selectRelations = `
        *,
        sender:users!messages_sender_id_fkey(*),
        receiver:users!messages_receiver_id_fkey(*),
        reply_to:messages!messages_reply_to_id_fkey(
          *,
          sender:users!messages_sender_id_fkey(*)
        )
      `;
      const res = await supabase
        .from('messages')
        .insert(messageData)
        .select(selectRelations)
        .single();
      if (res.error) {
        const e: any = res.error as any;
        const relationMissing = e?.code === 'PGRST200' || String(e?.message || '').includes('relationship');
        if (relationMissing) {
          const res2 = await supabase
            .from('messages')
            .insert(messageData)
            .select('*')
            .single();
          if (res2.error) {
            if (res2.error.message?.includes('413') || res2.error.message?.includes('Payload too large')) {
              throw new Error('Imagem muito grande. Tente uma imagem menor.');
            }
            throw res2.error;
          }
          const inserted = res2.data as Message;
          inserted.sender = user;
          inserted.receiver = otherUser;
          if (inserted.reply_to_id && !inserted.reply_to) {
            const { data: replyData } = await supabase
              .from('messages')
              .select(`
                *,
                sender:users!messages_sender_id_fkey(*)
              `)
              .eq('id', inserted.reply_to_id)
              .single();
            if (replyData) {
              inserted.reply_to = replyData as any;
            }
          }
          setMessages(prev => {
            const idx = prev.findIndex(m => m.id === inserted.id);
            if (idx !== -1) {
              const next = [...prev];
              next[idx] = { ...prev[idx], ...inserted } as Message;
              return next;
            }
            return [...prev, inserted];
          });
          await syncLatestMessages();
        } else {
          if (e?.message?.includes('413') || e?.message?.includes('Payload too large')) {
            throw new Error('Imagem muito grande. Tente uma imagem menor.');
          }
          throw res.error;
        }
      } else {
        const inserted = res.data as Message;
        if (inserted.reply_to_id && !inserted.reply_to) {
          const { data: replyData } = await supabase
            .from('messages')
            .select(`
              *,
              sender:users!messages_sender_id_fkey(*)
            `)
            .eq('id', inserted.reply_to_id)
            .single();
          if (replyData) {
            inserted.reply_to = replyData as any;
          }
        }
        setMessages(prev => {
          const idx = prev.findIndex(m => m.id === inserted.id);
          if (idx !== -1) {
            const next = [...prev];
            next[idx] = { ...prev[idx], ...inserted } as Message;
            return next;
          }
          return [...prev, inserted];
        });
        await syncLatestMessages();
      }
    } catch (error: any) {
      console.error('❌ Error in sendMessage:', error);
      throw error;
    }
  };
  if (loading) {
    return <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando chat...</p>
        </div>
      </div>;
  }
  return <div className="flex h-screen-fixed overflow-hidden bg-background">

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-screen-fixed overflow-hidden">
        {otherUser ? <>
            {/* Chat Header */}
            <div className="p-2 border-b bg-card">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                   <Avatar className="w-7 h-7">
                     <AvatarImage src={otherUser.avatar_url} />
                   </Avatar>
                  <div>
                    <h3 className="font-medium text-sm">{otherUser.username}</h3>
                     <p className="text-xs text-muted-foreground">
                       {isUserOnline(otherUser.id) 
                         ? 'Online' 
                         : lastSeenInfo?.last_seen_formatted 
                           ? `visto por último ${lastSeenInfo.last_seen_formatted}`
                           : 'Offline'
                       }
                     </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* Push Notifications Toggle */}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={sendGlobalPush}
                    className="relative h-8 w-8"
                    title={pushSending ? 'Enviando...' : 'Enviar notificação global'}
                  >
                    {pushSending ? (
                      <Bell className="h-4 w-4 text-pink-500 animate-pulse" />
                    ) : (
                      <Bell className="h-4 w-4 text-pink-500" />
                    )}
                  </Button>
                  {pushSendStats && (
                    <span className="text-xs text-muted-foreground">Enviadas: {pushSendStats.sent} de {pushSendStats.total}</span>
                  )}

                  {/* Instagram Button */}
                  <button
                  onClick={() => {
                    const instagramUrl = getInstagramUrlForUser(otherUser);
                    if (instagramUrl) {
                      const platformInfo = getPlatformInfo(instagramUrl);
                      openLink(instagramUrl, platformInfo.nativeUrl);
                    } else {
                      console.warn('Instagram URL not found for user:', otherUser?.username);
                    }
                  }}
                  className="p-2 rounded-full bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 hover:opacity-80 transition-opacity"
                  title="Abrir Instagram (app nativo quando disponível)"
                >
                  <svg 
                    viewBox="0 0 24 24" 
                    className="w-5 h-5 fill-white"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                   </svg>
                </button>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div ref={messagesContainerRef} onScroll={handleMessagesScroll} className="flex-1 overflow-y-auto overflow-x-hidden p-4 relative" style={{
          height: 'calc(100vh - 220px)'
        }}>
              <div className="space-y-4">
                {messages.length > 0 && <div className="flex justify-center py-2">
                    {loadingMore ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" /> : hasMore ? <p className="text-xs text-muted-foreground">Role para cima para carregar mais</p> : null}
                  </div>}
                
                {/* New Message Notification */}
                <NewMessageNotification
                  show={showNewMessageNotification}
                  messageCount={pendingMessagesCount}
                  onClick={handleScrollToBottom}
                />
                {messages.length === 0 ? <div className="flex items-center justify-center h-full">
                    <div className="text-center text-muted-foreground">
                      <MessageCircle className="w-16 h-16 mx-auto mb-4 opacity-30" />
                      <p className="text-lg font-medium mb-2">Primeira conversa!</p>
                      <p>Envie a primeira mensagem para {otherUser.username}</p>
                    </div>
                   </div> : messages.map((message, index) => {
                    // Filter out sequential duplicates (same content, sender, and type)
                    // This handles the case where user double-clicks send
                    const prevMessage = index > 0 ? messages[index - 1] : null;
                    const isDuplicate = prevMessage && 
                      message.content === prevMessage.content && 
                      message.sender_id === prevMessage.sender_id &&
                      message.reply_to_id === prevMessage.reply_to_id &&
                      !message.has_image && !prevMessage.has_image &&
                      !message.has_audio && !prevMessage.has_audio &&
                      !message.has_video && !prevMessage.has_video;

                    if (isDuplicate) return null;

                    return (
                    <div 
                      key={message.id} 
                      id={`message-${message.id}`}
                      className={highlightedMessageId === message.id ? 'animate-[pulse_1s_ease-in-out_2]' : ''}
                    >
                      <ChatBubble 
                        message={message} 
                        isOwn={message.sender_id === user?.id} 
                        currentUserId={user.id}
                        onDelete={deleteMessage} 
                        onEdit={editMessage} 
                        onReply={setReplyingTo}
                        onScrollToMessage={scrollToMessage}
                      />
                    </div>
                  )})}
                
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Indicador de digitação - posição fixa */}
            {otherUser && otherUserTyping && <div className="px-4 py-2 border-t bg-background/95 backdrop-blur-sm">
                <TypingIndicator user={otherUser} show={otherUserTyping} />
              </div>}

            {/* Message Input */}
            <MessageInput onSendMessage={sendMessage} onStartTyping={startTyping} onStopTyping={stopTyping} replyingTo={replyingTo} onCancelReply={() => setReplyingTo(null)} userId={user.id} />
            
            {/* Footer */}
            <div className="bg-muted/30 px-4 py-2 border-t text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <p className="text-xs text-muted-foreground">
                  {otherUser?.username} • {isUserOnline(otherUser?.id || '') 
                    ? 'Online' 
                    : lastSeenInfo?.last_seen_formatted 
                      ? `visto por último ${lastSeenInfo.last_seen_formatted}`
                      : 'Offline'
                  }
                </p>
              </div>
              
            </div>
          </> : <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p>Carregando conversa...</p>
            </div>
          </div>}
      </div>
    </div>;
};
