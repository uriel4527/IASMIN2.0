import React from 'react';

interface Pipe {
  x: number;
  gapY: number;
  scored?: boolean;
}

interface GameState {
  gameStarted: boolean;
  gameOver: boolean;
  birdY: number;
  velocity: number;
  pipes: Pipe[];
  score: number;
}

interface OptimizedGameLoopProps {
  gameState: GameState;
  onGameStateChange: (updates: Partial<GameState>) => void;
  showPasswordInput: boolean;
}

export const OptimizedGameLoop: React.FC<OptimizedGameLoopProps> = ({
  gameState,
  onGameStateChange,
  showPasswordInput
}) => {
  const animationFrameRef = React.useRef<number>();
  const lastTimeRef = React.useRef<number>(0);
  const gameStateRef = React.useRef(gameState);

  // Keep game state ref updated
  React.useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  const gameLoop = React.useCallback((currentTime: number) => {
    const deltaTime = currentTime - lastTimeRef.current;
    
    // Target 60 FPS, skip frame if too early
    if (deltaTime < 16.67) {
      animationFrameRef.current = requestAnimationFrame(gameLoop);
      return;
    }
    
    lastTimeRef.current = currentTime;
    const state = gameStateRef.current;
    
    if (!state.gameStarted || state.gameOver || showPasswordInput) {
      animationFrameRef.current = requestAnimationFrame(gameLoop);
      return;
    }

    let updates: Partial<GameState> = {};
    let newBirdY = state.birdY + state.velocity;
    let newVelocity = state.velocity + 0.5; // gravity

    // Ground and ceiling collision
    if (newBirdY > 580 || newBirdY < 0) {
      updates.gameOver = true;
      updates.birdY = state.birdY;
      updates.velocity = state.velocity;
      onGameStateChange(updates);
      return;
    }

    // Update pipes
    let newPipes = state.pipes.map(pipe => ({
      ...pipe,
      x: pipe.x - 3
    }));

    // Remove off-screen pipes
    newPipes = newPipes.filter(pipe => pipe.x > -100);

    // Add new pipe when needed
    if (newPipes.length === 0 || newPipes[newPipes.length - 1].x < 200) {
      newPipes.push({
        x: 500,
        gapY: Math.random() * 200 + 150,
        scored: false
      });
    }

    // Collision detection - only check pipes near bird
    let newScore = state.score;
    const nearbyPipes = newPipes.filter(pipe => pipe.x > 20 && pipe.x < 80);
    
    for (const pipe of nearbyPipes) {
      // Collision check
      if (pipe.x < 80 && pipe.x > 20) {
        if (newBirdY < pipe.gapY || newBirdY > pipe.gapY + 120) {
          updates.gameOver = true;
          onGameStateChange(updates);
          return;
        }
      }

      // Score check - only once per pipe
      if (!pipe.scored && pipe.x < 50) {
        pipe.scored = true;
        newScore++;
      }
    }

    updates = {
      birdY: newBirdY,
      velocity: newVelocity,
      pipes: newPipes,
      score: newScore
    };

    onGameStateChange(updates);
    animationFrameRef.current = requestAnimationFrame(gameLoop);
  }, [onGameStateChange, showPasswordInput]);

  React.useEffect(() => {
    if (gameState.gameStarted && !gameState.gameOver && !showPasswordInput) {
      lastTimeRef.current = performance.now();
      animationFrameRef.current = requestAnimationFrame(gameLoop);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [gameState.gameStarted, gameState.gameOver, showPasswordInput, gameLoop]);

  return null; // This component only handles logic
};
