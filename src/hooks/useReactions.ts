import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export interface MessageReaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
}

export interface ReactionSummary {
  emoji: string;
  count: number;
  users: string[];
  hasUserReacted: boolean;
}

export const useReactions = (messageId: string, skip: boolean = false) => {
  const [reactions, setReactions] = useState<MessageReaction[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  // Load reactions for message
  const loadReactions = useCallback(async () => {
    if (!messageId || skip) return;

    try {
      const { data, error } = await supabase
        .from('message_reactions')
        .select('*')
        .eq('message_id', messageId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setReactions(data || []);
    } catch (error) {
      console.error('Error loading reactions:', error);
    } finally {
      setLoading(false);
    }
  }, [messageId]);

  // Add reaction (optimistic update)
  const addReaction = useCallback(async (emoji: string) => {
    if (!user || !messageId) return;

    // Optimistic update
    const tempReaction: MessageReaction = {
      id: `temp-${Date.now()}`,
      message_id: messageId,
      user_id: user.id,
      emoji,
      created_at: new Date().toISOString()
    };

    setReactions(prev => [...prev, tempReaction]);

    try {
      const { error } = await supabase
        .from('message_reactions')
        .insert({
          message_id: messageId,
          user_id: user.id,
          emoji
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error adding reaction:', error);
      // Revert optimistic update on error
      setReactions(prev => prev.filter(r => r.id !== tempReaction.id));
    }
  }, [user, messageId]);

  // Remove reaction (optimistic update)
  const removeReaction = useCallback(async (emoji: string) => {
    if (!user || !messageId) return;

    // Find existing reaction
    const existingReaction = reactions.find(r => 
      r.user_id === user.id && r.emoji === emoji
    );

    if (!existingReaction) return;

    // Optimistic update
    setReactions(prev => prev.filter(r => r.id !== existingReaction.id));

    try {
      const { error } = await supabase
        .from('message_reactions')
        .delete()
        .eq('message_id', messageId)
        .eq('user_id', user.id)
        .eq('emoji', emoji);

      if (error) throw error;
    } catch (error) {
      console.error('Error removing reaction:', error);
      // Revert optimistic update on error
      setReactions(prev => [...prev, existingReaction]);
    }
  }, [user, messageId, reactions]);

  // Toggle reaction
  const toggleReaction = useCallback((emoji: string) => {
    if (!user) return;

    const hasReacted = reactions.some(r => 
      r.user_id === user.id && r.emoji === emoji
    );

    if (hasReacted) {
      removeReaction(emoji);
    } else {
      addReaction(emoji);
    }
  }, [user, reactions, addReaction, removeReaction]);

  // Get reaction summary
  const getReactionSummary = useCallback((): ReactionSummary[] => {
    const summary = new Map<string, ReactionSummary>();

    reactions.forEach(reaction => {
      const existing = summary.get(reaction.emoji);
      if (existing) {
        existing.count++;
        existing.users.push(reaction.user_id);
        if (user && reaction.user_id === user.id) {
          existing.hasUserReacted = true;
        }
      } else {
        summary.set(reaction.emoji, {
          emoji: reaction.emoji,
          count: 1,
          users: [reaction.user_id],
          hasUserReacted: user ? reaction.user_id === user.id : false
        });
      }
    });

    return Array.from(summary.values()).sort((a, b) => b.count - a.count);
  }, [reactions, user]);

  // Real-time subscription
  useEffect(() => {
    if (skip) return;

    loadReactions();

    const channel = supabase
      .channel(`reactions_${messageId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'message_reactions',
          filter: `message_id=eq.${messageId}`
        },
        () => {
          loadReactions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [messageId, loadReactions]);

  return {
    reactions,
    loading,
    addReaction,
    removeReaction,
    toggleReaction,
    reactionSummary: getReactionSummary(),
    hasReactions: reactions.length > 0
  };
};