import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Video, X, Send, Eye, EyeOff, Loader2, Paperclip, Camera, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useVideoUpload } from '@/hooks/useVideoUpload';
import { formatDuration, formatFileSize, ProcessingOptions } from '@/utils/videoCompression';
import { LazyVideoTrimmer } from './LazyVideoTrimmer';

interface VideoRecorderProps {
  onSendVideo: (videoPath: string, duration: number, thumbnail: string, viewOnce?: boolean) => Promise<void>;
  disabled?: boolean;
  className?: string;
  userId: string;
}

export const VideoRecorder: React.FC<VideoRecorderProps> = ({ 
  onSendVideo, 
  disabled = false,
  className,
  userId
}) => {
  const [videoUploadState, videoUploadActions] = useVideoUpload(userId);
  const [viewOnce, setViewOnce] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isMinimized, setIsMinimized] = useState(false);

  // Create video URL for gallery video preview (only when needed)
  const galleryVideoUrl = useMemo(() => {
    if (videoUploadState.galleryVideoData) {
      return URL.createObjectURL(videoUploadState.galleryVideoData.file);
    }
    return null;
  }, [videoUploadState.galleryVideoData]);

  // Cleanup video URL when it changes
  useEffect(() => {
    return () => {
      if (galleryVideoUrl) {
        URL.revokeObjectURL(galleryVideoUrl);
      }
    };
  }, [galleryVideoUrl]);

  // Set up video stream preview
  useEffect(() => {
    if (videoUploadState.stream && videoRef.current) {
      videoRef.current.srcObject = videoUploadState.stream;
    }
  }, [videoUploadState.stream]);

  const handleStartRecording = async () => {
    try {
      await videoUploadActions.startRecording();
    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  };

  const handleStopRecording = async () => {
    await videoUploadActions.stopRecording();
  };

  const handleSendVideo = async () => {
    if (!videoUploadState.videoData) return;

    await videoUploadActions.uploadAndSend(async (videoPath, duration, thumbnail, viewOnce) => {
      await onSendVideo(videoPath, duration, thumbnail, viewOnce);
    }, viewOnce);

    // Reset view once setting
    setViewOnce(false);
  };

  const handleCancel = () => {
    videoUploadActions.cancelRecording();
    setViewOnce(false);
  };

  const handleGalleryClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      await videoUploadActions.selectGalleryVideo(file);
    } catch (error) {
      console.error('Error selecting gallery video:', error);
    }

    // Reset input value
    event.target.value = '';
  };

  const handleTrimComplete = async (startTime: number, endTime: number, options?: ProcessingOptions) => {
    await videoUploadActions.trimGalleryVideo({ startTime, endTime }, options);
  };

  const handleTrimCancel = () => {
    videoUploadActions.cancelGalleryVideo();
  };

  // Gallery options interface (choose between original or edit)
  if (videoUploadState.isShowingGalleryOptions && videoUploadState.galleryVideoData && galleryVideoUrl) {
    return createPortal(
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t shadow-lg">
        <div className="max-w-md mx-auto p-4 space-y-3">
          {/* Video preview */}
          <div className="relative w-full flex justify-center">
            <video 
              src={galleryVideoUrl}
              className="w-full max-w-[200px] rounded-lg object-cover"
              controls={false}
              muted
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="bg-black/70 rounded-full p-2">
                <Video className="w-6 h-6 text-white" />
              </div>
            </div>
            <div className="absolute bottom-1 right-1 bg-black/70 px-1.5 py-0.5 rounded text-white text-xs">
              {formatDuration(videoUploadState.galleryVideoData.duration)}
            </div>
          </div>

          {/* Video info */}
          <div className="text-xs text-muted-foreground text-center">
            Tamanho: {formatFileSize(videoUploadState.galleryVideoData.file.size)}
          </div>

          {/* Options */}
          <div className="space-y-2">
            <Button
              onClick={() => videoUploadActions.uploadRawVideo(onSendVideo, viewOnce)}
              disabled={videoUploadState.isUploading}
              className="w-full h-10 text-sm"
            >
              {videoUploadState.isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  <span className="truncate">Enviando Original...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  <span className="truncate">Enviar Original</span>
                </>
              )}
            </Button>
            
            {/* Progress bar during upload */}
            {videoUploadState.isUploading && (
              <div className="space-y-2">
                <Progress value={videoUploadState.uploadProgress} className="w-full" />
                <div className="text-xs text-center text-muted-foreground">
                  {videoUploadState.uploadProgress}% enviado
                </div>
              </div>
            )}
            
            <Button
              variant="outline"
              onClick={videoUploadActions.chooseEditVideo}
              disabled={videoUploadState.isUploading}
              className="w-full h-10 text-sm"
            >
              <Video className="w-4 h-4 mr-2" />
              <span className="truncate">Editar Vídeo</span>
            </Button>
          </div>

          {/* View once option */}
          <div className="flex items-center justify-center space-x-2">
            <Switch
              id="view-once-gallery"
              checked={viewOnce}
              onCheckedChange={setViewOnce}
              disabled={videoUploadState.isUploading}
            />
            <Label htmlFor="view-once-gallery" className="text-sm cursor-pointer">
              Ver apenas uma vez
            </Label>
          </div>

          {/* Error display */}
          {videoUploadState.error && (
            <div className="text-sm text-destructive text-center">
              {videoUploadState.error}
            </div>
          )}

          {/* Cancel */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => videoUploadActions.cancelGalleryVideo()}
            disabled={videoUploadState.isUploading}
            className="w-full h-10"
          >
            <X className="w-4 h-4 mr-1" />
            Cancelar
          </Button>
        </div>
      </div>,
      document.body
    );
  }

  // Video trimmer interface
  if (videoUploadState.isTrimming && videoUploadState.galleryVideoData) {
    return createPortal(
      <LazyVideoTrimmer
        videoBlob={videoUploadState.galleryVideoData.file}
        videoDuration={videoUploadState.galleryVideoData.duration}
        onTrimComplete={handleTrimComplete}
        onCancel={handleTrimCancel}
        isProcessing={videoUploadState.isProcessing}
      />,
      document.body
    );
  }

  // Recording interface
  if (videoUploadState.isRecording) {
    return createPortal(
      <div className="fixed inset-0 bg-background z-50 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b bg-card">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <div className="absolute inset-0 bg-destructive rounded-full animate-ping opacity-75" />
                  <div className="relative h-3 w-3 bg-destructive rounded-full" />
                </div>
                <span className="text-sm font-medium tabular-nums">
                  {formatDuration(videoUploadState.recordingTime)}
                </span>
              </div>
              <Badge variant="destructive">REC</Badge>
              <Badge variant="outline" className="text-xs">
                {videoUploadActions.getCurrentFacingMode() === 'user' ? 'FRONTAL' : 'TRASEIRA'}
              </Badge>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsMinimized(!isMinimized)}
                className="md:hidden"
              >
                {isMinimized ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleCancel}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Video preview */}
          <div className={cn(
            "flex-1 bg-black flex items-center justify-center relative",
            isMinimized && "md:block hidden"
          )}>
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
            />
            
            {/* Recording controls overlay */}
            <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2">
              <div className="flex items-center gap-4 bg-black/70 backdrop-blur-sm rounded-full px-6 py-3">
                {/* Switch camera button */}
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => videoUploadActions.switchCamera()}
                  className="rounded-full h-12 w-12 text-white hover:bg-white/20"
                  title="Alternar câmera"
                >
                  <RotateCcw className="w-5 h-5" />
                </Button>
                
                {/* Stop recording button */}
                <Button
                  size="lg"
                  variant="destructive"
                  onClick={handleStopRecording}
                  className="rounded-full h-16 w-16"
                >
                  <div className="w-6 h-6 bg-white rounded-sm" />
                </Button>
              </div>
            </div>

            {/* Time limit warning */}
            {videoUploadState.recordingTime >= 100 && (
              <div className="absolute top-4 left-1/2 transform -translate-x-1/2">
                <Badge variant="destructive" className="animate-pulse">
                  {120 - videoUploadState.recordingTime}s restantes
                </Badge>
              </div>
            )}
          </div>
        </div>,
      document.body
    );
  }

  // Processing interface
  if (videoUploadState.isProcessing || videoUploadState.isLoadingGallery) {
    return createPortal(
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t shadow-lg p-4 flex items-center justify-center gap-3">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">
          {videoUploadState.isLoadingGallery ? 'Carregando vídeo...' : 'Processando vídeo...'}
        </span>
      </div>,
      document.body
    );
  }

  // Preview and send interface
  if (videoUploadState.videoData) {
    return createPortal(
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t shadow-lg p-4 space-y-4">
        {/* Video preview */}
        <div className="relative mx-auto max-w-sm">
          <img 
            src={videoUploadState.videoData.thumbnail} 
            alt="Video thumbnail" 
            className="w-full rounded-lg max-h-[60vh] object-cover"
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-black/70 rounded-full p-3">
              <Video className="w-8 h-8 text-white" />
            </div>
          </div>
          <div className="absolute bottom-2 right-2 bg-black/70 px-2 py-1 rounded text-white text-xs">
            {formatDuration(videoUploadState.videoData.duration)}
          </div>
        </div>

        {/* Video info */}
        <div className="text-xs text-muted-foreground text-center">
          Tamanho: {formatFileSize(videoUploadState.videoData.size)}
        </div>

        {/* View once option */}
        <div className="flex items-center justify-center space-x-2">
          <Switch
            id="view-once"
            checked={viewOnce}
            onCheckedChange={setViewOnce}
            disabled={videoUploadState.isUploading}
          />
          <Label htmlFor="view-once" className="text-sm cursor-pointer">
            Ver apenas uma vez
          </Label>
        </div>

        {/* Error display */}
        {videoUploadState.error && (
          <div className="text-sm text-destructive text-center">
            {videoUploadState.error}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 max-w-sm mx-auto w-full">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={videoUploadState.isUploading}
            className="flex-1"
          >
            <X className="w-4 h-4 mr-1" />
            Cancelar
          </Button>
          <Button
            onClick={handleSendVideo}
            disabled={videoUploadState.isUploading}
            className="flex-1"
          >
            {videoUploadState.isUploading ? (
              <>
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-1" />
                Enviar{viewOnce ? ' (1x)' : ''}
              </>
            )}
          </Button>
        </div>

        {/* Progress bar during upload */}
        {videoUploadState.isUploading && (
          <div className="space-y-2 max-w-sm mx-auto">
            <Progress value={videoUploadState.uploadProgress} className="w-full" />
            <div className="text-xs text-center text-muted-foreground">
              {videoUploadState.uploadProgress}% enviado
            </div>
          </div>
        )}
      </div>,
      document.body
    );
  }

  // Record/Gallery button
  return (
    <div className="flex items-center gap-2">
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        onChange={handleFileSelect}
        className="hidden"
      />
      
      <Button
        type="button"
        size="icon"
        variant="ghost"
        onClick={handleGalleryClick}
        disabled={disabled || videoUploadState.isRecording || videoUploadState.isProcessing}
        className={cn("h-8 w-8 flex flex-col items-center justify-center gap-0.5", className)}
        title="Selecionar vídeo da galeria"
      >
        <Video className="h-3 w-3" />
        <span className="text-[6px] font-bold leading-none">HD</span>
      </Button>
      
      <Button
        type="button"
        size="icon"
        variant="ghost"
        onClick={handleStartRecording}
        disabled={disabled || videoUploadState.isRecording || videoUploadState.isProcessing}
        className={cn("h-8 w-8 flex flex-col items-center justify-center gap-0.5", className)}
        title="Gravar novo vídeo"
      >
        <Video className="h-3 w-3 text-blue-500" />
        <span className="text-[6px] font-bold leading-none text-blue-600">CAM</span>
      </Button>
      
      {videoUploadState.error && (
        <div className="absolute bottom-full left-0 right-0 mb-2 p-2 bg-destructive/90 text-destructive-foreground text-xs rounded shadow-lg text-center z-50">
          {videoUploadState.error}
        </div>
      )}
    </div>
  );
};