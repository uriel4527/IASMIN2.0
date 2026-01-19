import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export const useMessageCleanup = () => {
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const [lastCleanup, setLastCleanup] = useState<string | null>(null);

  const cleanupOldMessages = async () => {
    try {
      setIsCleaningUp(true);
      
      // Call the cleanup function
      const { data, error } = await supabase.rpc('cleanup_old_messages');
      
      if (error) {
        console.error('Error cleaning up messages:', error);
        return false;
      }

      if (data > 0) {
        console.log(`Cleaned up ${data} old messages`);
      }

      // Store last cleanup time
      const now = new Date().toISOString();
      localStorage.setItem('lastMessageCleanup', now);
      setLastCleanup(now);
      
      return true;
    } catch (error) {
      console.error('Error during message cleanup:', error);
      return false;
    } finally {
      setIsCleaningUp(false);
    }
  };

  const shouldCleanup = () => {
    const stored = localStorage.getItem('lastMessageCleanup');
    if (!stored) return true;

    const lastCleanupTime = new Date(stored);
    const now = new Date();
    const timeDiff = now.getTime() - lastCleanupTime.getTime();
    const hoursDiff = timeDiff / (1000 * 3600);

    // Cleanup if more than 12 hours have passed
    return hoursDiff > 12;
  };

  useEffect(() => {
    const stored = localStorage.getItem('lastMessageCleanup');
    setLastCleanup(stored);

    // Auto cleanup on component mount if needed
    if (shouldCleanup()) {
      cleanupOldMessages();
    }
  }, []);

  return {
    cleanupOldMessages,
    isCleaningUp,
    lastCleanup,
    shouldCleanup
  };
};