import { useEffect } from "react";
import { useNotification } from "./framework/hooks/useNotification";
import { Notification } from "./framework/components/Notification";
import { useAutoPlay } from "./framework/hooks/useAutoPlay";
import { AutoPlayControls } from "./framework/components/AutoPlayControls";
import { useDisplayLevel } from "./framework/hooks/useDisplayLevel";
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

  // Display level system
  const { displayLevel } = useDisplayLevel({
    sceneIndex: sceneInfo?.scene_index,
  });

  // Notification system
  const { notification, showNotification } = useNotification();

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
