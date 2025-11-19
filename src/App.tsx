import { useState, useEffect, useRef } from "react";
import { useNotification } from "./framework/hooks/useNotification";
import { Notification } from "./framework/components/Notification";
import { useAutoPlay } from "./framework/hooks/useAutoPlay";
import { AutoPlayControls } from "./framework/components/AutoPlayControls";
import { useImageContent } from "./features/image-viewer/hooks/useImageContent";
import "./App.css";

function App() {
  // Image content management
  const {
    imageData,
    sceneInfo,
    loading,
    error,
    sceneLoopEnabled,
    handleNextPage,
    handlePrevPage,
    handleNextScene,
    handlePrevScene,
    handleSceneLoopToggle,
  } = useImageContent();

  // Auto-play system
  const autoPlay = useAutoPlay({
    onNext: handleNextPage,
    onPrev: handlePrevPage,
  });

  // Display level state (0: image only, 1: +scene name, 2: +page info, 3: +controls)
  const [displayLevel, setDisplayLevel] = useState(0);
  const displayLevelRef = useRef(0);
  const mouseIdleTimer = useRef<NodeJS.Timeout | null>(null);
  const level2Timer = useRef<NodeJS.Timeout | null>(null);
  const level3Timer = useRef<NodeJS.Timeout | null>(null);
  const previousSceneIndex = useRef<number | null>(null);
  const lastMouseDownLevel = useRef<{level: number, timestamp: number}>({level: 0, timestamp: 0});

  // Notification system
  const { notification, showNotification } = useNotification();

  // Keep displayLevelRef in sync with displayLevel state
  useEffect(() => {
    displayLevelRef.current = displayLevel;
  }, [displayLevel]);

  // Scene change detection: transition from level 0 to level 1
  useEffect(() => {
    if (sceneInfo) {
      // Check if scene has changed
      if (previousSceneIndex.current !== null &&
          previousSceneIndex.current !== sceneInfo.scene_index) {
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
      previousSceneIndex.current = sceneInfo.scene_index;
    }
  }, [sceneInfo]);

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

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      console.log("Key pressed:", e.key);
      switch (e.key) {
        case "ArrowLeft":
        case "ArrowUp":
          console.log("Triggering prev page from keyboard");
          autoPlay.pause(1000); // Pause auto-play when user navigates manually
          handlePrevPage();
          break;
        case "ArrowRight":
        case "ArrowDown":
          console.log("Triggering next page from keyboard");
          autoPlay.pause(1000); // Pause auto-play when user navigates manually
          handleNextPage();
          break;
        case " ":
          e.preventDefault();
          console.log("Toggling autoplay");
          autoPlay.togglePlay();
          showNotification(autoPlay.isPlaying ? "Auto-play OFF" : "Auto-play ON");
          break;
        case "Escape":
          // Handle fullscreen exit if implemented
          break;
      }
    };

    console.log("Setting up keyboard event listener");
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      console.log("Removing keyboard event listener");
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleNextPage, handlePrevPage, autoPlay, showNotification]);

  return (
    <div className={`app ${displayLevel === 0 ? "hide-cursor" : ""}`}>
      <div className="image-viewer">
        {loading && <div className="loading">Loading...</div>}

        {error && <div className="error">{error}</div>}

        {imageData && !loading && !error && (
          <>
            <div className="image-container">
              <img
                src={
                  imageData.main_image ||
                  imageData.thumbnail_image ||
                  ""
                }
                alt="Slide"
                className="main-image"
              />
            </div>

            {sceneInfo && (
              <>
                {/* Level 1+: Scene info (name + total pages at level 2+) */}
                <div className={`scene-info ui-element ${displayLevel >= 1 ? "visible" : ""}`}>
                  <div>{sceneInfo.scene_name}</div>
                  <div className={`scene-total-pages ui-element ${displayLevel >= 2 ? "visible" : ""}`}>
                    Total Pages: {sceneInfo.total_pages}
                  </div>
                </div>

                {/* Level 2+: Page number */}
                <div className={`info-overlay ui-element ${displayLevel >= 2 ? "visible" : ""}`}>
                  Page {sceneInfo.current_page + 1}
                </div>

                {/* Level 2+: Image filename */}
                <div className={`page-info ui-element ${displayLevel >= 2 ? "visible" : ""}`}>
                  {imageData.image_path.split(/[/\\]/).pop()}
                </div>
              </>
            )}

            {/* Level 3: Navigation controls */}
            <div className={`navigation-controls ui-element ${displayLevel >= 3 ? "visible" : ""}`}>
              <button className="nav-button" onClick={handlePrevScene}>
                &lt;&lt; Prev Scene
              </button>
              <button
                className="nav-button"
                onClick={() => {
                  console.log("Prev Page button clicked");
                  autoPlay.pause(1000); // Pause auto-play when user navigates manually
                  handlePrevPage();
                }}
              >
                &lt; Prev
              </button>
              <button
                className="nav-button"
                onClick={() => {
                  console.log("Next Page button clicked");
                  autoPlay.pause(1000); // Pause auto-play when user navigates manually
                  handleNextPage();
                }}
              >
                Next &gt;
              </button>
              <button className="nav-button" onClick={handleNextScene}>
                Next Scene &gt;&gt;
              </button>
            </div>

            {/* Level 3: Autoplay control */}
            <AutoPlayControls
              isPlaying={autoPlay.isPlaying}
              speed={autoPlay.speed}
              reverse={autoPlay.reverse}
              displayLevel={displayLevel}
              onTogglePlay={autoPlay.togglePlay}
              onSetSpeed={autoPlay.setSpeed}
              onToggleReverse={autoPlay.toggleReverse}
            />

            {/* Level 3: Scene loop toggle */}
            <div className={`scene-loop-control ui-element ${displayLevel >= 3 ? "visible" : ""}`}>
              <button
                className={`scene-loop-button ${sceneLoopEnabled ? "active" : ""}`}
                onClick={handleSceneLoopToggle}
                title={sceneLoopEnabled ? "Scene Loop: ON (stays within scene)" : "Scene Loop: OFF (transitions between scenes)"}
              >
                {sceneLoopEnabled ? "🔁 Loop: ON" : "➡️ Loop: OFF"}
              </button>
            </div>

            {/* Notification system - shows status messages */}
            <Notification notification={notification} />
          </>
        )}
      </div>
    </div>
  );
}

export default App;
