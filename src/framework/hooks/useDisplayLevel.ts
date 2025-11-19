import { useState, useEffect, useRef } from "react";

export interface UseDisplayLevelOptions {
  sceneIndex?: number | null;
}

export interface UseDisplayLevelReturn {
  displayLevel: number;
}

/**
 * Progressive UI reveal system based on mouse interaction
 * Manages 4 display levels:
 * - Level 0: Image only (cursor hidden)
 * - Level 1: + Scene name
 * - Level 2: + Page info
 * - Level 3: + All controls
 */
export function useDisplayLevel({ sceneIndex }: UseDisplayLevelOptions): UseDisplayLevelReturn {
  const [displayLevel, setDisplayLevel] = useState(0);
  const displayLevelRef = useRef(0);
  const mouseIdleTimer = useRef<NodeJS.Timeout | null>(null);
  const level2Timer = useRef<NodeJS.Timeout | null>(null);
  const level3Timer = useRef<NodeJS.Timeout | null>(null);
  const previousSceneIndex = useRef<number | null>(null);
  const lastMouseDownLevel = useRef<{level: number, timestamp: number}>({level: 0, timestamp: 0});

  // Keep displayLevelRef in sync with displayLevel state
  useEffect(() => {
    displayLevelRef.current = displayLevel;
  }, [displayLevel]);

  // Scene change detection: transition from level 0 to level 1
  useEffect(() => {
    if (sceneIndex !== undefined && sceneIndex !== null) {
      // Check if scene has changed
      if (previousSceneIndex.current !== null &&
          previousSceneIndex.current !== sceneIndex) {
        // Check if the scene change happened shortly after a mouse down (within 500ms)
        // If so, use the display level before the mouse down to determine transition
        const timeSinceMouseDown = Date.now() - lastMouseDownLevel.current.timestamp;
        const levelToCheck = timeSinceMouseDown < 500
          ? lastMouseDownLevel.current.level
          : displayLevelRef.current;

        // Scene changed - if at level 0, transition to level 1
        if (levelToCheck === 0) {
          setDisplayLevel(1);

          // Set idle timer to return to level 0 after 3s
          if (mouseIdleTimer.current) {
            clearTimeout(mouseIdleTimer.current);
          }
          mouseIdleTimer.current = setTimeout(() => {
            setDisplayLevel(0);
          }, 3000);
        }
      }
      // Update previous scene index
      previousSceneIndex.current = sceneIndex;
    }
  }, [sceneIndex]);

  // Mouse hover and idle detection for display level control
  useEffect(() => {
    const handleMouseMove = () => {
      // Always clear idle timer
      if (mouseIdleTimer.current) {
        clearTimeout(mouseIdleTimer.current);
      }

      // Only start progressive reveal if currently at level 0
      if (displayLevelRef.current === 0) {
        // Clear progression timers only when starting from level 0
        if (level2Timer.current) {
          clearTimeout(level2Timer.current);
        }
        if (level3Timer.current) {
          clearTimeout(level3Timer.current);
        }

        // Immediately show level 1 (scene name)
        setDisplayLevel(1);

        // Schedule level 2 (page info) after 200ms
        level2Timer.current = setTimeout(() => {
          setDisplayLevel(2);
        }, 200);

        // Schedule level 3 (controls) after 500ms
        level3Timer.current = setTimeout(() => {
          setDisplayLevel(3);
        }, 500);
      }
      // If already at level 1+, don't touch progression timers (let them complete)

      // Set idle timer to return to level 0 after 3s
      mouseIdleTimer.current = setTimeout(() => {
        setDisplayLevel(0);
      }, 3000);
    };

    const handleMouseDown = () => {
      // Record display level and timestamp before any change
      lastMouseDownLevel.current = {
        level: displayLevelRef.current,
        timestamp: Date.now()
      };

      // Always clear idle timer
      if (mouseIdleTimer.current) {
        clearTimeout(mouseIdleTimer.current);
      }

      // Jump directly to level 3 if at level 0
      if (displayLevelRef.current === 0) {
        // Clear progression timers
        if (level2Timer.current) {
          clearTimeout(level2Timer.current);
        }
        if (level3Timer.current) {
          clearTimeout(level3Timer.current);
        }

        // Jump immediately to level 3 (all controls)
        setDisplayLevel(3);
      }
      // If already at level 1+, don't change level (just reset idle timer)

      // Set idle timer to return to level 0 after 3s
      mouseIdleTimer.current = setTimeout(() => {
        setDisplayLevel(0);
      }, 3000);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mousedown", handleMouseDown);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mousedown", handleMouseDown);
      if (mouseIdleTimer.current) {
        clearTimeout(mouseIdleTimer.current);
      }
      if (level2Timer.current) {
        clearTimeout(level2Timer.current);
      }
      if (level3Timer.current) {
        clearTimeout(level3Timer.current);
      }
    };
  }, []); // Empty dependency array - only run once on mount

  return {
    displayLevel,
  };
}
