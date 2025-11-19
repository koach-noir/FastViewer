use crate::image_loader::{load_image_cached, image_to_base64_jpeg, ImageCache, EncodedImageCache};
use crate::scene::{Scene, SceneCollection};
use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};  // PathBufを削除
use tauri::State;

/// Application state shared across commands
pub struct AppState {
    pub cache: Arc<ImageCache>,
    pub encoded_cache: Arc<EncodedImageCache>,
    pub current_scene: Arc<Mutex<Option<Scene>>>,
    pub current_collection: Arc<Mutex<Option<SceneCollection>>>,
    pub current_scene_index: Arc<Mutex<usize>>,
    pub current_page_index: Arc<Mutex<usize>>,
    pub scene_loop_enabled: Arc<Mutex<bool>>,
}

impl AppState {
    pub fn new() -> Self {
        AppState {
            cache: Arc::new(ImageCache::new(8)), // Cache up to 8 images
            encoded_cache: Arc::new(EncodedImageCache::new(16)), // Cache up to 16 encoded images
            current_scene: Arc::new(Mutex::new(None)),
            current_collection: Arc::new(Mutex::new(None)),
            current_scene_index: Arc::new(Mutex::new(0)),
            current_page_index: Arc::new(Mutex::new(0)),
            scene_loop_enabled: Arc::new(Mutex::new(false)), // Default OFF
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SceneInfo {
    pub scene_name: String,
    pub scene_index: usize,
    pub total_pages: usize,
    pub current_page: usize,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ImageData {
    pub main_image: Option<String>,
    pub thumbnail_image: Option<String>,
    pub page_index: usize,
    pub scene_index: usize,
    pub image_path: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SceneListItem {
    pub name: String,
    pub path: String,
}

/// Load a scene collection from a directory
#[tauri::command]
pub async fn load_scene_collection(
    path: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let collection = SceneCollection::new(&path)
        .map_err(|e| format!("Failed to load scene collection: {}", e))?;

    let scene_count = collection.scene_count();

    // Load the first scene
    if scene_count > 0 {
        let scene = collection.load_scene(0)
            .map_err(|e| format!("Failed to load first scene: {}", e))?;

        *state.current_scene.lock().unwrap() = Some(scene);
        *state.current_collection.lock().unwrap() = Some(collection);
        *state.current_scene_index.lock().unwrap() = 0;
        *state.current_page_index.lock().unwrap() = 0;

        // Preload initial images in background
        let cache = state.cache.clone();
        let encoded_cache = state.encoded_cache.clone();
        let current_scene = state.current_scene.clone();
        let current_page_index = state.current_page_index.clone();

        tokio::spawn(async move {
            let _ = preload_next_images_task(cache, encoded_cache, current_scene, current_page_index, 3).await;
        });
    }

    Ok(format!("Loaded {} scenes", scene_count))
}

/// Get the current scene information
#[tauri::command]
pub async fn get_scene_info(state: State<'_, AppState>) -> Result<SceneInfo, String> {
    let scene = state.current_scene.lock().unwrap();
    let scene_index = *state.current_scene_index.lock().unwrap();
    let page_index = *state.current_page_index.lock().unwrap();

    if let Some(scene) = scene.as_ref() {
        Ok(SceneInfo {
            scene_name: scene.metadata.scene_name.clone(),
            scene_index,
            total_pages: scene.page_count(),
            current_page: page_index,
        })
    } else {
        Err("No scene loaded".to_string())
    }
}

/// Get an image at a specific page
#[tauri::command]
pub async fn get_image(
    scene_index: Option<usize>,
    page_index: usize,
    state: State<'_, AppState>,
) -> Result<ImageData, String> {
    println!("get_image called: scene_index={:?}, page_index={}", scene_index, page_index);
    let mut current_scene_idx = state.current_scene_index.lock().unwrap();
    let collection = state.current_collection.lock().unwrap();

    // Load different scene if requested
    if let Some(new_scene_idx) = scene_index {
        if new_scene_idx != *current_scene_idx {
            if let Some(coll) = collection.as_ref() {
                let scene = coll.load_scene(new_scene_idx)
                    .map_err(|e| format!("Failed to load scene {}: {}", new_scene_idx, e))?;

                *state.current_scene.lock().unwrap() = Some(scene);
                *current_scene_idx = new_scene_idx;
            }
        }
    }

    drop(current_scene_idx); // Release lock
    drop(collection); // Release lock

    let scene = state.current_scene.lock().unwrap();
    let scene_idx = *state.current_scene_index.lock().unwrap();

    if let Some(scene) = scene.as_ref() {
        if page_index >= scene.page_count() {
            return Err(format!(
                "Page index {} out of bounds (total: {})",
                page_index,
                scene.page_count()
            ));
        }

        let main_path = scene.get_page_image(page_index)
            .ok_or("Failed to get page image")?;

        let thumbnail_path = scene.get_thumbnail_path(main_path);

        // Load main image - check encoded cache first
        let main_image = if let Some(cached) = state.encoded_cache.get(main_path) {
            Some(cached)
        } else {
            match load_image_cached(main_path, &state.cache) {
                Ok(img) => match image_to_base64_jpeg(&img, 85) {
                    Ok(base64) => {
                        // Store in encoded cache for future use
                        state.encoded_cache.insert(main_path.to_string(), base64.clone());
                        Some(base64)
                    }
                    Err(e) => {
                        eprintln!("Failed to encode main image: {}", e);
                        None
                    }
                },
                Err(e) => {
                    eprintln!("Failed to load main image: {}", e);
                    None
                }
            }
        };

        // Load thumbnail if it exists - check encoded cache first
        let thumbnail_image = if thumbnail_path.exists() {
            let thumb_path_str = thumbnail_path.to_str().unwrap();
            if let Some(cached) = state.encoded_cache.get(thumb_path_str) {
                Some(cached)
            } else {
                match load_image_cached(thumb_path_str, &state.cache) {
                    Ok(img) => match image_to_base64_jpeg(&img, 75) {
                        Ok(base64) => {
                            // Store in encoded cache for future use
                            state.encoded_cache.insert(thumb_path_str.to_string(), base64.clone());
                            Some(base64)
                        }
                        Err(e) => {
                            eprintln!("Failed to encode thumbnail: {}", e);
                            None
                        }
                    },
                    Err(e) => {
                        eprintln!("Failed to load thumbnail: {}", e);
                        None
                    }
                }
            }
        } else {
            None
        };

        // Update current page index
        *state.current_page_index.lock().unwrap() = page_index;
        println!("Updated current_page_index to: {}", page_index);

        let result = ImageData {
            main_image,
            thumbnail_image,
            page_index,
            scene_index: scene_idx,
            image_path: main_path.to_string(),
        };
        println!("Returning ImageData: page_index={}, scene_index={}, path={}", result.page_index, result.scene_index, result.image_path);
        Ok(result)
    } else {
        println!("ERROR: No scene loaded in get_image");
        Err("No scene loaded".to_string())
    }
}

/// Navigate to the next page
#[tauri::command]
pub async fn next_page(state: State<'_, AppState>) -> Result<ImageData, String> {
    println!("=== next_page command called ===");
    let scene_loop_enabled = *state.scene_loop_enabled.lock().unwrap();

    let (mut scene_index, new_page, scene_changed) = {
        let scene = state.current_scene.lock().unwrap();
        let page_index = state.current_page_index.lock().unwrap();
        let scene_index = *state.current_scene_index.lock().unwrap();

        if let Some(scene) = scene.as_ref() {
            let current_page = *page_index;
            let total_pages = scene.page_count();

            if scene_loop_enabled {
                // Existing behavior: loop within scene
                let new_page = (current_page + 1) % total_pages;
                println!("Loop enabled - Current page: {}, Total pages: {}, New page: {}", current_page, total_pages, new_page);
                (scene_index, new_page, false)
            } else {
                // New behavior: transition to next scene at boundary
                if current_page + 1 >= total_pages {
                    // At last page, move to next scene
                    println!("At last page, moving to next scene");
                    (scene_index, 0, true)
                } else {
                    let new_page = current_page + 1;
                    println!("Normal navigation - Current page: {}, Total pages: {}, New page: {}", current_page, total_pages, new_page);
                    (scene_index, new_page, false)
                }
            }
        } else {
            println!("ERROR: No scene loaded");
            return Err("No scene loaded".to_string());
        }
    };

    // Handle scene transition if needed
    if scene_changed {
        let collection = state.current_collection.lock().unwrap();
        let mut scene_idx = state.current_scene_index.lock().unwrap();

        if let Some(coll) = collection.as_ref() {
            let new_scene_idx = (scene_index + 1) % coll.scene_count();
            let scene = coll.load_scene(new_scene_idx)
                .map_err(|e| format!("Failed to load next scene: {}", e))?;

            *state.current_scene.lock().unwrap() = Some(scene);
            *scene_idx = new_scene_idx;
            scene_index = new_scene_idx;
            println!("Loaded next scene: {}", new_scene_idx);
        } else {
            return Err("No collection loaded".to_string());
        }
    }

    println!("Calling get_image with scene_index: {}, page: {}", scene_index, new_page);
    let result = get_image(Some(scene_index), new_page, state.clone()).await;

    // Preload next images in background (don't wait for completion)
    if result.is_ok() {
        // Clone the Arcs needed for background task
        let cache = state.cache.clone();
        let encoded_cache = state.encoded_cache.clone();
        let current_scene = state.current_scene.clone();
        let current_page_index = state.current_page_index.clone();

        tokio::spawn(async move {
            let _ = preload_next_images_task(cache, encoded_cache, current_scene, current_page_index, 3).await;
        });
    }

    println!("=== next_page command completed ===");
    result
}

/// Navigate to the previous page
#[tauri::command]
pub async fn prev_page(state: State<'_, AppState>) -> Result<ImageData, String> {
    println!("=== prev_page command called ===");
    let scene_loop_enabled = *state.scene_loop_enabled.lock().unwrap();

    let (mut scene_index, new_page, scene_changed) = {
        let scene = state.current_scene.lock().unwrap();
        let page_index = state.current_page_index.lock().unwrap();
        let scene_index = *state.current_scene_index.lock().unwrap();

        if let Some(scene) = scene.as_ref() {
            let current_page = *page_index;
            let total_pages = scene.page_count();

            if scene_loop_enabled {
                // Existing behavior: loop within scene
                let new_page = if current_page == 0 {
                    total_pages - 1
                } else {
                    current_page - 1
                };
                println!("Loop enabled - Current page: {}, Total pages: {}, New page: {}", current_page, total_pages, new_page);
                (scene_index, new_page, false)
            } else {
                // New behavior: transition to previous scene at boundary
                if current_page == 0 {
                    // At first page, move to previous scene (will load last page of that scene)
                    println!("At first page, moving to previous scene");
                    (scene_index, 0, true) // Placeholder page, will be updated after loading scene
                } else {
                    let new_page = current_page - 1;
                    println!("Normal navigation - Current page: {}, Total pages: {}, New page: {}", current_page, total_pages, new_page);
                    (scene_index, new_page, false)
                }
            }
        } else {
            println!("ERROR: No scene loaded");
            return Err("No scene loaded".to_string());
        }
    };

    // Handle scene transition if needed
    let mut final_page = new_page;
    if scene_changed {
        let collection = state.current_collection.lock().unwrap();
        let mut scene_idx = state.current_scene_index.lock().unwrap();

        if let Some(coll) = collection.as_ref() {
            let new_scene_idx = if scene_index == 0 {
                coll.scene_count() - 1
            } else {
                scene_index - 1
            };

            let scene = coll.load_scene(new_scene_idx)
                .map_err(|e| format!("Failed to load previous scene: {}", e))?;

            // Get the last page of the previous scene
            final_page = scene.page_count().saturating_sub(1);

            *state.current_scene.lock().unwrap() = Some(scene);
            *scene_idx = new_scene_idx;
            scene_index = new_scene_idx;
            println!("Loaded previous scene: {}, last page: {}", new_scene_idx, final_page);
        } else {
            return Err("No collection loaded".to_string());
        }
    }

    println!("Calling get_image with scene_index: {}, page: {}", scene_index, final_page);
    let result = get_image(Some(scene_index), final_page, state.clone()).await;

    // Preload next images in background (don't wait for completion)
    if result.is_ok() {
        // Clone the Arcs needed for background task
        let cache = state.cache.clone();
        let encoded_cache = state.encoded_cache.clone();
        let current_scene = state.current_scene.clone();
        let current_page_index = state.current_page_index.clone();

        tokio::spawn(async move {
            let _ = preload_next_images_task(cache, encoded_cache, current_scene, current_page_index, 3).await;
        });
    }

    println!("=== prev_page command completed ===");
    result
}

/// Background task to preload next images
async fn preload_next_images_task(
    cache: Arc<ImageCache>,
    encoded_cache: Arc<EncodedImageCache>,
    current_scene: Arc<Mutex<Option<Scene>>>,
    current_page_index: Arc<Mutex<usize>>,
    count: usize,
) -> Result<(), String> {
    println!("=== Preloading next {} images ===", count);

    let scene_guard = current_scene.lock().unwrap();
    let page_index = *current_page_index.lock().unwrap();

    if let Some(scene) = scene_guard.as_ref() {
        let total_pages = scene.page_count();

        // Get paths to preload
        let mut paths_to_load = Vec::new();
        for i in 1..=count {
            let next_page = (page_index + i) % total_pages;
            if let Some(path) = scene.get_page_image(next_page) {
                paths_to_load.push((path.to_string(), 85)); // main image with quality 85

                // Also get thumbnail path
                let thumb_path = scene.get_thumbnail_path(path);
                if thumb_path.exists() {
                    if let Some(thumb_str) = thumb_path.to_str() {
                        paths_to_load.push((thumb_str.to_string(), 75)); // thumbnail with quality 75
                    }
                }
            }
        }

        drop(scene_guard); // Release lock before loading operations

        // Load images into cache and encode them
        for (path, quality) in paths_to_load {
            // Skip if already in encoded cache
            if encoded_cache.get(&path).is_some() {
                println!("Already in encoded cache: {}", path);
                continue;
            }

            match load_image_cached(&path, &cache) {
                Ok(img) => {
                    println!("Preloaded to image cache: {}", path);
                    // Encode and store in encoded cache
                    match image_to_base64_jpeg(&img, quality) {
                        Ok(base64) => {
                            encoded_cache.insert(path.clone(), base64);
                            println!("Encoded and cached: {}", path);
                        }
                        Err(e) => eprintln!("Failed to encode {}: {}", path, e),
                    }
                }
                Err(e) => eprintln!("Failed to preload {}: {}", path, e),
            }
        }
        println!("=== Preloading completed ===");
    }

    Ok(())
}

/// Get list of available scene collections
#[tauri::command]
pub async fn get_scene_list(parent_dir: String) -> Result<Vec<SceneListItem>, String> {
    let collections = SceneCollection::find_scene_collections(&parent_dir)
        .map_err(|e| format!("Failed to find scene collections: {}", e))?;

    let items = collections
        .into_iter()
        .map(|path| SceneListItem {
            name: path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("Unknown")
                .to_string(),
            path: path.to_string_lossy().to_string(),
        })
        .collect();

    Ok(items)
}

/// Navigate to next scene
#[tauri::command]
pub async fn next_scene(state: State<'_, AppState>) -> Result<SceneInfo, String> {
    {
        let collection = state.current_collection.lock().unwrap();
        let mut scene_index = state.current_scene_index.lock().unwrap();

        if let Some(coll) = collection.as_ref() {
            let new_index = (*scene_index + 1) % coll.scene_count();

            let scene = coll.load_scene(new_index)
                .map_err(|e| format!("Failed to load next scene: {}", e))?;

            *state.current_scene.lock().unwrap() = Some(scene);
            *scene_index = new_index;
            *state.current_page_index.lock().unwrap() = 0;
        } else {
            return Err("No collection loaded".to_string());
        }
    }

    get_scene_info(state).await
}

/// Navigate to previous scene
#[tauri::command]
pub async fn prev_scene(state: State<'_, AppState>) -> Result<SceneInfo, String> {
    {
        let collection = state.current_collection.lock().unwrap();
        let mut scene_index = state.current_scene_index.lock().unwrap();

        if let Some(coll) = collection.as_ref() {
            let new_index = if *scene_index == 0 {
                coll.scene_count() - 1
            } else {
                *scene_index - 1
            };

            let scene = coll.load_scene(new_index)
                .map_err(|e| format!("Failed to load previous scene: {}", e))?;

            *state.current_scene.lock().unwrap() = Some(scene);
            *scene_index = new_index;
            *state.current_page_index.lock().unwrap() = 0;
        } else {
            return Err("No collection loaded".to_string());
        }
    }

    get_scene_info(state).await
}

/// Get scene loop enabled state
#[tauri::command]
pub async fn get_scene_loop_enabled(state: State<'_, AppState>) -> Result<bool, String> {
    Ok(*state.scene_loop_enabled.lock().unwrap())
}

/// Set scene loop enabled state
#[tauri::command]
pub async fn set_scene_loop_enabled(enabled: bool, state: State<'_, AppState>) -> Result<(), String> {
    *state.scene_loop_enabled.lock().unwrap() = enabled;
    Ok(())
}