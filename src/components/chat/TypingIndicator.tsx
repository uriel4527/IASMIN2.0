import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User } from '@/lib/supabase';

interface TypingIndicatorProps {
  user: User;
  show: boolean;
}

export const TypingIndicator: React.FC<TypingIndicatorProps> = ({ user, show }) => {
  if (!show) return null;

  return (
    <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg animate-pulse">
      <Avatar className="w-8 h-8">
        <AvatarImage src={user.avatar_url} />
        <AvatarFallback className="bg-primary text-primary-foreground text-xs">
          {user.username?.charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="flex items-center gap-1">
        <span className="text-sm text-muted-foreground">
          {user.username} está digitando
        </span>
        <div className="flex gap-1">
          <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
};