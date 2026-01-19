import React, { useState } from 'react';
import { X, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SecureImage } from './SecureImage';

interface ImageViewerProps {
  src: string;
  alt: string;
  onClose: () => void;
}

export const ImageViewer: React.FC<ImageViewerProps> = ({ src, alt, onClose }) => {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const handleZoomIn = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setScale(s => Math.min(s + 0.5, 4));
  };
  
  const handleZoomOut = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setScale(s => Math.max(s - 0.5, 1));
  };
  
  const handleReset = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale > 1) {
      e.preventDefault();
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && scale > 1) {
      e.preventDefault();
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.deltaY < 0) {
      handleZoomIn();
    } else {
      handleZoomOut();
    }
  };

  return (
    <div className="relative w-full h-full flex flex-col overflow-hidden select-none">
        {/* Controls Overlay */}
        <div className="absolute top-4 right-4 z-50 flex items-center gap-2">
            <Button variant="secondary" size="icon" className="h-8 w-8 rounded-full opacity-80 hover:opacity-100 shadow-lg" onClick={handleZoomOut} title="Diminuir Zoom">
                <ZoomOut className="h-4 w-4" />
            </Button>
            <Button variant="secondary" size="icon" className="h-8 w-8 rounded-full opacity-80 hover:opacity-100 shadow-lg" onClick={handleReset} title="Resetar">
                <RotateCcw className="h-4 w-4" />
            </Button>
            <Button variant="secondary" size="icon" className="h-8 w-8 rounded-full opacity-80 hover:opacity-100 shadow-lg" onClick={handleZoomIn} title="Aumentar Zoom">
                <ZoomIn className="h-4 w-4" />
            </Button>
            <div className="w-2" /> {/* Spacer */}
            <Button variant="destructive" size="icon" className="h-8 w-8 rounded-full opacity-80 hover:opacity-100 shadow-lg" onClick={onClose} title="Fechar">
                <X className="h-4 w-4" />
            </Button>
        </div>

        {/* Image Area */}
        <div 
            className="flex-1 w-full h-full flex items-center justify-center cursor-move"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
        >
            <div 
                style={{ 
                    transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                    transition: isDragging ? 'none' : 'transform 0.2s ease-out'
                }}
                className="relative flex items-center justify-center w-full h-full"
            >
                <SecureImage 
                    src={src} 
                    alt={alt} 
                    className="max-w-full max-h-full object-contain pointer-events-none" 
                    onError={(e) => {
                        console.error('Erro ao carregar imagem no visualizador');
                        // Fallback SVG
                        e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5YTNhZiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkVycm8gYW8gY2FycmVnYXIgaW1hZ2VtPC90ZXh0Pjwvc3ZnPg==';
                    }}
                />
            </div>
        </div>
        
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/70 text-[10px] pointer-events-none bg-black/30 px-3 py-1 rounded-full backdrop-blur-sm">
            {Math.round(scale * 100)}%
        </div>
    </div>
  );
};
