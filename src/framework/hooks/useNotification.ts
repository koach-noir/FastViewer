import { useState, useCallback, useRef } from "react";

export interface UseNotificationReturn {
  notification: string | null;
  showNotification: (message: string, duration?: number) => void;
}

/**
 * Generic notification system hook
 * Shows a message for a specified duration
 */
export function useNotification(): UseNotificationReturn {
  const [notification, setNotification] = useState<string | null>(null);
  const notificationTimer = useRef<NodeJS.Timeout | null>(null);

  const showNotification = useCallback((message: string, duration: number = 2000) => {
    // Clear any existing notification timer
    if (notificationTimer.current) {
      clearTimeout(notificationTimer.current);
    }

    // Show the notification
    setNotification(message);

    // Auto-dismiss after duration
    notificationTimer.current = setTimeout(() => {
      setNotification(null);
    }, duration);
  }, []);

  return {
    notification,
    showNotification,
  };
}
