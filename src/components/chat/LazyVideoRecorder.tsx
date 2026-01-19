import { lazy, Suspense } from 'react';
import { Loader2 } from 'lucide-react';

// Lazy load the actual VideoRecorder component
const VideoRecorder = lazy(() => import('./VideoRecorder').then(module => ({ default: module.VideoRecorder })));

interface VideoRecorderProps {
  onSendVideo: (videoPath: string, duration: number, thumbnail: string, viewOnce?: boolean) => Promise<void>;
  disabled?: boolean;
  className?: string;
  userId: string;
}

const LoadingFallback = () => (
  <div className="flex items-center gap-2 h-10 px-3">
    <Loader2 className="h-4 w-4 animate-spin" />
    <span className="text-sm">Carregando...</span>
  </div>
);

export const LazyVideoRecorder: React.FC<VideoRecorderProps> = (props) => {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <VideoRecorder {...props} />
    </Suspense>
  );
};