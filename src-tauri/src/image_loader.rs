use anyhow::{Context, Result};
use std::path::Path;
use std::sync::{Arc, Mutex};
use image::{DynamicImage, GenericImageView};  // GenericImageViewを追加
use lru::LruCache;
use std::num::NonZeroUsize;

/// Represents an image with both main and thumbnail versions
#[derive(Clone)]
pub struct ImagePair {
    pub main_path: String,
    pub thumbnail_path: String,
    pub main_image: Option<Arc<DynamicImage>>,
    pub thumbnail_image: Option<Arc<DynamicImage>>,
}

/// Image cache with LRU eviction policy
pub struct ImageCache {
    cache: Arc<Mutex<LruCache<String, Arc<DynamicImage>>>>,
}

impl ImageCache {
    pub fn new(max_size: usize) -> Self {
        let capacity = NonZeroUsize::new(max_size).unwrap_or(NonZeroUsize::new(8).unwrap());
        ImageCache {
            cache: Arc::new(Mutex::new(LruCache::new(capacity))),
        }
    }

    /// Get an image from cache
    pub fn get(&self, path: &str) -> Option<Arc<DynamicImage>> {
        self.cache.lock().unwrap().get(path).cloned()
    }

    /// Insert an image into the cache
    pub fn insert(&self, path: String, image: Arc<DynamicImage>) {
        let mut cache = self.cache.lock().unwrap();
        // LRU automatically evicts least recently used item when full
        cache.put(path, image);
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

/// Cache for base64-encoded images with LRU eviction policy
pub struct EncodedImageCache {
    cache: Arc<Mutex<LruCache<String, String>>>,
}

impl EncodedImageCache {
    pub fn new(max_size: usize) -> Self {
        let capacity = NonZeroUsize::new(max_size).unwrap_or(NonZeroUsize::new(16).unwrap());
        EncodedImageCache {
            cache: Arc::new(Mutex::new(LruCache::new(capacity))),
        }
    }

    /// Get an encoded image from cache
    pub fn get(&self, path: &str) -> Option<String> {
        self.cache.lock().unwrap().get(path).cloned()
    }

    /// Insert an encoded image into the cache
    pub fn insert(&self, path: String, encoded: String) {
        let mut cache = self.cache.lock().unwrap();
        // LRU automatically evicts least recently used item when full
        cache.put(path, encoded);
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

/// Load an image with caching and automatic resizing for large images
pub fn load_image_cached(path: &str, cache: &ImageCache) -> Result<Arc<DynamicImage>> {
    // Check cache first
    if let Some(cached) = cache.get(path) {
        println!("  [ImageCache] Cache hit for: {}", path);
        return Ok(cached);
    }

    println!("  [ImageCache] Cache miss, loading from disk: {}", path);
    let load_start = std::time::Instant::now();

    // Load from disk
    let mut img = load_image(path)?;
    let original_dimensions = img.dimensions();
    println!("  [ImageCache] Loaded in {:?}, original size: {}x{}",
        load_start.elapsed(), original_dimensions.0, original_dimensions.1);

    // Automatically resize large images to improve performance
    // Maximum dimension set to 1920px for optimal balance between quality and speed
    // (Full HD resolution is sufficient for most viewing scenarios)
    const MAX_DIMENSION: u32 = 1920;
    let (width, height) = img.dimensions();

    if width > MAX_DIMENSION || height > MAX_DIMENSION {
        let resize_start = std::time::Instant::now();
        img = resize_to_fit(&img, MAX_DIMENSION, MAX_DIMENSION);
        let new_dimensions = img.dimensions();
        println!("  [ImageCache] Resized from {}x{} to {}x{} in {:?}",
            original_dimensions.0, original_dimensions.1,
            new_dimensions.0, new_dimensions.1,
            resize_start.elapsed());
    } else {
        println!("  [ImageCache] No resize needed (within {}px)", MAX_DIMENSION);
    }

    let img_arc = Arc::new(img);

    // Store in cache
    cache.insert(path.to_string(), img_arc.clone());
    println!("  [ImageCache] Stored in cache, total time: {:?}", load_start.elapsed());

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

    // Use Triangle (bilinear) filter for much faster resizing (10-20x faster than Lanczos3)
    // Quality is still good for downscaling, and speed is critical for large images
    img.resize(new_width, new_height, image::imageops::FilterType::Triangle)
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