const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.82;

function readAsDataUrl(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not decode image"));
    img.src = src;
  });
}

function drawToJpegDataUrl(source: CanvasImageSource, width: number, height: number): string {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.drawImage(source, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
}

/**
 * Downscales photos client-side before they're sent as a base64 JSON
 * payload. Always goes through createImageBitmap's resize hints (when
 * available) rather than gating on file size first — a modern phone camera
 * photo is routinely 12-48 megapixels, but a heavily compressed JPEG at
 * that resolution can still be under a few hundred KB on disk, so file size
 * is not a safe signal for how risky the photo is to decode. Decoding at
 * full resolution first (the old `new Image()` + canvas approach) is
 * exactly what throws "unable to load image due to low memory" on phones.
 *
 * createImageBitmap's resizeWidth hint lets the browser decode directly at
 * the smaller target size instead of ever materializing the full-resolution
 * bitmap — the standard fix for large mobile photo uploads. It also skips
 * the FileReader round-trip (no giant base64 string held in memory
 * alongside the decoded image).
 */
export async function fileToUploadableDataUrl(file: File): Promise<string> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, {
        resizeWidth: MAX_DIMENSION,
        resizeQuality: "medium",
      });
      try {
        return drawToJpegDataUrl(bitmap, bitmap.width, bitmap.height);
      } finally {
        bitmap.close();
      }
    } catch {
      // Some browsers support createImageBitmap but not the resize options,
      // or refuse this particular file — fall through to the <img> path.
    }
  }

  // Fallback for browsers without resizing createImageBitmap support. Still
  // decodes at full resolution first, so it carries the same memory risk
  // this function exists to avoid — but it's better than failing outright.
  const dataUrl = await readAsDataUrl(file);
  const img = await loadImage(dataUrl);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
  if (scale === 1) return dataUrl;
  return drawToJpegDataUrl(img, Math.round(img.width * scale), Math.round(img.height * scale));
}
