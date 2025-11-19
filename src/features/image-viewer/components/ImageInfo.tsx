import { SceneInfo, ImageData } from "../../../types";

interface ImageInfoProps {
  sceneInfo: SceneInfo | null;
  imageData: ImageData | null;
  displayLevel: number;
}

/**
 * Image information display component
 * Shows scene name, total pages, page number, and filename
 */
export function ImageInfo({ sceneInfo, imageData, displayLevel }: ImageInfoProps) {
  if (!sceneInfo || !imageData) return null;

  return (
    <>
      {/* Level 1+: Scene info (name + total pages at level 2+) */}
      <div className={`scene-info ui-element ${displayLevel >= 1 ? "visible" : ""}`}>
        <div>{sceneInfo.scene_name}</div>
        <div className={`scene-total-pages ui-element ${displayLevel >= 2 ? "visible" : ""}`}>
          Total Pages: {sceneInfo.total_pages}
        </div>
      </div>

      {/* Level 2+: Page number */}
      <div className={`info-overlay ui-element ${displayLevel >= 2 ? "visible" : ""}`}>
        Page {sceneInfo.current_page + 1}
      </div>

      {/* Level 2+: Image filename */}
      <div className={`page-info ui-element ${displayLevel >= 2 ? "visible" : ""}`}>
        {imageData.image_path.split(/[/\\]/).pop()}
      </div>
    </>
  );
}
