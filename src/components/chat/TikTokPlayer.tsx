import React from 'react';
import { cn } from '@/lib/utils';

interface TikTokPlayerProps {
  videoId: string;
  className?: string;
}

export const TikTokPlayer: React.FC<TikTokPlayerProps> = ({ videoId, className }) => {
  if (!videoId) return null;

  return (
    <div className={cn("relative w-full max-w-[375px] mx-auto rounded-lg overflow-hidden bg-black my-2 border border-border/50", className)}>
       <iframe
        src={`https://www.tiktok.com/embed/v2/${videoId}?lang=pt-BR&sender_device=mobile&is_from_webapp=1&device_platform=iphone&os=ios`}
        className="w-full h-[667px] border-0"
        title="TikTok video player"
        allowFullScreen
        allow="encrypted-media;"
      />
    </div>
  );
};
