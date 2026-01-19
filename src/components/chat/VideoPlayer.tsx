import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize2, Eye, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { formatDuration } from '@/utils/videoCompression';

interface VideoPlayerProps {
  videoPath: string;
  thumbnail?: string;
  duration: number;
  viewOnce?: boolean;
  viewed?: boolean;
  messageId: string;
  currentUserId: string;
  senderId: string;
  className?: string;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  videoPath,
  thumbnail,
  duration,
  viewOnce = false,
  viewed = false,
  messageId,
  currentUserId,
  senderId,
  className
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [hasViewed, setHasViewed] = useState(viewed);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [videoWidth, setVideoWidth] = useState(0);
  const [videoHeight, setVideoHeight] = useState(0);
  const [isVertical, setIsVertical] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [bufferedPercentage, setBufferedPercentage] = useState(0);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const isReceiver = senderId !== currentUserId;
  const canView = !viewOnce || !hasViewed || !isReceiver;

  useEffect(() => {
    if (viewOnce && viewed !== undefined) {
      setHasViewed(viewed);
    }
  }, [viewed, viewOnce]);

  const loadVideo = async () => {
    if (videoUrl || isLoading) return;
    
    // Check if it's already a full URL (from our new backend)
    if (videoPath.startsWith('http://') || videoPath.startsWith('https://')) {
        // Force HTTPS first if it's HTTP
        if (videoPath.startsWith('http://')) {
            const httpsUrl = videoPath.replace('http://', 'https://');
            
            // Try HTTPS first
            try {
                const response = await fetch(httpsUrl, { method: 'HEAD' });
                if (response.ok) {
                    setVideoUrl(httpsUrl);
                    return;
                }
            } catch (e) {
                console.log('HTTPS video load failed, falling back to HTTP');
            }
        }
        
        setVideoUrl(videoPath);
        return;
    }
    
    try {
      setIsLoading(true);
      setError(null);
      
      const { data, error } = await supabase.storage
        .from('chat-videos')
        .createSignedUrl(videoPath, 3600); // 1 hour expiry

      if (error) throw error;
      
      setVideoUrl(data.signedUrl);
    } catch (error) {
      console.error('Failed to load video:', error);
      setError('Erro ao carregar vídeo');
    } finally {
      setIsLoading(false);
    }
  };

  const markAsViewed = async () => {
    if (!viewOnce || hasViewed || !isReceiver) return;

    try {
      await supabase.rpc('mark_video_as_viewed', {
        message_id: messageId,
        user_id: currentUserId
      });
      
      setHasViewed(true);
    } catch (error) {
      console.error('Failed to mark video as viewed:', error);
    }
  };

