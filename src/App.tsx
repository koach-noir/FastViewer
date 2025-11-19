import { useNotification } from "./framework/hooks/useNotification";
import { Notification } from "./framework/components/Notification";
import { useAutoPlay } from "./framework/hooks/useAutoPlay";
import { AutoPlayControls } from "./framework/components/AutoPlayControls";
import { useDisplayLevel } from "./framework/hooks/useDisplayLevel";
import { useKeyboard } from "./framework/hooks/useKeyboard";
import { LoopControl } from "./framework/components/LoopControl";
import { useImageContent } from "./features/image-viewer/hooks/useImageContent";
import { ImageDisplay } from "./features/image-viewer/components/ImageDisplay";
import { ImageInfo } from "./features/image-viewer/components/ImageInfo";
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
  useKeyboard({
    keyMap: {
      "ArrowLeft": () => {
        console.log("Triggering prev page from keyboard");
        autoPlay.pause(1000);
        handlePrevPage();
      },
      "ArrowUp": () => {
        console.log("Triggering prev page from keyboard");
        autoPlay.pause(1000);
        handlePrevPage();
      },
      "ArrowRight": () => {
        console.log("Triggering next page from keyboard");
        autoPlay.pause(1000);
        handleNextPage();
      },
      "ArrowDown": () => {
        console.log("Triggering next page from keyboard");
        autoPlay.pause(1000);
        handleNextPage();
      },
      " ": (e) => {
        e.preventDefault();
        console.log("Toggling autoplay");
        autoPlay.togglePlay();
        showNotification(autoPlay.isPlaying ? "Auto-play OFF" : "Auto-play ON");
      },
      "Escape": () => {
        // Handle fullscreen exit if implemented
      },
    },
  });

  return (
    <div className={`app ${displayLevel === 0 ? "hide-cursor" : ""}`}>
      <div className="image-viewer">
        {loading && <div className="loading">Loading...</div>}

        {error && <div className="error">{error}</div>}

        {imageData && !loading && !error && (
          <>
            <ImageDisplay imageData={imageData} />

            <ImageInfo
              sceneInfo={sceneInfo}
              imageData={imageData}
              displayLevel={displayLevel}
            />

            {/* Level 3: Navigation controls */}
            <div className={`navigation-controls ui-element ${displayLevel >= 3 ? "visible" : ""}`}>
              <button className="nav-button" onClick={handlePrevScene}>
                &lt;&lt; Prev Scene
              </button>
              <button
                className="nav-button"
                onClick={() => {
                  console.log("Prev Page button clicked");
                  autoPlay.pause(1000);
                  handlePrevPage();
                }}
              >
                &lt; Prev
              </button>
              <button
                className="nav-button"
                onClick={() => {
                  console.log("Next Page button clicked");
                  autoPlay.pause(1000);
                  handleNextPage();
                }}
              >
                Next &gt;
              </button>
              <button className="nav-button" onClick={handleNextScene}>
                Next Scene &gt;&gt;
              </button>
            </div>

            <AutoPlayControls
              isPlaying={autoPlay.isPlaying}
              speed={autoPlay.speed}
              reverse={autoPlay.reverse}
              displayLevel={displayLevel}
              onTogglePlay={autoPlay.togglePlay}
              onSetSpeed={autoPlay.setSpeed}
              onToggleReverse={autoPlay.toggleReverse}
            />

            <LoopControl
              displayLevel={displayLevel}
              enabled={sceneLoopEnabled}
              onToggle={handleSceneLoopToggle}
            />

            <Notification notification={notification} />
          </>
        )}
      </div>
    </div>
  );
}

export default App;
