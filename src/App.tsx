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
  const isNavigating = useRef(false);

  // Display level state (0: image only, 1: +scene name, 2: +page info, 3: +all controls)
  const [displayLevel, setDisplayLevel] = useState(0);
  const mouseHoverTimer = useRef<NodeJS.Timeout | null>(null);
  const mouseIdleTimer = useRef<NodeJS.Timeout | null>(null);
  const lastMouseMoveTime = useRef<number>(Date.now());

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

  // Auto play functionality
  useEffect(() => {
    if (!autoPlay) return;

    const interval = setInterval(() => {
      handleNextPage();
    }, 2400); // 2.4 seconds like the original

    return () => clearInterval(interval);
  }, [autoPlay, handleNextPage]);

  // Mouse hover and idle detection for display level control
  useEffect(() => {
    const clearTimers = () => {
      if (mouseHoverTimer.current) {
        clearTimeout(mouseHoverTimer.current);
        mouseHoverTimer.current = null;
      }
      if (mouseIdleTimer.current) {
        clearTimeout(mouseIdleTimer.current);
        mouseIdleTimer.current = null;
      }
    };

    const setIdleTimer = () => {
      // Clear existing idle timer
      if (mouseIdleTimer.current) {
        clearTimeout(mouseIdleTimer.current);
      }
      // Set idle timer to return to level 0 after 4s
      mouseIdleTimer.current = setTimeout(() => {
        setDisplayLevel(0);
      }, 4000);
    };

    const handleMouseMove = () => {
      lastMouseMoveTime.current = Date.now();

      // Clear existing timers
      clearTimers();

      // Start progressive display level increase
      // Level 0 -> 1: 0.5s
      mouseHoverTimer.current = setTimeout(() => {
        setDisplayLevel(1);
        setIdleTimer(); // Reset idle timer when reaching level 1

        // Level 1 -> 2: 1s after reaching level 1
        mouseHoverTimer.current = setTimeout(() => {
          setDisplayLevel(2);
          setIdleTimer(); // Reset idle timer when reaching level 2

          // Level 2 -> 3: 2s after reaching level 2
          mouseHoverTimer.current = setTimeout(() => {
            setDisplayLevel(3);
            setIdleTimer(); // Reset idle timer when reaching level 3
          }, 2000);
        }, 1000);
      }, 500);

      // Set initial idle timer
      setIdleTimer();
    };

    window.addEventListener("mousemove", handleMouseMove);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      clearTimers();
    };
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      console.log("Key pressed:", e.key);
      switch (e.key) {
        case "ArrowLeft":
        case "ArrowUp":
          console.log("Triggering prev page from keyboard");
          handlePrevPage();
          break;
        case "ArrowRight":
        case "ArrowDown":
          console.log("Triggering next page from keyboard");
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
  }, [handleNextPage, handlePrevPage]);

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
                {/* Level 2+: Page number */}
                {displayLevel >= 2 && (
                  <div className="info-overlay fade-in">
                    Page {sceneInfo.current_page + 1}
                  </div>
                )}

                {/* Level 2+: Image filename */}
                {displayLevel >= 2 && (
                  <div className="page-info fade-in">
                    {imageData.image_path.split(/[/\\]/).pop()}
                  </div>
                )}

                {/* Level 1+: Scene name */}
                {displayLevel >= 1 && (
                  <div className="scene-info fade-in">
                    <div>{sceneInfo.scene_name}</div>
                    {/* Level 2+: Total pages */}
                    {displayLevel >= 2 && (
                      <div>Total Pages: {sceneInfo.total_pages}</div>
                    )}
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
                    handlePrevPage();
                  }}
                >
                  &lt; Prev
                </button>
                <button
                  className="nav-button"
                  onClick={() => {
                    console.log("Next Page button clicked");
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
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default App;
