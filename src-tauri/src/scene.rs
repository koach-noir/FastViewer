use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use anyhow::{Context, Result};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ImageSize {
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SceneMetadata {
    pub version: String,
    #[serde(rename = "sceneName")]
    pub scene_name: String,
    #[serde(rename = "imageSize")]
    pub image_size: ImageSize,
    #[serde(rename = "thumbnailSize")]
    pub thumbnail_size: ImageSize,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Page {
    pub image: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Scene {
    pub metadata: SceneMetadata,
    pub pages: Vec<Page>,
}

impl Scene {
    /// Load a scene from a JSON file
    pub fn load_from_file<P: AsRef<Path>>(path: P) -> Result<Self> {
        let path = path.as_ref();
        let content = std::fs::read_to_string(path)
            .with_context(|| format!("Failed to read scene file: {:?}", path))?;

        let scene: Scene = serde_json::from_str(&content)
            .with_context(|| format!("Failed to parse scene JSON: {:?}", path))?;

        Ok(scene)
    }

    /// Get total number of pages in the scene
    pub fn page_count(&self) -> usize {
        self.pages.len()
    }

    /// Get image path for a specific page index
    pub fn get_page_image(&self, index: usize) -> Option<&str> {
        self.pages.get(index).map(|p| p.image.as_str())
    }

    /// Get thumbnail path for a specific page
    /// Follows the pattern: {main_dir}/thumbnail/{filename}
    pub fn get_thumbnail_path(&self, main_path: &str) -> PathBuf {
        let path = Path::new(main_path);
        if let Some(parent) = path.parent() {
            if let Some(filename) = path.file_name() {
                return parent.join("thumbnail").join(filename);
            }
        }
        PathBuf::from(main_path)
    }
}

/// Represents a collection of scenes in a directory
#[derive(Debug, Clone)]
pub struct SceneCollection {
    pub base_path: PathBuf,
    pub scene_files: Vec<PathBuf>,
}

impl SceneCollection {
    /// Create a new SceneCollection from a base directory
    pub fn new<P: AsRef<Path>>(base_path: P) -> Result<Self> {
        let base_path = base_path.as_ref().to_path_buf();

        if !base_path.exists() {
            anyhow::bail!("Scene directory does not exist: {:?}", base_path);
        }

        let mut scene_files = Vec::new();

        // Find all scene_*.json files
        for entry in std::fs::read_dir(&base_path)? {
            let entry = entry?;
            let path = entry.path();

            if path.is_file() {
                if let Some(filename) = path.file_name() {
                    let filename_str = filename.to_string_lossy();
                    if filename_str.starts_with("scene_") && filename_str.ends_with(".json") {
                        scene_files.push(path);
                    }
                }
            }
        }

        // Sort scene files by name
        scene_files.sort();

        Ok(SceneCollection {
            base_path,
            scene_files,
        })
    }

    /// Get total number of scenes
    pub fn scene_count(&self) -> usize {
        self.scene_files.len()
    }

    /// Load a specific scene by index
    pub fn load_scene(&self, index: usize) -> Result<Scene> {
        let scene_path = self.scene_files.get(index)
            .with_context(|| format!("Scene index out of bounds: {}", index))?;

        Scene::load_from_file(scene_path)
    }

    /// Get all available scene directories in a parent directory
    pub fn find_scene_collections<P: AsRef<Path>>(parent_dir: P) -> Result<Vec<PathBuf>> {
        let parent_dir = parent_dir.as_ref();
        let mut collections = Vec::new();

        for entry in std::fs::read_dir(parent_dir)? {
            let entry = entry?;
            let path = entry.path();

            if path.is_dir() {
                if let Some(dirname) = path.file_name() {
                    let dirname_str = dirname.to_string_lossy();
                    if dirname_str.starts_with("scenes-") {
                        collections.push(path);
                    }
                }
            }
        }

        collections.sort();
        Ok(collections)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_thumbnail_path() {
        let scene = Scene {
            metadata: SceneMetadata {
                version: "1.0".to_string(),
                scene_name: "Test".to_string(),
                image_size: ImageSize { width: 1920, height: 1080 },
                thumbnail_size: ImageSize { width: 320, height: 180 },
            },
            pages: vec![],
        };

        let main_path = "/path/to/images/image.jpg";
        let thumb_path = scene.get_thumbnail_path(main_path);

        assert_eq!(
            thumb_path.to_string_lossy(),
            "/path/to/images/thumbnail/image.jpg"
        );
    }
}