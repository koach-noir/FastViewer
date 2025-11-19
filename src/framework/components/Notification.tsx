import "./Notification.css";

interface NotificationProps {
  notification: string | null;
}

/**
 * Generic notification component
 * Displays status messages with fade-in animation
 */
export function Notification({ notification }: NotificationProps) {
  if (!notification) return null;

  return (
    <div className="notification">
      {notification}
    </div>
  );
}
