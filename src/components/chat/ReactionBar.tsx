import React from 'react';
import { cn } from '@/lib/utils';

interface ReactionBarProps {
  onReaction: (emoji: string) => void;
  onClose: () => void;
  isVisible: boolean;
  messageId: string;
}

const REACTION_EMOJIS = ['👍', '❤️', '😂', '😲', '😥', '🙏', '😉'];

export const ReactionBar: React.FC<ReactionBarProps> = ({
  onReaction,
  onClose,
  isVisible,
  messageId
}) => {
  if (!isVisible) return null;

  const handleReaction = (emoji: string) => {
    onReaction(emoji);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div 
        className={cn(
          "absolute bg-background/95 backdrop-blur-sm border rounded-full px-3 py-2 shadow-lg animate-scale-in",
          "flex items-center gap-2 transition-all duration-200"
        )}
        style={{
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -60%)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {REACTION_EMOJIS.map((emoji, index) => (
          <button
            key={emoji}
            onClick={() => handleReaction(emoji)}
            className={cn(
              "text-2xl hover:scale-125 active:scale-95 transition-transform duration-150",
              "w-10 h-10 rounded-full flex items-center justify-center",
              "hover:bg-accent/50"
            )}
            style={{
              animationDelay: `${index * 50}ms`
            }}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
};