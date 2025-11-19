import { ImageData } from "../../../types";

interface ImageDisplayProps {
  imageData: ImageData | null;
}

/**
 * Image display component
 * Renders the main image or thumbnail
 */
export function ImageDisplay({ imageData }: ImageDisplayProps) {
  if (!imageData) return null;

  return (
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
  );
}
