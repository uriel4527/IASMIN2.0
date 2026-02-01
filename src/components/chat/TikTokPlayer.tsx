import React, { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Maximize2 } from 'lucide-react';
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from '@/components/ui/dialog';

interface TikTokPlayerProps {
  videoId?: string;
  url?: string;
  className?: string;
}

export const TikTokPlayer: React.FC<TikTokPlayerProps> = ({ videoId, url, className }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Se não tem url, tenta construir a partir do ID
  const targetUrl = url || (videoId ? `https://www.tiktok.com/@tiktok/video/${videoId}` : '');

  useEffect(() => {
    if (!targetUrl) return;

    const fetchVideo = async () => {
      setLoading(true);
      setError(false);
      try {
        // Tenta usar a API pública tikwm.com para pegar o link direto do vídeo (sem marca d'água)
        // Esta API é usada por vários projetos open source no GitHub
        const response = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(targetUrl)}`);
        const data = await response.json();

        if (data.code === 0 && data.data?.play) {
          setVideoUrl(data.data.play);
        } else {
          // Se falhar ou não tiver o link, cai no catch para tentar o fallback (embora aqui só seta erro por enquanto)
          console.error('TikTok API error:', data);
          setError(true);
        }
      } catch (err) {
        console.error('Failed to fetch TikTok video:', err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchVideo();
  }, [targetUrl]);

  if (!targetUrl) return null;

  // Renderiza o player de vídeo nativo se tivermos a URL direta
  if (videoUrl) {
    return (
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <div className={cn("relative w-full max-w-[325px] mx-auto rounded-lg overflow-hidden bg-black my-2 border border-border/50 group aspect-[9/16]", className)}>
          {!isOpen && (
            <video
              src={videoUrl}
              className="absolute top-0 left-0 w-full h-full object-cover"
              controls
              playsInline
              preload="metadata"
            />
          )}

          {isOpen && (
            <div className="absolute inset-0 bg-black/10 flex items-center justify-center">
              <p className="text-xs text-muted-foreground">Reproduzindo em tela cheia...</p>
            </div>
          )}

          <DialogTrigger asChild>
            <button
              className="absolute bottom-3 right-3 z-20 p-1.5 bg-black/50 hover:bg-black/70 text-white rounded-full backdrop-blur-sm opacity-100 transition-opacity"
              type="button"
              aria-label="Enter fullscreen"
            >
              <Maximize2 size={16} />
            </button>
          </DialogTrigger>
        </div>

        <DialogContent className="max-w-md w-full p-0 border-none bg-transparent shadow-none sm:max-w-lg h-[80vh] overflow-hidden">
          <DialogTitle className="sr-only">TikTok Video Fullscreen</DialogTitle>
          <div className="relative w-full h-full rounded-lg bg-black flex items-center justify-center">
             <video
              src={videoUrl}
              className="w-full h-full object-contain"
              controls
              autoPlay
              playsInline
            />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Fallback: Se der erro na API ou estiver carregando, mostra o estado de loading ou erro
  // Poderíamos manter o iframe como fallback, mas o usuário disse que fica tela branca.
  // Vamos tentar mostrar um botão para abrir o link original em caso de erro.
  
  if (loading) {
     return (
        <div className={cn("relative w-full max-w-[325px] mx-auto rounded-lg overflow-hidden bg-gray-100 dark:bg-zinc-900 my-2 border border-border/50 aspect-[9/16] flex flex-col items-center justify-center", className)}>
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white mb-2"></div>
            <p className="text-xs text-muted-foreground">Carregando vídeo...</p>
        </div>
     );
  }

  // Se deu erro, mostra opção de abrir no app/site
  return (
    <div className={cn("relative w-full max-w-[325px] mx-auto rounded-lg overflow-hidden bg-gray-100 dark:bg-zinc-900 my-2 border border-border/50 p-4 flex flex-col items-center justify-center text-center", className)}>
        <p className="text-sm text-red-500 mb-2">Não foi possível carregar o player.</p>
        <a 
            href={targetUrl} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="text-sm font-medium text-blue-500 hover:underline bg-white dark:bg-zinc-800 px-4 py-2 rounded-full border border-border shadow-sm"
        >
            Abrir no TikTok
        </a>
    </div>
  );
};

// Declaração global para evitar erro de TS com window.tiktokEmbed
declare global {
  interface Window {
    tiktokEmbed?: any;
  }
}
