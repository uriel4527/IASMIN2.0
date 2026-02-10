import React, { memo } from 'react';
import { Card } from '@/components/ui/card';
import { SecretButton } from '@/components/flyboard/SecretButton';
import { PasswordModal } from '@/components/flyboard/PasswordModal';
import { GameUI } from '@/components/flyboard/GameUI';
import { GameCanvas } from '@/components/flyboard/GameCanvas';
import { OptimizedGameLoop } from '@/components/flyboard/OptimizedGameLoop';

interface GameState {
  gameStarted: boolean;
  gameOver: boolean;
  birdY: number;
  velocity: number;
  pipes: Array<{ x: number; gapY: number; scored?: boolean }>;
  score: number;
}

const initialGameState: GameState = {
  gameStarted: false,
  gameOver: false,
  birdY: 250,
  velocity: 0,
  pipes: [],
  score: 0
};

const OptimizedFlyboard = memo(() => {
  const [gameState, setGameState] = React.useState<GameState>(initialGameState);
  const [showPasswordInput, setShowPasswordInput] = React.useState(false);
  const [password, setPassword] = React.useState('');

  // Clear any previous chat access
  React.useEffect(() => {
    sessionStorage.removeItem('chatAccess');
    
    // Preload Chat2 and WebSocket connection if user is logged in
    const storedUser = localStorage.getItem('chatapp_user');
    if (storedUser) {
      try {
        // 1. Preload the Chat2 module
        import('@/pages/Chat2');
        
        // 2. Pre-warm WebSocket connection
        // We use a headless connection to start the handshake
        const wsUrl = 'wss://iasminnn.duckdns.org';
        const ws = new WebSocket(wsUrl);
        
        ws.onopen = () => {
          console.log('⚡ WebSocket pre-warmed');
          ws.close(); // Close immediately as we just want to warm up the SSL handshake/DNS
        };
        
        // Also preload critical assets for chat
        const preloadLink = document.createElement('link');
        preloadLink.rel = 'prefetch';
        preloadLink.href = '/assets/chat-bg.png'; // Assuming there's a background
        document.head.appendChild(preloadLink);
        
      } catch (e) {
        // Ignore preload errors
        console.log('Preload skipped');
      }
    }
  }, []);

  const handleSecretActivate = React.useCallback(() => {
    setShowPasswordInput(true);
  }, []);

  const handlePasswordChange = React.useCallback((value: string) => {
    setPassword(value);
  }, []);

  const handlePasswordModalClose = React.useCallback(() => {
    setPassword('');
    setShowPasswordInput(false);
  }, []);

  const handleGameStateChange = React.useCallback((updates: Partial<GameState>) => {
    setGameState(prev => ({ ...prev, ...updates }));
  }, []);

  const jump = React.useCallback(() => {
    if (!gameState.gameStarted) {
      handleGameStateChange({ gameStarted: true });
    }
    if (!gameState.gameOver && !showPasswordInput) {
      handleGameStateChange({ velocity: -8 });
    }
  }, [gameState.gameStarted, gameState.gameOver, showPasswordInput, handleGameStateChange]);

  const resetGame = React.useCallback(() => {
    setGameState(initialGameState);
  }, []);

  // Auto start game after 2 seconds
  React.useEffect(() => {
    if (!gameState.gameStarted && !gameState.gameOver) {
      const autoStart = setTimeout(() => {
        handleGameStateChange({ gameStarted: true });
      }, 2000);
      return () => clearTimeout(autoStart);
    }
  }, [gameState.gameStarted, gameState.gameOver, handleGameStateChange]);

  // Auto restart game immediately after game over
  React.useEffect(() => {
    if (gameState.gameOver) {
      const restartTimer = setTimeout(resetGame, 100);
      return () => clearTimeout(restartTimer);
    }
  }, [gameState.gameOver, resetGame]);

  // Keyboard controls - only when password modal is not open
  React.useEffect(() => {
    if (showPasswordInput) return;
    
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        jump();
      }
    };
    
    window.addEventListener('keydown', handleKeyPress, { passive: false });
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [jump, showPasswordInput]);

  return (
    <div className="h-screen-fixed bg-gradient-to-b from-sky-400 to-sky-600 flex flex-col items-center justify-center p-2 sm:p-4 relative overflow-hidden">
      {/* Secret Button */}
      <SecretButton onSecretActivate={handleSecretActivate} />

      <Card className="relative w-full max-w-[800px] aspect-[4/5] bg-sky-200 overflow-hidden border-2 sm:border-4 border-white/20">
        {/* Optimized Game Loop */}
        <OptimizedGameLoop
          gameState={gameState}
          onGameStateChange={handleGameStateChange}
          showPasswordInput={showPasswordInput}
        />

        {/* Game Canvas */}
        <GameCanvas
          gameStarted={gameState.gameStarted}
          gameOver={gameState.gameOver}
          birdY={gameState.birdY}
          velocity={gameState.velocity}
          pipes={gameState.pipes}
          onJump={jump}
        />

        {/* Game UI */}
        <GameUI
          score={gameState.score}
          gameStarted={gameState.gameStarted}
          gameOver={gameState.gameOver}
        />

        {/* Password Modal */}
        <PasswordModal
          isOpen={showPasswordInput}
          password={password}
          onPasswordChange={handlePasswordChange}
          onClose={handlePasswordModalClose}
        />
      </Card>
      
      <div className="mt-2 sm:mt-4 text-center">
        
      </div>
    </div>
  );
});

OptimizedFlyboard.displayName = 'OptimizedFlyboard';

export default OptimizedFlyboard;