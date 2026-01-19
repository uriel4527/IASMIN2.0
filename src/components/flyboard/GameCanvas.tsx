import React from 'react';

interface Pipe {
  x: number;
  gapY: number;
}

interface GameCanvasProps {
  gameStarted: boolean;
  gameOver: boolean;
  birdY: number;
  velocity: number;
  pipes: Pipe[];
  onJump: () => void;
}

export const GameCanvas: React.FC<GameCanvasProps> = React.memo(({
  gameStarted,
  gameOver,
  birdY,
  velocity,
  pipes,
  onJump
}) => {
  const handleCanvasClick = React.useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!gameOver) {
      onJump();
    }
  }, [gameOver, onJump]);

  const handleCanvasTouch = React.useCallback((e: React.TouchEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!gameOver) {
      onJump();
    }
  }, [gameOver, onJump]);

  return (
    <div 
      className="absolute inset-0 cursor-pointer touch-manipulation"
      onClick={handleCanvasClick}
      onTouchStart={handleCanvasTouch}
      style={{ 
        zIndex: 1,
        touchAction: 'manipulation'
      }}
    >
      {/* Bird */}
      <div 
        className="absolute w-6 h-6 sm:w-8 sm:h-8 bg-yellow-400 rounded-full border-2 border-orange-400 transition-transform duration-75 z-10"
        style={{
          left: '50px',
          top: `${birdY / 600 * 100}%`,
          transform: `rotate(${velocity * 3}deg)`
        }} 
      />

      {/* Pipes - Only render visible ones */}
      {pipes.filter(pipe => pipe.x > -100 && pipe.x < 600).map((pipe, index) => (
        <div key={index}>
          {/* Top pipe */}
          <div 
            className="absolute w-12 sm:w-16 bg-green-500 border-2 sm:border-4 border-green-600 z-5"
            style={{
              left: `${pipe.x / 500 * 100}%`,
              top: '0px',
              height: `${pipe.gapY / 600 * 100}%`
            }} 
          />
          {/* Bottom pipe */}
          <div 
            className="absolute w-12 sm:w-16 bg-green-500 border-2 sm:border-4 border-green-600 z-5"
            style={{
              left: `${pipe.x / 500 * 100}%`,
              top: `${(pipe.gapY + 120) / 600 * 100}%`,
              height: `${(600 - pipe.gapY - 120) / 600 * 100}%`
            }} 
          />
        </div>
      ))}
    </div>
  );
});