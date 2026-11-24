/**
 * Photos sent to the online AI vision check are billed by size: Claude by pixel area (one token
 * per 28x28 patch), Gemini per 768x768 tile. A phone photo of 4000x3000 or a 1920px copy costs
 * several times what the model needs to see a leaf's spots, so photos are shrunk to
 * VISION_MAX_SIDE on the long side before they are sent or queued.
 */
export const VISION_MAX_SIDE = 1024;
const JPEG_QUALITY = 0.85;

function dataUrlToBlob(dataUrl: string): Blob {
  const [head, body] = dataUrl.split(',', 2);
  const type = /data:([^;]+)/.exec(head)?.[1] ?? 'image/jpeg';
  const bytes = atob(body ?? '');
  const buffer = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i += 1) buffer[i] = bytes.charCodeAt(i);
  return new Blob([buffer], { type });
}

/**
 * The photo with its long side at most `maxSide`, as a JPEG in the form it was given (a data URL,
 * or bare base64). Unchanged when it is already that small, or when this browser cannot redraw
 * it (no createImageBitmap); the online check then works as before, at the old size.
 */
export async function shrinkForVision(photo: string, maxSide = VISION_MAX_SIDE): Promise<string> {
  if (!photo || typeof createImageBitmap !== 'function') return photo;
  const isDataUrl = photo.startsWith('data:');
  try {
    const bitmap = await createImageBitmap(dataUrlToBlob(isDataUrl ? photo : `data:image/jpeg;base64,${photo}`));
    const scale = maxSide / Math.max(bitmap.width, bitmap.height);
    if (scale >= 1) {
      bitmap.close();
      return photo;
    }
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) {
      bitmap.close();
      return photo;
    }
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const shrunk = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
    return isDataUrl ? shrunk : shrunk.slice(shrunk.indexOf(',') + 1);
  } catch (error) {
    console.warn('The photo could not be shrunk; sending it at its own size.', error);
    return photo;
  }
}
