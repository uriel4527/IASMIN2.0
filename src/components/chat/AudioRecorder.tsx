import React, { useState, useEffect, useRef } from 'react';
import { Mic, Send, X, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { AudioRecorder as Recorder, formatDuration } from '@/utils/audioCompression';
import { useAudioUpload } from '@/hooks/useAudioUpload';
import { toast } from 'sonner';


interface AudioRecorderProps {
  onSendAudio: (audioData: string, duration: number) => void;
  disabled?: boolean;
  className?: string;
  onRecordingChange?: (isRecording: boolean) => void;
}

export const AudioRecorder: React.FC<AudioRecorderProps> = ({ 
  onSendAudio, 
  disabled = false,
  className,
  onRecordingChange
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const recorderRef = useRef<Recorder>(new Recorder());
  const intervalRef = useRef<NodeJS.Timeout>();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const { uploadAudio } = useAudioUpload();

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      recorderRef.current.cancelRecording();
    };
  }, []);

  const startRecording = async () => {
    if (disabled || isProcessing) return;
    
    try {
      // Set recording state immediately for instant visual feedback
      setIsRecording(true);
      onRecordingChange?.(true);
      
      await recorderRef.current.startRecording();
      setRecordingTime(0);
      
      // Vibrate feedback
      if ('vibrate' in navigator) {
        navigator.vibrate(50);
      }
      
      // Start timer
      intervalRef.current = setInterval(() => {
        setRecordingTime(prev => {
          const newTime = prev + 1;
          // Auto-stop at 5 minutes
          if (newTime >= 300) {
            finishRecording();
            return prev;
          }
          return newTime;
        });
      }, 1000);
    } catch (error) {
      console.error("Erro ao gravar áudio:", error);
      // Reset states if recording failed
      setIsRecording(false);
      onRecordingChange?.(false);
    }
  };

  const finishRecording = async () => {
    if (!isRecording) return;
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    
    setIsProcessing(true);
    try {
      const audioData = await recorderRef.current.stopRecording();
      
      // Upload audio to backend
      const audioUrl = await uploadAudio(audioData.compressedFile);
      
      if (audioUrl) {
        onSendAudio(audioUrl, audioData.duration);
      } else {
        toast.error('Erro ao enviar áudio');
      }
    } catch (error) {
      console.error("Erro ao processar áudio:", error);
      toast.error('Erro ao gravar áudio');
    } finally {
      resetState();
    }
  };

  const cancelRecording = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    recorderRef.current.cancelRecording();
    resetState();
  };

  const resetState = () => {
    setIsRecording(false);
    onRecordingChange?.(false);
    setIsProcessing(false);
    setRecordingTime(0);
  };

  // Click handler for initial record button
  const handleStartClick = async (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    
    if (disabled || isProcessing) return;
    
    // Start recording immediately
    await startRecording();
  };

  // Click handler for send button during recording
  const handleSendClick = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    finishRecording();
  };

  if (isRecording) {
    return (
      <div className={cn("relative flex items-center gap-3", className)}>
        {/* Recording status with timer */}
        <div className="flex items-center gap-2 px-3 py-2 bg-destructive/10 rounded-lg border border-destructive/20">
          <div className="relative">
            <div className="absolute inset-0 bg-destructive rounded-full animate-ping opacity-75" />
            <div className="relative h-3 w-3 bg-destructive rounded-full" />
          </div>
          <span className="text-sm font-mono font-medium tabular-nums">
            {formatDuration(recordingTime)}
          </span>
        </div>

        {/* Send button */}
        <Button
          type="button"
          size="icon"
          variant="default"
          disabled={isProcessing}
          className="h-8 w-8 bg-green-500 hover:bg-green-600 text-white"
          onClick={handleSendClick}
        >
          {isProcessing ? (
            <Loader2 className="h-4 w-4 animate-spin text-white" />
          ) : (
            <Send className="h-4 w-4 text-white" />
          )}
        </Button>

        {/* Cancel button */}
        <Button
          type="button"
          size="icon"
          variant="default"
          disabled={isProcessing}
          className="h-8 w-8 bg-red-500 hover:bg-red-600 text-white"
          onClick={cancelRecording}
        >
          <X className="h-4 w-4 text-white" />
        </Button>
      </div>
    );
  }

  return (
    <Button
      ref={buttonRef}
      type="button"
      size="icon"
      variant="ghost"
      disabled={disabled || isProcessing}
      className={cn("h-10 w-10 flex flex-col items-center justify-center gap-0.5 transition-all duration-150", className)}
      onClick={handleStartClick}
    >
      {isProcessing ? (
        <Loader2 className="h-4 w-4 animate-spin text-red-500" />
      ) : (
        <>
          <Mic className="h-4 w-4 text-red-500" />
          <span className="text-[8px] font-bold leading-none text-red-600">RECORD</span>
        </>
      )}
    </Button>
  );
};