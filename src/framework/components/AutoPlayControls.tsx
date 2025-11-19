import "./AutoPlayControls.css";

interface AutoPlayControlsProps {
  isPlaying: boolean;
  speed: number;
  reverse: boolean;
  displayLevel: number;
  onTogglePlay: () => void;
  onSetSpeed: (speed: number) => void;
  onToggleReverse: () => void;
}

/**
 * Auto-play control component
 * Provides play/pause button, speed slider, and direction toggle
 */
export function AutoPlayControls({
  isPlaying,
  speed,
  reverse,
  displayLevel,
  onTogglePlay,
  onSetSpeed,
  onToggleReverse,
}: AutoPlayControlsProps) {
  return (
    <div className={`autoplay-control ui-element ${displayLevel >= 3 ? "visible" : ""}`}>
      <button
        className={`autoplay-button ${isPlaying ? "active" : ""}`}
        onClick={onTogglePlay}
      >
        {isPlaying ? "⏸ Pause" : "▶ Play"}
      </button>
      <div className="speed-control">
        <label htmlFor="speed-slider">
          Speed: {speed.toFixed(1)}x
        </label>
        <input
          id="speed-slider"
          type="range"
          min="0.5"
          max="3.0"
          step="0.1"
          value={speed}
          onChange={(e) => onSetSpeed(parseFloat(e.target.value))}
          className="speed-slider"
        />
      </div>
      <div className="direction-control">
        <button
          className={`direction-button ${reverse ? "active" : ""}`}
          onClick={onToggleReverse}
          title={reverse ? "Direction: Backward (◀)" : "Direction: Forward (▶)"}
        >
          {reverse ? "◀ Backward" : "▶ Forward"}
        </button>
      </div>
    </div>
  );
}