  const handlePlay = async () => {
    if (!canView) return;
    
    await loadVideo();
    
    if (videoRef.current && videoUrl) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        // Mark as viewed when starting to play (for view once videos)
        if (viewOnce && !hasViewed && isReceiver) {
          await markAsViewed();
        }
        
        await videoRef.current.play();
      }
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      const { videoWidth, videoHeight } = videoRef.current;
      setVideoWidth(videoWidth);
      setVideoHeight(videoHeight);
      setIsVertical(videoHeight > videoWidth);
      setCurrentTime(0);
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current || !canView) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    const newTime = percent * duration;
    
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleProgress = () => {
    if (videoRef.current && duration > 0) {
      const buffered = videoRef.current.buffered;
      if (buffered.length > 0) {
        const bufferedEnd = buffered.end(buffered.length - 1);
        setBufferedPercentage(Math.min((bufferedEnd / duration) * 100, 100));
      }
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setIsMuted(videoRef.current.muted);
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    
    if (!isFullscreen) {
      containerRef.current.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      const isNowFullscreen = !!document.fullscreenElement;
      setIsFullscreen(isNowFullscreen);
      
      if (isNowFullscreen) {
        setViewportWidth(window.screen.width);
        setViewportHeight(window.screen.height);
      }
    };
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // If it's a view-once video that has been viewed and user is receiver
  if (viewOnce && hasViewed && isReceiver) {
    return (
      <div className={cn("relative max-w-xs bg-muted/50 rounded-lg p-8 flex flex-col items-center gap-2", className)}>
        <Eye className="w-8 h-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground text-center">
          Vídeo já visualizado
        </p>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className={cn(
        "relative bg-black rounded-lg overflow-hidden",
        isFullscreen 
          ? "fixed inset-0 z-50 flex items-center justify-center max-w-none max-h-none w-screen h-screen"
          : isVertical 
            ? "max-w-[200px]" 
            : "max-w-xs",
        className
      )}
    >
      {/* Thumbnail or video */}
      {!videoUrl ? (
        <div 
          className="relative cursor-pointer group"
          onClick={canView ? handlePlay : undefined}
        >
          {thumbnail ? (
            <img 
              src={thumbnail} 
              alt="Video thumbnail"
              className={cn(
                "w-full object-cover",
                isVertical ? "aspect-[9/16]" : "aspect-video"
              )}
            />
          ) : (
            <div className={cn(
              "w-full bg-muted flex items-center justify-center",
              isVertical ? "aspect-[9/16]" : "aspect-video"
            )}>
              <Play className="w-12 h-12 text-muted-foreground" />
            </div>
          )}
          
          {/* Play overlay */}
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/50 transition-colors">
            {isLoading ? (
              <Loader2 className="w-12 h-12 text-white animate-spin" />
            ) : error ? (
              <div className="text-white text-center p-4">
                <p className="text-sm">{error}</p>
              </div>
            ) : canView ? (
              <div className="bg-white/90 rounded-full p-3 group-hover:scale-110 transition-transform">
                <Play className="w-6 h-6 text-black ml-1" />
              </div>
            ) : (
              <div className="text-white text-center">
                <Eye className="w-8 h-8 mx-auto mb-2" />
                <p className="text-xs">Ver apenas uma vez</p>
              </div>
            )}
          </div>
          
          {/* Duration badge */}
          <div className="absolute bottom-2 right-2 bg-black/70 px-2 py-1 rounded text-white text-xs">
            {formatDuration(duration)}
          </div>
          
          {/* View once badge */}
          {viewOnce && (
            <Badge 
              variant="secondary" 
              className="absolute top-2 left-2 text-xs"
            >
              <Eye className="w-3 h-3 mr-1" />
              Ver uma vez
            </Badge>
          )}
        </div>
      ) : (
        <div className="relative">
          <video
            ref={videoRef}
            src={videoUrl}
            className={cn(
              "w-full",
              isFullscreen 
                ? (() => {
                    if (!videoWidth || !videoHeight || !viewportWidth || !viewportHeight) {
                      return isVertical ? "h-full w-auto max-w-none" : "w-full h-auto max-h-full";
                    }
                    
                    const videoAspect = videoWidth / videoHeight;
                    const screenAspect = viewportWidth / viewportHeight;
                    const aspectDiff = Math.abs(videoAspect - screenAspect) / screenAspect;
                    
                    // Se a diferença for pequena (< 15%), usar cover para minimizar bordas
                    if (aspectDiff < 0.15) {
                      return "w-full h-full object-cover";
                    }
                    
                    // Para vídeos verticais em telas horizontais, maximizar altura
                    if (isVertical && screenAspect > 1) {
                      return "h-full w-auto max-w-none object-contain";
                    }
                    
                    // Para vídeos horizontais em telas verticais, maximizar largura  
                    if (!isVertical && screenAspect < 1) {
                      return "w-full h-auto max-h-none object-contain";
                    }
                    
                    // Caso geral: manter proporção mas ocupar máximo possível
                    return "max-w-full max-h-full object-contain";
                  })()
                : isVertical 
                  ? "aspect-[9/16]" 
                  : "aspect-video"
            )}
            style={isFullscreen ? {
              maxWidth: '100vw',
              maxHeight: '100vh'
            } : undefined}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onTimeUpdate={handleTimeUpdate}
            onProgress={handleProgress}
            onLoadedMetadata={handleLoadedMetadata}
            playsInline
          />
          
          {/* Video controls */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
            {/* Progress bar */}
            <div 
              className="relative w-full h-1 bg-white/30 rounded-full cursor-pointer mb-2 group flex items-center"
              onClick={handleSeek}
            >
              {/* Buffered Bar */}
              <div 
                className="absolute left-0 top-0 h-full bg-white/40 rounded-full transition-all duration-300 ease-linear"
                style={{ width: `${bufferedPercentage}%` }}
              />

              <div 
                className="h-full bg-white rounded-full transition-all relative z-10"
                style={{ width: `${(currentTime / duration) * 100}%` }}
              >
                <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-3 h-3 bg-white rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
              </div>
            </div>
            
            {/* Control buttons */}
            <div className="flex items-center justify-between text-white">
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handlePlay}
                  className="text-white hover:bg-white/20 h-8 w-8 p-0"
                >
                  {isPlaying ? (
                    <Pause className="w-4 h-4" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                </Button>
                
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={toggleMute}
                  className="text-white hover:bg-white/20 h-8 w-8 p-0"
                >
                  {isMuted ? (
                    <VolumeX className="w-4 h-4" />
                  ) : (
                    <Volume2 className="w-4 h-4" />
                  )}
                </Button>
                
                <span className="text-xs">
                  {formatDuration(Math.floor(currentTime))} / {formatDuration(duration)}
                </span>
              </div>
              
              <Button
                size="sm"
                variant="ghost"
                onClick={toggleFullscreen}
                className="text-white hover:bg-white/20 h-8 w-8 p-0"
              >
                <Maximize2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};