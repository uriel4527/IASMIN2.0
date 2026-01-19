import React from 'react';

interface GameUIProps {
  score: number;
  gameStarted: boolean;
  gameOver: boolean;
}

export const GameUI: React.FC<GameUIProps> = React.memo(({ score, gameStarted, gameOver }) => {
  return (
    <>
      {/* Score */}
      <div className="absolute top-2 sm:top-4 left-2 sm:left-4 text-xl sm:text-2xl font-bold text-white bg-black/30 px-2 sm:px-3 py-1 rounded z-10">
        {score}
      </div>

      {/* Game Over Screen */}
      {gameOver && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center animate-fade-in z-20">
          <div className="text-center text-white px-4">
            <h2 className="text-2xl sm:text-3xl font-bold mb-2">Game Over!</h2>
            <p className="text-lg sm:text-xl">Score: {score}</p>
          </div>
        </div>
      )}

      {/* Start Screen */}
      {!gameStarted && !gameOver && (
        <div className="absolute inset-0 bg-black/30 flex items-center justify-center animate-fade-in z-20">
          <div className="text-center text-white px-4">
            <h2 className="text-lg sm:text-2xl font-bold mb-2">Começando em breve...</h2>
            <p className="text-sm sm:text-base text-white/80">Toque para voar!</p>
          </div>
        </div>
      )}
    </>
  );
});