interface NavigationButtonsProps {
  displayLevel: number;
  onPrev: () => void;
  onNext: () => void;
}

/**
 * Generic navigation buttons component
 * Provides prev/next buttons for content navigation
 */
export function NavigationButtons({ displayLevel, onPrev, onNext }: NavigationButtonsProps) {
  return (
    <div className={`navigation-controls ui-element ${displayLevel >= 3 ? "visible" : ""}`}>
      <button className="nav-button" onClick={onPrev}>
        &lt; Prev
      </button>
      <button className="nav-button" onClick={onNext}>
        Next &gt;
      </button>
    </div>
  );
}
