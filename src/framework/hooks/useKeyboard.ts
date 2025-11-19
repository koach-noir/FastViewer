import { useEffect } from "react";

export interface KeyMapping {
  [key: string]: (e: KeyboardEvent) => void;
}

export interface UseKeyboardOptions {
  keyMap: KeyMapping;
}

/**
 * Generic keyboard event handling hook
 * Registers keyboard event listeners with configurable key mappings
 */
export function useKeyboard({ keyMap }: UseKeyboardOptions): void {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      console.log("Key pressed:", e.key);

      const handler = keyMap[e.key];
      if (handler) {
        handler(e);
      }
    };

    console.log("Setting up keyboard event listener");
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      console.log("Removing keyboard event listener");
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [keyMap]);
}
