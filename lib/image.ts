const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.82;
// Real phone photos routinely exceed this once base64-encoded, which trips
// the platform's request body cap and previously crashed JSON parsing.
const SKIP_RESIZE_UNDER_BYTES = 1_500_000;

function readAsDataUrl(file: File): Promise<string> {
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

/**
 * Downscales large photos client-side before they're sent as a base64 JSON
 * payload — an unresized phone photo can exceed the platform's request body
 * limit and get truncated server-side.
 */
export async function fileToUploadableDataUrl(file: File): Promise<string> {
  const dataUrl = await readAsDataUrl(file);
  if (file.size < SKIP_RESIZE_UNDER_BYTES) return dataUrl;

  const img = await loadImage(dataUrl);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
  if (scale === 1) return dataUrl;

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
}
