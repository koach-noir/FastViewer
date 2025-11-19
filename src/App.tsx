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
    <div className="app">
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
                <div className="info-overlay">
                  Page {sceneInfo.current_page + 1}
                </div>

                <div className="page-info">
                  {imageData.image_path.split(/[/\\]/).pop()}
                </div>

                <div className="scene-info">
                  <div>{sceneInfo.scene_name}</div>
                  <div>Total Pages: {sceneInfo.total_pages}</div>
                </div>
              </>
            )}

            <div className="navigation-controls">
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

            <div className="autoplay-control">
              <button
                className={`autoplay-button ${autoPlay ? "active" : ""}`}
                onClick={() => setAutoPlay((prev) => !prev)}
              >
                {autoPlay ? "⏸ Pause" : "▶ Play"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default App;
