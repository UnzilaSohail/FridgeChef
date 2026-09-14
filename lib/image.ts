const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.82;
// Generous ceiling meant to catch "wrong file picked" (video, RAW, etc.),
// not legitimate photos — even an uncompressed 48MP camera shot is well
// under this.
const MAX_SOURCE_BYTES = 75 * 1024 * 1024;

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
  // Only reject on a confidently-wrong type. Some browsers/OSes (notably
  // HEIC on Windows/Chrome) leave `file.type` empty for formats they can't
  // identify even when the file itself decodes fine downstream — treat
  // "unknown" as "let the decoder decide" rather than a hard rejection, and
  // only hard-reject a type that's explicitly something else (e.g. video/*,
  // application/pdf).
  if (file.type && !file.type.startsWith("image/")) {
    throw new Error("That file isn't a photo — pick an image instead");
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error("That photo is too large — try a smaller image");
  }

  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, {
        resizeWidth: MAX_DIMENSION,
        resizeQuality: "medium",
        // Explicit rather than relying on the browser default: older Chrome
        // (<89) defaults imageOrientation to "none", which decodes straight
        // from raw pixel data and ignores the EXIF rotation flag phone
        // cameras write. Without this, a portrait fridge photo silently
        // comes out sideways after resizing — the resize dimensions get
        // computed from the *unrotated* bitmap, so it's not recoverable
        // downstream. "from-image" (the current spec default) makes this
        // consistent across browsers instead of trusting each one's default.
        imageOrientation: "from-image",
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
  // <img>/canvas decoding already applies EXIF orientation in every
  // evergreen browser, so no equivalent option is needed here.
  let dataUrl: string;
  let img: HTMLImageElement;
  try {
    dataUrl = await readAsDataUrl(file);
    img = await loadImage(dataUrl);
  } catch {
    throw new Error("Could not read that photo — try a different one or take a new photo");
  }
  const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
  if (scale === 1) return dataUrl;
  try {
    return drawToJpegDataUrl(img, Math.round(img.width * scale), Math.round(img.height * scale));
  } catch {
    throw new Error("Could not process that photo — try a different one or take a new photo");
  }
}
