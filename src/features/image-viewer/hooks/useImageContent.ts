import { useState, useEffect, useCallback, useRef } from "react";
import { join, appDataDir } from "@tauri-apps/api/path";
import { listen } from "@tauri-apps/api/event";
import { ImageData, SceneInfo } from "../types";
import * as imageService from "../services/imageService";

interface ImageUpgradePayload {
  main_image: string;
  page_index: number;
  scene_index: number;
  image_path: string;
}

export interface UseImageContentReturn {
  imageData: ImageData | null;
  sceneInfo: SceneInfo | null;
  loading: boolean;
  error: string | null;
  sceneLoopEnabled: boolean;
  handleNextPage: () => Promise<void>;
  handlePrevPage: () => Promise<void>;
  handleNextScene: () => Promise<void>;
  handlePrevScene: () => Promise<void>;
  handleSceneLoopToggle: () => Promise<void>;
}

/**
 * Custom hook for managing image content state and navigation
 * Handles image loading, page/scene navigation, and scene loop settings
 */
export function useImageContent(): UseImageContentReturn {
  const [imageData, setImageData] = useState<ImageData | null>(null);
  const [sceneInfo, setSceneInfo] = useState<SceneInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sceneLoopEnabled, setSceneLoopEnabled] = useState(false);
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

      await imageService.loadSceneCollection(scenePath);

      const info = await imageService.getSceneInfo();
      setSceneInfo(info);

      const data = await imageService.getImage(null, 0);
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
      const data = await imageService.nextPage();
      console.log("next_page response:", data);
      setImageData(data);

      console.log("Getting scene info...");
      const info = await imageService.getSceneInfo();
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
      const data = await imageService.prevPage();
      console.log("prev_page response:", data);
      setImageData(data);

      console.log("Getting scene info...");
      const info = await imageService.getSceneInfo();
      console.log("Scene info:", info);
      setSceneInfo(info);
      console.log("=== handlePrevPage completed ===");
    } catch (err) {
      console.error("Failed to navigate to previous page:", err);
    } finally {
      isNavigating.current = false;
    }
  }, []);

  const handleNextScene = useCallback(async () => {
    try {
      const info = await imageService.nextScene();
      setSceneInfo(info);

      const data = await imageService.getImage(null, 0);
      setImageData(data);
    } catch (err) {
      console.error("Failed to navigate to next scene:", err);
    }
  }, []);

  const handlePrevScene = useCallback(async () => {
    try {
      const info = await imageService.prevScene();
      setSceneInfo(info);

      const data = await imageService.getImage(null, 0);
      setImageData(data);
    } catch (err) {
      console.error("Failed to navigate to previous scene:", err);
    }
  }, []);

  const handleSceneLoopToggle = useCallback(async () => {
    const newState = !sceneLoopEnabled;
    setSceneLoopEnabled(newState);
    try {
      await imageService.setSceneLoopEnabled(newState);
    } catch (err) {
      console.error("Failed to set scene loop state:", err);
      // Revert on error
      setSceneLoopEnabled(!newState);
    }
  }, [sceneLoopEnabled]);

  // Load initial scene on mount
  useEffect(() => {
    loadInitialScene();
  }, [loadInitialScene]);

  // Load scene loop enabled state on mount
  useEffect(() => {
    const loadSceneLoopState = async () => {
      try {
        const enabled = await imageService.getSceneLoopEnabled();
        setSceneLoopEnabled(enabled);
      } catch (err) {
        console.error("Failed to load scene loop state:", err);
      }
    };
    loadSceneLoopState();
  }, []);

  // Listen for high-resolution image upgrades
  useEffect(() => {
    let unlisten: (() => void) | null = null;

    const setupListener = async () => {
      unlisten = await listen<ImageUpgradePayload>("image-upgraded", (event) => {
        const payload = event.payload;
        console.log("🎉 High-res image upgrade received:", {
          page: payload.page_index,
          scene: payload.scene_index,
          path: payload.image_path,
        });

        // Only upgrade if it matches the current page
        if (
          imageData &&
          imageData.page_index === payload.page_index &&
          imageData.scene_index === payload.scene_index
        ) {
          console.log("✅ Upgrading current page to high-res");
          setImageData({
            ...imageData,
            main_image: payload.main_image,
            is_preview: false, // Mark as full resolution
          });
        } else {
          console.log("ℹ️ Image upgrade is for a different page, cached for future use");
        }
      });
    };

    setupListener();

    return () => {
      if (unlisten) unlisten();
    };
  }, [imageData]);

  return {
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
  };
}
