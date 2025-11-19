import { useState, useEffect, useRef, useCallback } from "react";

export interface UseAutoPlayOptions {
  onNext: () => void;
  onPrev: () => void;
}

export interface UseAutoPlayReturn {
  isPlaying: boolean;
  speed: number;
  reverse: boolean;
  togglePlay: () => void;
  setSpeed: (speed: number) => void;
  toggleReverse: () => void;
  pause: (duration: number) => void;
}

/**
 * Generic auto-play hook for content navigation
 * Provides play/pause, speed control, direction control, and temporary pausing
 */
export function useAutoPlay({ onNext, onPrev }: UseAutoPlayOptions): UseAutoPlayReturn {
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1.0); // 0.5x to 3.0x speed
  const [reverse, setReverse] = useState(false);
  const pausedUntil = useRef<number>(0); // Timestamp until which auto-play is paused

  const togglePlay = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  const toggleReverse = useCallback(() => {
    setReverse((prev) => !prev);
  }, []);

  const pause = useCallback((duration: number) => {
    pausedUntil.current = Date.now() + duration;
  }, []);

  // Auto play functionality with idling and reverse support
  useEffect(() => {
    if (!isPlaying) return;

    const baseInterval = 2400; // 2.4 seconds base interval
    const interval = setInterval(() => {
      // Check if auto-play is currently paused
      if (Date.now() < pausedUntil.current) {
        console.log("Auto-play paused, skipping navigation");
        return;
      }

      // Navigate in the appropriate direction
      if (reverse) {
        onPrev();
      } else {
        onNext();
      }
    }, baseInterval / speed);

    return () => clearInterval(interval);
  }, [isPlaying, speed, reverse, onNext, onPrev]);

  return {
    isPlaying,
    speed,
    reverse,
    togglePlay,
    setSpeed,
    toggleReverse,
    pause,
  };
}
