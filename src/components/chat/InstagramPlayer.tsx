import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Maximize2 } from 'lucide-react';
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from '@/components/ui/dialog';

interface InstagramPlayerProps {
  videoId: string; // This is actually the post/reel ID
  className?: string;
}

export const InstagramPlayer: React.FC<InstagramPlayerProps> = ({ videoId, className }) => {
  const [isOpen, setIsOpen] = useState(false);
  const cleanId = videoId.trim();

  if (!cleanId) return null;

  // Posts are typically 1:1 or 4:5
  const aspectRatioClass = "aspect-[4/5] max-w-[350px]";

  // The embed URL
  const embedUrl = `https://www.instagram.com/p/${cleanId}/embed/`;

  // Prevent double playback by unmounting the small player iframe when fullscreen is open
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <div className={cn("relative w-full mx-auto rounded-lg overflow-hidden bg-black/5 my-2 border border-border/50 group", aspectRatioClass, className)}>
        {/* Only render the small player if NOT in fullscreen mode */}
        {!isOpen && (
          <iframe
            src={embedUrl}
            className="absolute top-0 left-0 w-full object-cover"
            style={{ 
              // Hack to hide header (user info) and footer (likes/comments)
              // We expand the iframe height and shift it up to crop the top and bottom bars
              height: 'calc(100% + 120px)',
              marginTop: '-60px', 
            }}
            frameBorder="0"
            scrolling="no"
            allowTransparency={true}
            allowFullScreen
            title="Instagram post"
            loading="lazy"
          />
        )}
        
        {/* Placeholder background when iframe is unmounted */}
        {isOpen && (
          <div className="absolute inset-0 bg-black/10 flex items-center justify-center">
            <p className="text-xs text-muted-foreground">Reproduzindo em tela cheia...</p>
          </div>
        )}

        {/* Toggle button - visible on hover or always on mobile */}
        <DialogTrigger asChild>
          <button
            className="absolute bottom-3 right-3 z-10 p-1.5 bg-black/50 hover:bg-black/70 text-white rounded-full backdrop-blur-sm opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
            type="button"
            aria-label="Enter fullscreen"
          >
            <Maximize2 size={16} />
          </button>
        </DialogTrigger>
      </div>

      <DialogContent className="max-w-md w-full p-0 border-none bg-transparent shadow-none sm:max-w-lg aspect-[4/5] overflow-hidden">
        <DialogTitle className="sr-only">Instagram Video Fullscreen</DialogTitle>
        <div className="relative w-full h-full rounded-lg overflow-hidden bg-black">
          <iframe
            src={embedUrl}
            className="absolute top-0 left-0 w-full object-cover"
            style={{ 
              // Same crop logic for fullscreen
              height: 'calc(100% + 120px)',
              marginTop: '-60px', 
            }}
            frameBorder="0"
            scrolling="no"
            allowTransparency={true}
            allowFullScreen
            title="Instagram post fullscreen"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};
