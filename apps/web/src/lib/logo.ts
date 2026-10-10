const MAX_DATA_URL = 400_000; // matches the gateway's limit (~300 KB of image)
const MAX_SIDE = 256;

/**
 * Turns an uploaded file into a data URL the gateway accepts. Raster images
 * are scaled down to 256px (PNG) so they stay small and sharp; SVGs are kept
 * as-is.
 */
export async function logoToDataUrl(file: File): Promise<string> {
  if (!/^image\/(png|jpeg|webp|svg\+xml)$/.test(file.type)) {
    throw new Error("Use a PNG, JPG, WebP or SVG image.");
  }
  const original = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Couldn't read that file."));
    reader.readAsDataURL(file);
  });
  if (file.type === "image/svg+xml") {
    if (original.length > MAX_DATA_URL) throw new Error("That SVG is too large (max 300 KB).");
    return original;
  }
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("Couldn't open that image."));
    el.src = original;
  });
  const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return original.length <= MAX_DATA_URL ? original : Promise.reject(new Error("That image is too large."));
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const out = canvas.toDataURL("image/png");
  if (out.length > MAX_DATA_URL) throw new Error("That image is too large even after resizing.");
  return out;
}
