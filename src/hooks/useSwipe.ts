import { useState, useRef, useCallback } from 'react';

interface UseSwipeProps {
  onSwipeRight?: () => void;
  onSwipeLeft?: () => void;
  onSwipeRightLong?: () => void;
  threshold?: number;
  deleteThreshold?: number;
  isOwn?: boolean;
}

export const useSwipe = ({
  onSwipeRight,
  onSwipeLeft,
  onSwipeRightLong,
  threshold = 60,
  deleteThreshold = 120,
  isOwn = false
}: UseSwipeProps) => {
  const [isSwipeActive, setIsSwipeActive] = useState(false);
  const [swipeDistance, setSwipeDistance] = useState(0);
  const [swipeType, setSwipeType] = useState<'reply' | 'delete' | 'edit' | null>(null);
  const startPos = useRef<{ x: number; y: number } | null>(null);
  const currentPos = useRef<{ x: number; y: number } | null>(null);
  const isSwiping = useRef(false);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length > 1) return;
    
    const touch = e.touches[0];
    startPos.current = { x: touch.clientX, y: touch.clientY };
    currentPos.current = { x: touch.clientX, y: touch.clientY };
    isSwiping.current = false;
    setSwipeDistance(0);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!startPos.current || e.touches.length > 1) return;
    
    const touch = e.touches[0];
    currentPos.current = { x: touch.clientX, y: touch.clientY };
    
    const deltaX = touch.clientX - startPos.current.x;
    const deltaY = Math.abs(touch.clientY - startPos.current.y);
    
    // Only consider horizontal swipes (vertical movement should be minimal)
    if (deltaY > 30) {
      return;
    }
    
    // Start tracking swipe if horizontal movement is significant
    if (Math.abs(deltaX) > 10 && !isSwiping.current) {
      isSwiping.current = true;
      setIsSwipeActive(true);
    }
    
    if (isSwiping.current) {
      setSwipeDistance(deltaX);
      
      // Determine swipe type based on distance and direction
      if (deltaX < 0) {
        // Swipe left - delete for own messages, reply for others
        if (Math.abs(deltaX) >= threshold) {
          setSwipeType(isOwn ? 'delete' : 'reply');
        } else {
          setSwipeType(null);
        }
      } else {
        // Swipe right - reply or edit action
        if (Math.abs(deltaX) >= deleteThreshold) {
          setSwipeType('edit');
        } else if (Math.abs(deltaX) >= threshold) {
          setSwipeType('reply');
        } else {
          setSwipeType(null);
        }
      }
      
      // Prevent scrolling during swipe (only if not passive)
      try {
        e.preventDefault();
      } catch (error) {
        // Ignore preventDefault error in passive listeners
      }
    }
  }, [threshold, deleteThreshold, isOwn]);

  const handleTouchEnd = useCallback(() => {
    if (!startPos.current || !currentPos.current || !isSwiping.current) {
      setIsSwipeActive(false);
      setSwipeDistance(0);
      setSwipeType(null);
      return;
    }
    
    const deltaX = currentPos.current.x - startPos.current.x;
    
    if (deltaX < 0) {
      // Swipe left - delete for own messages, reply for others
      if (Math.abs(deltaX) >= threshold) {
        onSwipeLeft?.();
      }
    } else {
      // Swipe right - reply or edit action
      if (Math.abs(deltaX) >= deleteThreshold) {
        onSwipeRightLong?.();
      } else if (Math.abs(deltaX) >= threshold) {
        onSwipeRight?.();
      }
    }
    
    // Reset state
    startPos.current = null;
    currentPos.current = null;
    isSwiping.current = false;
    setIsSwipeActive(false);
    setSwipeDistance(0);
    setSwipeType(null);
  }, [onSwipeRight, onSwipeLeft, onSwipeRightLong, threshold, deleteThreshold]);

  return {
    isSwipeActive,
    swipeDistance,
    swipeType,
    handlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
      onTouchCancel: handleTouchEnd,
    }
  };
};