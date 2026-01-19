import React from 'react';
import { cn } from '@/lib/utils';
import { ReactionSummary } from '@/hooks/useReactions';

interface MessageReactionsProps {
  reactions: ReactionSummary[];
  onReactionClick: (emoji: string) => void;
  isOwn: boolean;
}

export const MessageReactions: React.FC<MessageReactionsProps> = ({
  reactions,
  onReactionClick,
  isOwn
}) => {
  if (!reactions.length) return null;

  return (
    <div className={cn(
      "flex flex-wrap gap-1 mt-1 max-w-xs",
      isOwn ? "justify-end" : "justify-start"
    )}>
      {reactions.map((reaction) => (
        <button
          key={reaction.emoji}
          onClick={() => onReactionClick(reaction.emoji)}
          className={cn(
            "inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs",
            "border transition-all duration-150 hover:scale-105 active:scale-95",
            "min-w-8 h-6",
            reaction.hasUserReacted
              ? "bg-primary/20 border-primary/40 text-primary"
              : "bg-muted/50 border-border/50 hover:bg-muted/70"
          )}
          title={`${reaction.count} reaction${reaction.count > 1 ? 's' : ''}`}
        >
          <span className="text-xs">{reaction.emoji}</span>
          {reaction.count > 1 && (
            <span className="text-xs font-medium min-w-2 text-center">
              {reaction.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
};