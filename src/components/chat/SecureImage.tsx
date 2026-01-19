import React, { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';

interface SecureImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
}

export const SecureImage: React.FC<SecureImageProps> = ({ src, className, alt, ...props }) => {
  const [currentSrc, setCurrentSrc] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!src) return;

    let blobUrl: string | null = null;
    const controller = new AbortController();

    const loadWithProgress = async (url: string) => {
      try {
        setIsLoading(true);
        setProgress(5); // Start progress
        setError(false);

        const response = await fetch(url, {
          signal: controller.signal
        });

        if (!response.ok) throw new Error('Network response was not ok');

        const contentLength = response.headers.get('content-length');
        const total = contentLength ? parseInt(contentLength, 10) : 0;
        let loaded = 0;

        const reader = response.body?.getReader();
        if (!reader) throw new Error('ReadableStream not supported');

        const chunks = [];
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          chunks.push(value);
          loaded += value.length;
          
          if (mountedRef.current) {
            if (total) {
              setProgress(Math.min(Math.round((loaded / total) * 100), 99));
            } else {
              // Simulated progress if no content-length
              setProgress(prev => Math.min(prev + 5, 90));
            }
          }
        }

        const blob = new Blob(chunks);
        blobUrl = URL.createObjectURL(blob);
        
        if (mountedRef.current) {
          setCurrentSrc(blobUrl);
          setProgress(100);
          setTimeout(() => {
            if (mountedRef.current) setIsLoading(false);
          }, 300); // Small delay to show 100%
        }

      } catch (err) {
        if (!mountedRef.current) return;
        // If aborted, do nothing
        if (err instanceof DOMException && err.name === 'AbortError') return;
        
        console.error('Failed to load image with progress:', err);
        throw err;
      }
    };

    const initLoad = async () => {
        // Try HTTPS first if it's an HTTP URL
        if (src.startsWith('http://')) {
            const httpsUrl = src.replace('http://', 'https://');
            try {
                await loadWithProgress(httpsUrl);
            } catch (e) {
                console.log('HTTPS image load failed, trying HTTP...', e);
                try {
                    // Reset progress for second attempt
                    if (mountedRef.current) setProgress(0);
                    await loadWithProgress(src);
                } catch (e2) {
                    if (mountedRef.current) setError(true);
                }
            }
        } else {
            // Already HTTPS or other protocol
            try {
                await loadWithProgress(src);
            } catch (e) {
                if (mountedRef.current) setError(true);
            }
        }
    };

    initLoad();

    return () => {
      controller.abort();
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [src]);

  return (
    <div className={cn("relative inline-block overflow-hidden", className)}>
      {/* Loading Overlay */}
      {isLoading && !error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/20 backdrop-blur-sm z-10 p-4">
          <div className="w-full max-w-[80%] space-y-2">
            <div className="flex justify-between text-xs text-white font-medium drop-shadow-md">
              <span>Baixando...</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="h-1.5 w-full bg-white/30" />
          </div>
        </div>
      )}

      <img
        src={currentSrc || src} // Fallback to original src if blob isn't ready (though we hide it with overlay)
        alt={alt}
        className={cn(
          "w-full h-full object-cover transition-opacity duration-300", 
          isLoading ? "opacity-0" : "opacity-100"
        )}
        {...props}
        onError={(e) => {
           if (!isLoading) {
             // Only show fallback if we're not manually loading
             e.currentTarget.style.display = 'none';
             setError(true);
           }
        }}
      />
      
      {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 text-gray-400 text-xs">
              Erro ao carregar
          </div>
      )}
    </div>
  );
};
