import { lazy, Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { ProcessingOptions } from '@/utils/videoCompression';

// Lazy load the actual VideoTrimmer component
const VideoTrimmer = lazy(() => import('./VideoTrimmer').then(module => ({ default: module.VideoTrimmer })));

interface VideoTrimmerProps {
  videoBlob: Blob;
  videoDuration: number;
  onTrimComplete: (startTime: number, endTime: number, options?: ProcessingOptions) => void;
  onCancel: () => void;
  isProcessing: boolean;
}

const LoadingFallback = () => (
  <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
    <div className="flex flex-col items-center gap-3 bg-card p-6 rounded-lg border shadow-lg">
      <Loader2 className="h-8 w-8 animate-spin" />
      <span className="text-sm">Carregando editor de vídeo...</span>
    </div>
  </div>
);

export const LazyVideoTrimmer: React.FC<VideoTrimmerProps> = (props) => {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <VideoTrimmer {...props} />
    </Suspense>
  );
};