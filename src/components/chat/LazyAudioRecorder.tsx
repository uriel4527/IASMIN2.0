import { lazy, Suspense } from 'react';
import { Loader2 } from 'lucide-react';

// Lazy load the actual AudioRecorder component
const AudioRecorder = lazy(() => import('./AudioRecorder').then(module => ({ default: module.AudioRecorder })));

interface AudioRecorderProps {
  onSendAudio: (audioData: string, duration: number) => void;
  disabled?: boolean;
  className?: string;
  onRecordingChange?: (isRecording: boolean) => void;
}

const LoadingFallback = () => (
  <div className="flex items-center justify-center h-10 w-10">
    <Loader2 className="h-4 w-4 animate-spin" />
  </div>
);

export const LazyAudioRecorder: React.FC<AudioRecorderProps> = (props) => {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <AudioRecorder {...props} />
    </Suspense>
  );
};