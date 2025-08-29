import { useRef, useCallback } from 'react';

interface TapDetectionOptions {
  onTap: () => void;
  movementThreshold?: number;
  timeThreshold?: number;
}

interface PointerPosition {
  x: number;
  y: number;
  timestamp: number;
}

export const useTapDetection = ({ 
  onTap, 
  movementThreshold = 5, 
  timeThreshold = 1000 
}: TapDetectionOptions) => {
  const startPositionRef = useRef<PointerPosition | null>(null);
  const isPointerDownRef = useRef(false);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    // Only handle primary pointer (first finger on touch, left mouse button)
    if (!e.isPrimary) return;

    isPointerDownRef.current = true;
    startPositionRef.current = {
      x: e.clientX,
      y: e.clientY,
      timestamp: Date.now()
    };

    // Prevent default to avoid unwanted behaviors
    e.preventDefault();
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    // Only handle primary pointer
    if (!e.isPrimary) return;
    
    if (!isPointerDownRef.current || !startPositionRef.current) {
      isPointerDownRef.current = false;
      startPositionRef.current = null;
      return;
    }

    const endPosition = {
      x: e.clientX,
      y: e.clientY,
      timestamp: Date.now()
    };

    const deltaX = Math.abs(endPosition.x - startPositionRef.current.x);
    const deltaY = Math.abs(endPosition.y - startPositionRef.current.y);
    const deltaTime = endPosition.timestamp - startPositionRef.current.timestamp;
    const totalMovement = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    // Reset state
    isPointerDownRef.current = false;
    startPositionRef.current = null;

    // Check if this qualifies as a tap
    if (totalMovement < movementThreshold && deltaTime < timeThreshold) {
      onTap();
    }
  }, [onTap, movementThreshold, timeThreshold]);

  const handlePointerCancel = useCallback(() => {
    isPointerDownRef.current = false;
    startPositionRef.current = null;
  }, []);

  const handlePointerLeave = useCallback(() => {
    // Reset if pointer leaves the element
    isPointerDownRef.current = false;
    startPositionRef.current = null;
  }, []);

  return {
    onPointerDown: handlePointerDown,
    onPointerUp: handlePointerUp,
    onPointerCancel: handlePointerCancel,
    onPointerLeave: handlePointerLeave,
  };
};