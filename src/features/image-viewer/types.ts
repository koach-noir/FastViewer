export interface SceneInfo {
    scene_name: string;
    scene_index: number;
    total_pages: number;
    current_page: number;
  }
  
  export interface ImageData {
    main_image: string | null;
    thumbnail_image: string | null;
    page_index: number;
    scene_index: number;
    image_path: string;
    is_preview: boolean; // true if low-res preview, false if full resolution
  }
  
  export interface SceneListItem {
    name: string;
    path: string;
  }