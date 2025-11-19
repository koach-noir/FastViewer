interface SceneNavigationProps {
  displayLevel: number;
  onPrevScene: () => void;
  onNextScene: () => void;
}

/**
 * Scene navigation component
 * Provides buttons to navigate between scenes
 */
export function SceneNavigation({ displayLevel, onPrevScene, onNextScene }: SceneNavigationProps) {
  return (
    <>
      <button
        className={`nav-button ui-element ${displayLevel >= 3 ? "visible" : ""}`}
        onClick={onPrevScene}
        style={{ position: "absolute", bottom: "20px", right: "380px" }}
      >
        &lt;&lt; Prev Scene
      </button>
      <button
        className={`nav-button ui-element ${displayLevel >= 3 ? "visible" : ""}`}
        onClick={onNextScene}
        style={{ position: "absolute", bottom: "20px", right: "20px" }}
      >
        Next Scene &gt;&gt;
      </button>
    </>
  );
}
