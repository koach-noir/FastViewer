use anyhow::{Context, Result};
use std::path::Path;
use std::sync::{Arc, Mutex};
use std::collections::HashMap;
use image::{DynamicImage, GenericImageView};  // GenericImageViewを追加

/// Represents an image with both main and thumbnail versions
#[derive(Clone)]
pub struct ImagePair {
    pub main_path: String,
    pub thumbnail_path: String,
    pub main_image: Option<Arc<DynamicImage>>,
    pub thumbnail_image: Option<Arc<DynamicImage>>,
}

/// Image cache with a maximum capacity
pub struct ImageCache {
    cache: Arc<Mutex<HashMap<String, Arc<DynamicImage>>>>,
    max_size: usize,
}

impl ImageCache {
    pub fn new(max_size: usize) -> Self {
        ImageCache {
            cache: Arc::new(Mutex::new(HashMap::new())),
            max_size,
        }
    }

    /// Get an image from cache
    pub fn get(&self, path: &str) -> Option<Arc<DynamicImage>> {
        self.cache.lock().unwrap().get(path).cloned()
    }

    /// Insert an image into the cache
    pub fn insert(&self, path: String, image: Arc<DynamicImage>) {
        let mut cache = self.cache.lock().unwrap();

        // Simple eviction: if cache is full, clear it
        if cache.len() >= self.max_size {
            cache.clear();
        }

        cache.insert(path, image);
    }

    /// Clear the entire cache
    pub fn clear(&self) {
        self.cache.lock().unwrap().clear();
    }

    /// Get current cache size
    pub fn size(&self) -> usize {
        self.cache.lock().unwrap().len()
    }
}

/// Load an image from a file path
pub fn load_image<P: AsRef<Path>>(path: P) -> Result<DynamicImage> {
    let path = path.as_ref();

    image::open(path)
        .with_context(|| format!("Failed to load image: {:?}", path))
}

/// Load an image with caching
pub fn load_image_cached(path: &str, cache: &ImageCache) -> Result<Arc<DynamicImage>> {
    // Check cache first
    if let Some(cached) = cache.get(path) {
        return Ok(cached);
    }

    // Load from disk
    let img = load_image(path)?;
    let img_arc = Arc::new(img);

    // Store in cache
    cache.insert(path.to_string(), img_arc.clone());

    Ok(img_arc)
}

/// Convert an image to base64 encoded JPEG
pub fn image_to_base64_jpeg(img: &DynamicImage, quality: u8) -> Result<String> {
    use std::io::Cursor;  // use image::ImageFormat; を削除

    let mut buffer = Cursor::new(Vec::new());

    let rgb_img = img.to_rgb8();

    let encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut buffer, quality);
    rgb_img.write_with_encoder(encoder)?;

    let base64 = base64_encode(buffer.get_ref());
    Ok(format!("data:image/jpeg;base64,{}", base64))
}

/// Convert an image to base64 encoded PNG
pub fn image_to_base64_png(img: &DynamicImage) -> Result<String> {
    use image::ImageFormat;
    use std::io::Cursor;

    let mut buffer = Cursor::new(Vec::new());
    img.write_to(&mut buffer, ImageFormat::Png)?;

    let base64 = base64_encode(buffer.get_ref());
    Ok(format!("data:image/png;base64,{}", base64))
}

/// Simple base64 encoding
fn base64_encode(data: &[u8]) -> String {
    const ALPHABET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

    let mut result = String::new();
    let mut i = 0;

    while i + 2 < data.len() {
        let b1 = data[i];
        let b2 = data[i + 1];
        let b3 = data[i + 2];

        result.push(ALPHABET[(b1 >> 2) as usize] as char);
        result.push(ALPHABET[(((b1 & 0x03) << 4) | (b2 >> 4)) as usize] as char);
        result.push(ALPHABET[(((b2 & 0x0F) << 2) | (b3 >> 6)) as usize] as char);
        result.push(ALPHABET[(b3 & 0x3F) as usize] as char);

        i += 3;
    }

    // Handle remaining bytes
    match data.len() - i {
        1 => {
            let b1 = data[i];
            result.push(ALPHABET[(b1 >> 2) as usize] as char);
            result.push(ALPHABET[((b1 & 0x03) << 4) as usize] as char);
            result.push_str("==");
        }
        2 => {
            let b1 = data[i];
            let b2 = data[i + 1];
            result.push(ALPHABET[(b1 >> 2) as usize] as char);
            result.push(ALPHABET[(((b1 & 0x03) << 4) | (b2 >> 4)) as usize] as char);
            result.push(ALPHABET[((b2 & 0x0F) << 2) as usize] as char);
            result.push('=');
        }
        _ => {}
    }

    result
}

/// Resize an image to fit within max dimensions while preserving aspect ratio
pub fn resize_to_fit(img: &DynamicImage, max_width: u32, max_height: u32) -> DynamicImage {
    let (width, height) = img.dimensions();

    if width <= max_width && height <= max_height {
        return img.clone();
    }

    let width_ratio = max_width as f32 / width as f32;
    let height_ratio = max_height as f32 / height as f32;
    let ratio = width_ratio.min(height_ratio);

    let new_width = (width as f32 * ratio) as u32;
    let new_height = (height as f32 * ratio) as u32;

    img.resize(new_width, new_height, image::imageops::FilterType::Lanczos3)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_image_cache() {
        let cache = ImageCache::new(2);
        assert_eq!(cache.size(), 0);

        // Cache operations would require actual images
        // This is a placeholder for future integration tests
    }

    #[test]
    fn test_base64_encode() {
        let data = b"Hello, World!";
        let encoded = base64_encode(data);
        assert_eq!(encoded, "SGVsbG8sIFdvcmxkIQ==");
    }
}