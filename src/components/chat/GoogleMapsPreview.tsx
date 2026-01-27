import React from 'react';
import { MapPin, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface GoogleMapsPreviewProps {
  url: string;
}

export const GoogleMapsPreview: React.FC<GoogleMapsPreviewProps> = ({ url }) => {
  return (
    <div className="my-2">
      <Button
        variant="outline"
        className="flex items-center gap-3 w-full max-w-[280px] bg-white dark:bg-zinc-950 hover:bg-zinc-100 dark:hover:bg-zinc-900 h-auto py-3 px-4 border shadow-sm group transition-all"
        onClick={() => window.open(url, '_blank')}
      >
        <div className="bg-red-50 dark:bg-red-950/30 p-2.5 rounded-full shrink-0 group-hover:scale-110 transition-transform duration-200">
          <MapPin className="w-5 h-5 text-red-600 dark:text-red-500" />
        </div>
        <div className="flex flex-col items-start overflow-hidden text-left">
          <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate w-full">
            Localização Compartilhada
          </span>
          <span className="text-xs text-zinc-500 dark:text-zinc-400 truncate w-full flex items-center gap-1">
            Ver no Google Maps
            <ExternalLink className="w-3 h-3 opacity-70" />
          </span>
        </div>
      </Button>
    </div>
  );
};
