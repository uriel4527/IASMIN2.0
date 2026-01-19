import { lazy, Suspense } from 'react';
import { Loader2 } from 'lucide-react';

// Lazy load the actual SimpleChatInterface component
const SimpleChatInterface = lazy(() => import('./SimpleChatInterface').then(module => ({ default: module.SimpleChatInterface })));

const ChatLoadingFallback = () => (
  <div className="h-screen-fixed flex items-center justify-center tech-pattern-bg">
    <div className="flex flex-col items-center gap-4">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <div className="text-center">
        <h2 className="text-lg font-semibold">Carregando Chat</h2>
        <p className="text-sm text-muted-foreground">Preparando a interface...</p>
      </div>
    </div>
  </div>
);

export const LazyChatInterface: React.FC = () => {
  return (
    <Suspense fallback={<ChatLoadingFallback />}>
      <SimpleChatInterface />
    </Suspense>
  );
};