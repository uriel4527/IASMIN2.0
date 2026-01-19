import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Play, Pause, Scissors, X, Settings, Zap, Crown } from 'lucide-react';
import { formatDuration, ProcessingOptions, formatFileSize } from '@/utils/videoCompression';

interface VideoTrimmerProps {
  videoBlob: Blob;
  videoDuration: number;
  onTrimComplete: (startTime: number, endTime: number, options?: ProcessingOptions) => void;
  onCancel: () => void;
  isProcessing?: boolean;
}

export function VideoTrimmer({
  videoBlob,
  videoDuration,
  onTrimComplete,
  onCancel,
  isProcessing = false
}: VideoTrimmerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(Math.min(videoDuration, 120)); // Max 2 minutes
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [processingOptions, setProcessingOptions] = useState<ProcessingOptions>({
    method: 'auto',
    quality: 'quality'
  });
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Maximum duration is 2 minutes (120 seconds)
  const maxDuration = 120;
  const actualEndTime = Math.min(endTime, startTime + maxDuration);

  useEffect(() => {
    const url = URL.createObjectURL(videoBlob);
    setVideoUrl(url);
    
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [videoBlob]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      
      // Auto-pause when reaching end time
      if (video.currentTime >= actualEndTime) {
        video.pause();
        setIsPlaying(false);
      }
    };

    const handleLoadedMetadata = () => {
      video.currentTime = startTime;
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, [startTime, actualEndTime]);

  const togglePlayPause = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
    } else {
      // Start from selected start time if at beginning
      if (video.currentTime < startTime || video.currentTime >= actualEndTime) {
        video.currentTime = startTime;
      }
      video.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleStartTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newStartTime = parseFloat(e.target.value);
    setStartTime(newStartTime);
    
    // Adjust end time if necessary
    if (newStartTime + maxDuration < endTime) {
      setEndTime(newStartTime + maxDuration);
    }
    
    // Update video current time if it's before new start
    const video = videoRef.current;
    if (video && video.currentTime < newStartTime) {
      video.currentTime = newStartTime;
    }
  };

  const handleEndTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newEndTime = Math.min(parseFloat(e.target.value), startTime + maxDuration);
    setEndTime(newEndTime);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const seekTime = parseFloat(e.target.value);
    const video = videoRef.current;
    if (video) {
      video.currentTime = Math.max(startTime, Math.min(seekTime, actualEndTime));
    }
  };

  const handleTrim = () => {
    onTrimComplete(startTime, actualEndTime, processingOptions);
  };

  const trimDuration = actualEndTime - startTime;
  const progress = ((currentTime - startTime) / (actualEndTime - startTime)) * 100;

  return (
    <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-lg shadow-lg w-full max-w-2xl">
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Cortar Vídeo</h3>
            <Button variant="ghost" size="icon" onClick={onCancel}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Video Preview */}
          <div className="relative bg-black rounded-lg overflow-hidden">
            <video
              ref={videoRef}
              src={videoUrl}
              className="w-full h-64 object-contain"
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
            />
            
            {/* Play/Pause Overlay */}
            <div className="absolute inset-0 flex items-center justify-center">
              <Button
                variant="ghost"
                size="icon"
                className="bg-black/50 hover:bg-black/70 text-white"
                onClick={togglePlayPause}
              >
                {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
              </Button>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <Progress value={progress} className="w-full" />
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{formatDuration(Math.floor(currentTime))}</span>
              <span>{formatDuration(Math.floor(actualEndTime))}</span>
            </div>
          </div>

          {/* Timeline Scrubber */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Navegar no vídeo:</label>
            <input
              type="range"
              min={0}
              max={videoDuration}
              step={0.1}
              value={currentTime}
              onChange={handleSeek}
              className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer"
            />
          </div>

          {/* Trim Controls */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Início: {formatDuration(Math.floor(startTime))}</label>
              <input
                type="range"
                min={0}
                max={Math.max(0, videoDuration - 1)}
                step={0.1}
                value={startTime}
                onChange={handleStartTimeChange}
                className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Fim: {formatDuration(Math.floor(actualEndTime))}</label>
              <input
                type="range"
                min={startTime + 1}
                max={Math.min(videoDuration, startTime + maxDuration)}
                step={0.1}
                value={actualEndTime}
                onChange={handleEndTimeChange}
                className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>

          {/* Processing Options */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Opções de Processamento</span>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setShowAdvanced(!showAdvanced)}
              >
                <Settings className="h-4 w-4 mr-1" />
                {showAdvanced ? 'Ocultar' : 'Avançado'}
              </Button>
            </div>

            {/* Quality Selection */}
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={processingOptions.quality === 'speed' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setProcessingOptions(prev => ({ ...prev, quality: 'speed' }))}
                className="flex items-center justify-center gap-2"
              >
                <Zap className="h-4 w-4" />
                Rápido
              </Button>
              <Button
                variant={processingOptions.quality === 'quality' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setProcessingOptions(prev => ({ ...prev, quality: 'quality' }))}
                className="flex items-center justify-center gap-2"
              >
                <Crown className="h-4 w-4" />
                Máxima Qualidade
              </Button>
            </div>

            {/* Advanced Options */}
            {showAdvanced && (
              <div className="space-y-2 p-3 bg-muted/30 rounded-lg">
                <div className="text-xs text-muted-foreground mb-2">Método de Processamento:</div>
                <div className="grid grid-cols-3 gap-1">
                  {(['auto', 'ffmpeg', 'canvas'] as const).map((method) => (
                    <Button
                      key={method}
                      variant={processingOptions.method === method ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setProcessingOptions(prev => ({ ...prev, method }))}
                      className="text-xs"
                    >
                      {method === 'auto' && 'Auto'}
                      {method === 'ffmpeg' && 'FFmpeg'}
                      {method === 'canvas' && 'Canvas'}
                    </Button>
                  ))}
                </div>
                <div className="text-xs text-muted-foreground mt-2">
                  • Auto: Escolhe o melhor método automaticamente<br/>
                  • FFmpeg: Re-encoding de alta qualidade<br/>
                  • Canvas: Renderização frame-by-frame
                </div>
              </div>
            )}
          </div>

          {/* Duration Info */}
          <div className="bg-muted/50 rounded-lg p-3 text-sm">
            <div className="flex justify-between items-center">
              <span>Duração selecionada:</span>
              <div className="flex items-center gap-2">
                <span className={trimDuration > maxDuration ? 'text-destructive font-medium' : ''}>
                  {formatDuration(Math.floor(trimDuration))}
                </span>
                <Badge variant={processingOptions.quality === 'quality' ? 'default' : 'secondary'} className="text-xs">
                  {processingOptions.quality === 'quality' ? 'MAX' : 'FAST'}
                </Badge>
              </div>
            </div>
            {trimDuration > maxDuration && (
              <p className="text-destructive text-xs mt-1">
                Máximo permitido: {formatDuration(maxDuration)}
              </p>
            )}
            <div className="text-xs text-muted-foreground mt-2">
              {processingOptions.quality === 'quality' ? 
                '🎯 Qualidade máxima com compressão inteligente' : 
                '⚡ Processamento rápido com compressão otimizada'
              }
              <br />
              <span className="text-xs">
                Tamanho original: {formatFileSize(videoBlob.size)} | 
                Duração: {formatDuration(Math.floor(videoDuration))}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button variant="outline" onClick={onCancel} className="flex-1">
              Cancelar
            </Button>
            <Button 
              onClick={handleTrim} 
              disabled={isProcessing || trimDuration > maxDuration}
              className="flex-1"
            >
              {isProcessing ? (
                <>Processando...</>
              ) : (
                <>
                  <Scissors className="h-4 w-4 mr-2" />
                  Cortar Vídeo
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}