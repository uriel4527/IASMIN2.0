import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { formatDuration } from '@/utils/audioCompression';

interface AudioPlayerProps {
  audioData: string;
  duration: number;
  isOwn?: boolean;
  className?: string;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({ 
  audioData, 
  duration, 
  isOwn = false,
  className 
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => {
      setCurrentTime(audio.currentTime);
      if (isPlaying) {
        animationRef.current = requestAnimationFrame(updateTime);
      }
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('ended', handleEnded);
    
    if (isPlaying) {
      animationRef.current = requestAnimationFrame(updateTime);
    }

    return () => {
      audio.removeEventListener('ended', handleEnded);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying]);

  useEffect(() => {
    // Draw waveform visualization
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    
    ctx.clearRect(0, 0, width, height);
    
    // Generate fake waveform (in production, you'd analyze the actual audio)
    const bars = 40;
    const barWidth = width / bars;
    const progress = currentTime / duration;

    for (let i = 0; i < bars; i++) {
      const barHeight = Math.random() * height * 0.7 + height * 0.3;
      const x = i * barWidth;
      const isPassed = (i / bars) <= progress;
      
      ctx.fillStyle = isPassed 
        ? (isOwn ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))') 
        : 'hsl(var(--muted-foreground) / 0.3)';
      
      ctx.fillRect(x, (height - barHeight) / 2, barWidth - 2, barHeight);
    }
  }, [currentTime, duration, isOwn]);

  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      // Pause all other audio players
      document.querySelectorAll('audio').forEach(a => {
        if (a !== audio) a.pause();
      });
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (value: number[]) => {
    const audio = audioRef.current;
    if (!audio) return;
    
    const newTime = (value[0] / 100) * duration;
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const toggleSpeed = () => {
    const audio = audioRef.current;
    if (!audio) return;

    const speeds = [1, 1.5, 2];
    const currentIndex = speeds.indexOf(playbackRate);
    const nextIndex = (currentIndex + 1) % speeds.length;
    const newRate = speeds[nextIndex];
    
    audio.playbackRate = newRate;
    setPlaybackRate(newRate);
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = audioData;
    link.download = `audio_${Date.now()}.webm`;
    link.click();
  };

  return (
    <div className={cn(
      "flex items-center gap-1.5 p-1.5 rounded-lg min-w-[160px]",
      isOwn ? "bg-primary/10" : "bg-muted",
      className
    )}>
      {/* Play/Pause button */}
      <Button
        size="icon"
        variant="ghost"
        onClick={togglePlayPause}
        className="h-6 w-6 flex-shrink-0"
      >
        {isPlaying ? (
          <Pause className="h-3 w-3" />
        ) : (
          <Play className="h-3 w-3 ml-0.5" />
        )}
      </Button>

      {/* Waveform and controls */}
      <div className="flex-1 space-y-1">
        {/* Waveform visualization */}
        <canvas
          ref={canvasRef}
          width={120}
          height={16}
          className="w-full h-4"
        />

        {/* Progress slider */}
        <Slider
          value={[(currentTime / duration) * 100]}
          onValueChange={handleSeek}
          max={100}
          step={1}
          className="w-full"
        />

        {/* Time and controls */}
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span className="tabular-nums">
            {formatDuration(currentTime)} / {formatDuration(duration)}
          </span>
          
          <div className="flex items-center gap-0.5">
            <Button
              size="sm"
              variant="ghost"
              onClick={toggleSpeed}
              className="h-4 px-1 text-[10px]"
            >
              {playbackRate}x
            </Button>
            
            <Button
              size="sm"
              variant="ghost"
              onClick={handleDownload}
              className="h-4 w-4 p-0"
            >
              <Download className="h-2.5 w-2.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        src={audioData}
        preload="metadata"
      />
    </div>
  );
};