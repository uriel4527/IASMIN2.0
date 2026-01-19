import { useState, useEffect, useRef, useCallback } from 'react';

interface UseContextMenuProps {
  onLongPress?: () => void;
  onRightClick?: (e: React.MouseEvent) => void;
  longPressDelay?: number;
}

export const useContextMenu = ({
  onLongPress,
  onRightClick,
  longPressDelay = 800
}: UseContextMenuProps) => {
  const [isLongPress, setIsLongPress] = useState(false);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const startPos = useRef<{ x: number; y: number } | null>(null);
  const isPressed = useRef(false);

  const isInteractiveTarget = useCallback((target: HTMLElement): boolean => {
    const interactiveElements = ['BUTTON', 'IMG', 'VIDEO', 'AUDIO', 'INPUT', 'TEXTAREA', 'A', 'CANVAS', 'SVG', 'PATH'];
    
    return interactiveElements.includes(target.tagName) || 
           target.hasAttribute('role') && ['button', 'slider', 'menuitem'].includes(target.getAttribute('role') || '') ||
           target.hasAttribute('data-interactive') ||
           target.classList.contains('interactive') ||
           !!target.closest('button') ||
           !!target.closest('img') ||
           !!target.closest('audio') ||
           !!target.closest('video') ||
           !!target.closest('canvas') ||
           !!target.closest('[role="button"]') ||
           !!target.closest('[role="slider"]') ||
           !!target.closest('[data-interactive]') ||
           !!target.closest('.interactive');
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    // Don't handle multi-touch
    if (e.touches.length > 1) {
      return;
    }

    const target = e.target as HTMLElement;
    
    // Don't start long press on interactive elements
    if (isInteractiveTarget(target)) {
      return;
    }

    isPressed.current = true;
    const touch = e.touches[0];
    startPos.current = { x: touch.clientX, y: touch.clientY };
    
    longPressTimer.current = setTimeout(() => {
      if (isPressed.current) {
        setIsLongPress(true);
        onLongPress?.();
        // Vibrate if available
        if ('vibrate' in navigator) {
          navigator.vibrate(50);
        }
      }
    }, longPressDelay);
  }, [onLongPress, longPressDelay, isInteractiveTarget]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!startPos.current) return;
    
    const touch = e.touches[0];
    const deltaX = Math.abs(touch.clientX - startPos.current.x);
    const deltaY = Math.abs(touch.clientY - startPos.current.y);
    
    // Cancel long press if moved more than 10px
    if (deltaX > 10 || deltaY > 10) {
      clearLongPressTimer();
      return;
    }

    // Cancel long press if finger is now over an interactive element
    const elementUnderFinger = document.elementFromPoint(touch.clientX, touch.clientY) as HTMLElement;
    if (elementUnderFinger && isInteractiveTarget(elementUnderFinger)) {
      clearLongPressTimer();
    }
  }, [isInteractiveTarget]);

  const handleTouchEnd = useCallback(() => {
    isPressed.current = false;
    clearLongPressTimer();
    setIsLongPress(false);
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    onRightClick?.(e);
  }, [onRightClick]);

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearLongPressTimer();
    };
  }, [clearLongPressTimer]);

  return {
    isLongPress,
    handlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
      onTouchCancel: handleTouchEnd,
      onContextMenu: handleContextMenu
    }
  };
};