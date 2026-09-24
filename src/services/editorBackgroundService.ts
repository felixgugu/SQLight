/**
 * Editor backdrop image pipeline for the SQL editor.
 *
 * A user-picked image is decoded, fitted into a bounded box and re-encoded as a PNG data URL so a
 * transparent PNG keeps its alpha channel while the payload stays small enough to live inside the
 * localStorage-backed settings store. Everything happens in the WebView; no Tauri IPC is involved,
 * which keeps the same code path working in the browser mock environment.
 */

export const EDITOR_BACKGROUND_ACCEPTED_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
] as const;

/** Longest edge of the first encode pass. Retried smaller while the PNG is still too heavy. */
export const EDITOR_BACKGROUND_MAX_DIMENSION = 1600;

/** Serialized size ceiling for `sqlight_app_settings` (localStorage quota is shared with the rest). */
export const EDITOR_BACKGROUND_MAX_DATA_URL_BYTES = 1_200_000;

const MIN_DIMENSION = 240;
const SCALE_STEP = 0.72;

export type EditorBackgroundErrorCode = 'unsupported_type' | 'decode_failed' | 'too_large';

export class EditorBackgroundError extends Error {
  readonly code: EditorBackgroundErrorCode;

  constructor(code: EditorBackgroundErrorCode, message: string) {
    super(message);
    this.name = 'EditorBackgroundError';
    this.code = code;
  }
}

export interface EditorBackgroundImage {
  /** `data:image/png;base64,...` payload persisted in the settings store. */
  dataUrl: string;
  width: number;
  height: number;
  /** Approximate decoded byte size of the data URL payload. */
  bytes: number;
}

/**
 * Largest `width x height` box that fits inside `maxDimension` without changing the aspect ratio.
 * Returns zeroes for unusable dimensions so callers can bail out instead of producing NaN canvases.
 */
export function fitWithin(
  width: number,
  height: number,
  maxDimension: number
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (!Number.isFinite(longest) || longest <= 0 || !Number.isFinite(maxDimension) || maxDimension <= 0) {
    return { width: 0, height: 0 };
  }
  const ratio = Math.min(1, maxDimension / longest);
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
}

/** Approximate decoded byte size of a data URL (base64 carries 3 bytes per 4 characters). */
export function dataUrlByteSize(dataUrl: string): number {
  const comma = dataUrl.indexOf(',');
  if (comma < 0) return dataUrl.length;
  const base64 = dataUrl.slice(comma + 1);
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

export function isAcceptedImageType(type: string): boolean {
  return (EDITOR_BACKGROUND_ACCEPTED_TYPES as readonly string[]).includes(type);
}

function loadImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new EditorBackgroundError('decode_failed', 'Image could not be decoded'));
    };
    image.src = objectUrl;
  });
}

function renderPngDataUrl(image: HTMLImageElement, width: number, height: number): string {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new EditorBackgroundError('decode_failed', 'Canvas 2D context is unavailable');
  }
  // Keep the alpha channel intact: never fill a backdrop colour before drawing the source image.
  context.clearRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL('image/png');
}

/**
 * Decode `file`, then shrink-and-encode until the PNG fits the storage budget.
 *
 * Throws {@link EditorBackgroundError} with a stable `code` so the calling UI can translate the
 * failure instead of leaking a raw DOM exception.
 */
export async function prepareEditorBackgroundImage(file: File): Promise<EditorBackgroundImage> {
  if (!isAcceptedImageType(file.type)) {
    throw new EditorBackgroundError('unsupported_type', `Unsupported image type: ${file.type || 'unknown'}`);
  }

  const image = await loadImageElement(file);
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  if (!sourceWidth || !sourceHeight) {
    throw new EditorBackgroundError('decode_failed', 'Image has no measurable size');
  }

  let maxDimension = EDITOR_BACKGROUND_MAX_DIMENSION;
  let smallest: EditorBackgroundImage | null = null;

  while (maxDimension >= MIN_DIMENSION) {
    const size = fitWithin(sourceWidth, sourceHeight, maxDimension);
    const dataUrl = renderPngDataUrl(image, size.width, size.height);
    const bytes = dataUrlByteSize(dataUrl);
    smallest = { dataUrl, width: size.width, height: size.height, bytes };
    if (bytes <= EDITOR_BACKGROUND_MAX_DATA_URL_BYTES) {
      return smallest;
    }
    maxDimension = Math.round(maxDimension * SCALE_STEP);
  }

  throw new EditorBackgroundError(
    'too_large',
    `Image still occupies ${smallest?.bytes ?? 0} bytes at ${smallest?.width ?? 0}x${smallest?.height ?? 0}`
  );
}
