import "./LoopControl.css";

interface LoopControlProps {
  displayLevel: number;
  enabled: boolean;
  onToggle: () => void;
}

/**
 * Generic loop control component
 * Provides a toggle button for loop functionality
 */
export function LoopControl({ displayLevel, enabled, onToggle }: LoopControlProps) {
  return (
    <div className={`scene-loop-control ui-element ${displayLevel >= 3 ? "visible" : ""}`}>
      <button
        className={`scene-loop-button ${enabled ? "active" : ""}`}
        onClick={onToggle}
        title={enabled ? "Loop: ON" : "Loop: OFF"}
      >
        {enabled ? "🔁 Loop: ON" : "➡️ Loop: OFF"}
      </button>
    </div>
  );
}
