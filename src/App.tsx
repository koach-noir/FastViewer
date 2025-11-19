import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { join, appDataDir } from "@tauri-apps/api/path";
import { SceneInfo, ImageData } from "./types";
import "./App.css";

function App() {
  const [imageData, setImageData] = useState<ImageData | null>(null);
  const [sceneInfo, setSceneInfo] = useState<SceneInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoPlay, setAutoPlay] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0); // 0.5x to 3.0x speed
  const [autoPlayReverse, setAutoPlayReverse] = useState(false); // Auto-play direction toggle
  const [sceneLoopEnabled, setSceneLoopEnabled] = useState(false);
  const isNavigating = useRef(false);
  const autoPlayPausedUntil = useRef<number>(0); // Timestamp until which auto-play is paused

  // Display level state (0: image only, 1: +scene name, 2: +page info, 3: +controls)
  const [displayLevel, setDisplayLevel] = useState(0);
  const displayLevelRef = useRef(0);
  const mouseIdleTimer = useRef<NodeJS.Timeout | null>(null);
  const level2Timer = useRef<NodeJS.Timeout | null>(null);
  const level3Timer = useRef<NodeJS.Timeout | null>(null);
  const previousSceneIndex = useRef<number | null>(null);
  const lastMouseDownLevel = useRef<{level: number, timestamp: number}>({level: 0, timestamp: 0});

  // Keep displayLevelRef in sync with displayLevel state
  useEffect(() => {
    displayLevelRef.current = displayLevel;
  }, [displayLevel]);

  const loadInitialScene = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // パス解決: 開発時と本番時で異なるディレクトリを使用
      let scenePath: string;

      if (import.meta.env.DEV) {
        // 開発時: 環境変数または相対パス
        scenePath = import.meta.env.VITE_SCENE_PATH || "./test-scenes/my-photos";
      } else {
        // 本番時: アプリデータディレクトリ配下
        const appData = await appDataDir();
        const sceneName = import.meta.env.VITE_SCENE_NAME || "my-photos";
        scenePath = await join(appData, "scenes", sceneName);
      }

      await invoke("load_scene_collection", { path: scenePath });

      const info = await invoke<SceneInfo>("get_scene_info");
      setSceneInfo(info);

      const data = await invoke<ImageData>("get_image", {
        sceneIndex: null,
        pageIndex: 0,
      });
      setImageData(data);
    } catch (err) {
      setError(`Failed to load scene: ${err}`);
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Pause auto-play for 1 second when user manually navigates
  const pauseAutoPlay = useCallback(() => {
    autoPlayPausedUntil.current = Date.now() + 1000; // Pause for 1 second
  }, []);

  const handleNextPage = useCallback(async () => {
    console.log("=== handleNextPage called ===");
    if (isNavigating.current) {
      console.log("Navigation already in progress, ignoring");
      return;
    }

    isNavigating.current = true;
    try {
      console.log("Invoking next_page command...");
      const data = await invoke<ImageData>("next_page");
      console.log("next_page response:", data);
      setImageData(data);

      console.log("Getting scene info...");
      const info = await invoke<SceneInfo>("get_scene_info");
      console.log("Scene info:", info);
      setSceneInfo(info);
      console.log("=== handleNextPage completed ===");
    } catch (err) {
      console.error("Failed to navigate to next page:", err);
    } finally {
      isNavigating.current = false;
    }
  }, []);

  const handlePrevPage = useCallback(async () => {
    console.log("=== handlePrevPage called ===");
    if (isNavigating.current) {
      console.log("Navigation already in progress, ignoring");
      return;
    }

    isNavigating.current = true;
    try {
      console.log("Invoking prev_page command...");
      const data = await invoke<ImageData>("prev_page");
      console.log("prev_page response:", data);
      setImageData(data);

      console.log("Getting scene info...");
      const info = await invoke<SceneInfo>("get_scene_info");
      console.log("Scene info:", info);
      setSceneInfo(info);
      console.log("=== handlePrevPage completed ===");
    } catch (err) {
      console.error("Failed to navigate to previous page:", err);
    } finally {
      isNavigating.current = false;
    }
  }, []);

  // Load initial scene
  useEffect(() => {
    loadInitialScene();
  }, [loadInitialScene]);

  // Load scene loop enabled state
  useEffect(() => {
    const loadSceneLoopState = async () => {
      try {
        const enabled = await invoke<boolean>("get_scene_loop_enabled");
        setSceneLoopEnabled(enabled);
      } catch (err) {
        console.error("Failed to load scene loop state:", err);
      }
    };
    loadSceneLoopState();
  }, []);

  // Handle scene loop toggle
  const handleSceneLoopToggle = async () => {
    const newState = !sceneLoopEnabled;
    setSceneLoopEnabled(newState);
    try {
      await invoke("set_scene_loop_enabled", { enabled: newState });
    } catch (err) {
      console.error("Failed to set scene loop state:", err);
      // Revert on error
      setSceneLoopEnabled(!newState);
    }
  };

  // Auto play functionality with idling and reverse support
  useEffect(() => {
    if (!autoPlay) return;

    const baseInterval = 2400; // 2.4 seconds base interval
    const interval = setInterval(() => {
      // Check if auto-play is currently paused
      if (Date.now() < autoPlayPausedUntil.current) {
        console.log("Auto-play paused, skipping navigation");
        return;
      }

      // Navigate in the appropriate direction
      if (autoPlayReverse) {
        handlePrevPage();
      } else {
        handleNextPage();
      }
    }, baseInterval / playbackSpeed);

    return () => clearInterval(interval);
  }, [autoPlay, playbackSpeed, autoPlayReverse, handleNextPage, handlePrevPage]);

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
          : displayLevel;

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
  }, [sceneInfo, displayLevel]);

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
          pauseAutoPlay(); // Pause auto-play when user navigates manually
          handlePrevPage();
          break;
        case "ArrowRight":
        case "ArrowDown":
          console.log("Triggering next page from keyboard");
          pauseAutoPlay(); // Pause auto-play when user navigates manually
          handleNextPage();
          break;
        case " ":
          e.preventDefault();
          console.log("Toggling autoplay");
          setAutoPlay((prev) => !prev);
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
  }, [handleNextPage, handlePrevPage, pauseAutoPlay]);

  const handleNextScene = async () => {
    try {
      const info = await invoke<SceneInfo>("next_scene");
      setSceneInfo(info);

      const data = await invoke<ImageData>("get_image", {
        sceneIndex: null,
        pageIndex: 0,
      });
      setImageData(data);
    } catch (err) {
      console.error("Failed to navigate to next scene:", err);
    }
  };

  const handlePrevScene = async () => {
    try {
      const info = await invoke<SceneInfo>("prev_scene");
      setSceneInfo(info);

      const data = await invoke<ImageData>("get_image", {
        sceneIndex: null,
        pageIndex: 0,
      });
      setImageData(data);
    } catch (err) {
      console.error("Failed to navigate to previous scene:", err);
    }
  };

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
                {/* Level 1+: Scene name */}
                {displayLevel >= 1 && (
                  <div className="scene-info fade-in">
                    <div>{sceneInfo.scene_name}</div>
                  </div>
                )}

                {/* Level 2+: Page number */}
                {displayLevel >= 2 && (
                  <div className="info-overlay fade-in">
                    Page {sceneInfo.current_page + 1}
                  </div>
                )}

                {/* Level 2+: Total pages */}
                {displayLevel >= 2 && (
                  <div className="scene-info fade-in">
                    <div>Total Pages: {sceneInfo.total_pages}</div>
                  </div>
                )}

                {/* Level 2+: Image filename */}
                {displayLevel >= 2 && (
                  <div className="page-info fade-in">
                    {imageData.image_path.split(/[/\\]/).pop()}
                  </div>
                )}
              </>
            )}

            {/* Level 3: Navigation controls */}
            {displayLevel >= 3 && (
              <div className="navigation-controls fade-in">
                <button className="nav-button" onClick={handlePrevScene}>
                  &lt;&lt; Prev Scene
                </button>
                <button
                  className="nav-button"
                  onClick={() => {
                    console.log("Prev Page button clicked");
                    pauseAutoPlay(); // Pause auto-play when user navigates manually
                    handlePrevPage();
                  }}
                >
                  &lt; Prev
                </button>
                <button
                  className="nav-button"
                  onClick={() => {
                    console.log("Next Page button clicked");
                    pauseAutoPlay(); // Pause auto-play when user navigates manually
                    handleNextPage();
                  }}
                >
                  Next &gt;
                </button>
                <button className="nav-button" onClick={handleNextScene}>
                  Next Scene &gt;&gt;
                </button>
              </div>
            )}

            {/* Level 3: Autoplay control */}
            {displayLevel >= 3 && (
              <div className="autoplay-control fade-in">
                <button
                  className={`autoplay-button ${autoPlay ? "active" : ""}`}
                  onClick={() => setAutoPlay((prev) => !prev)}
                >
                  {autoPlay ? "⏸ Pause" : "▶ Play"}
                </button>
                <div className="speed-control">
                  <label htmlFor="speed-slider">
                    Speed: {playbackSpeed.toFixed(1)}x
                  </label>
                  <input
                    id="speed-slider"
                    type="range"
                    min="0.5"
                    max="3.0"
                    step="0.1"
                    value={playbackSpeed}
                    onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
                    className="speed-slider"
                  />
                </div>
                <div className="direction-control">
                  <button
                    className={`direction-button ${autoPlayReverse ? "active" : ""}`}
                    onClick={() => setAutoPlayReverse((prev) => !prev)}
                    title={autoPlayReverse ? "Direction: Backward (◀)" : "Direction: Forward (▶)"}
                  >
                    {autoPlayReverse ? "◀ Backward" : "▶ Forward"}
                  </button>
                </div>
              </div>
            )}

            {/* Level 3: Scene loop toggle */}
            {displayLevel >= 3 && (
              <div className="scene-loop-control fade-in">
                <button
                  className={`scene-loop-button ${sceneLoopEnabled ? "active" : ""}`}
                  onClick={handleSceneLoopToggle}
                  title={sceneLoopEnabled ? "Scene Loop: ON (stays within scene)" : "Scene Loop: OFF (transitions between scenes)"}
                >
                  {sceneLoopEnabled ? "🔁 Loop: ON" : "➡️ Loop: OFF"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default App;
