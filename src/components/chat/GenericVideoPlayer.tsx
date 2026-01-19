import React from 'react';
import { cn } from '@/lib/utils';

interface GenericVideoPlayerProps {
  src: string;
  className?: string;
}

export const GenericVideoPlayer: React.FC<GenericVideoPlayerProps> = ({ src, className }) => {
  return (
    <div className={cn("relative w-full aspect-video rounded-lg overflow-hidden bg-black my-2 border border-border/50", className)}>
      <video
        src={src}
        controls
        playsInline
        className="w-full h-full object-contain"
      >
        Seu navegador não suporta a reprodução deste vídeo.
      </video>
    </div>
  );
};
