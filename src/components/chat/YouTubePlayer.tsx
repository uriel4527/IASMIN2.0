import React from 'react';
import { cn } from '@/lib/utils';

interface YouTubePlayerProps {
  videoId: string;
  className?: string;
}

export const YouTubePlayer: React.FC<YouTubePlayerProps> = ({ videoId, className }) => {
  // Ensure videoId is clean
  const cleanVideoId = videoId.trim();

  if (!cleanVideoId) return null;

  return (
    <div className={cn("relative w-full aspect-video rounded-lg overflow-hidden bg-black my-2 shadow-sm border border-border/50", className)}>
      <iframe
        src={`https://www.youtube.com/embed/${cleanVideoId}?rel=0&modestbranding=1&playsinline=1`}
        title="YouTube video player"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        loading="lazy"
        className="absolute top-0 left-0 w-full h-full border-0"
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>
  );
};
