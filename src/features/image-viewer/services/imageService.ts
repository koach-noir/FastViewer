import { invoke } from "@tauri-apps/api/core";
import { ImageData, SceneInfo } from "../../../types";

/**
 * Service layer for Tauri API calls related to image viewing
 */

export async function loadSceneCollection(path: string): Promise<void> {
  await invoke("load_scene_collection", { path });
}

export async function getSceneInfo(): Promise<SceneInfo> {
  return await invoke<SceneInfo>("get_scene_info");
}

export async function getImage(
  sceneIndex: number | null,
  pageIndex: number
): Promise<ImageData> {
  return await invoke<ImageData>("get_image", { sceneIndex, pageIndex });
}

export async function nextPage(): Promise<ImageData> {
  return await invoke<ImageData>("next_page");
}

export async function prevPage(): Promise<ImageData> {
  return await invoke<ImageData>("prev_page");
}

export async function nextScene(): Promise<SceneInfo> {
  return await invoke<SceneInfo>("next_scene");
}

export async function prevScene(): Promise<SceneInfo> {
  return await invoke<SceneInfo>("prev_scene");
}

export async function getSceneLoopEnabled(): Promise<boolean> {
  return await invoke<boolean>("get_scene_loop_enabled");
}

export async function setSceneLoopEnabled(enabled: boolean): Promise<void> {
  await invoke("set_scene_loop_enabled", { enabled });
}
