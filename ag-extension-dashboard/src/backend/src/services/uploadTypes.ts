import path from 'path';

/** File types the platform stores, with the extension each is saved under. */
export const UPLOAD_TYPES = {
  // Images
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',
  // Documents
  'application/pdf': '.pdf',
  'text/csv': '.csv',
  'text/plain': '.txt',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/msword': '.doc',
  // Videos
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/quicktime': '.mov',
  'video/x-matroska': '.mkv',
  // Audio
  'audio/mpeg': '.mp3',
  'audio/wav': '.wav',
  'audio/ogg': '.ogg',
  'audio/webm': '.webm',
  'audio/aac': '.aac',
  'audio/mp4': '.m4a',
  'audio/x-m4a': '.m4a',
} as const;

export type SupportedMimeType = keyof typeof UPLOAD_TYPES;

/**
 * The upload type for a file name's extension, for files that arrive without one (inside
 * an archive). `kind` settles extensions shared by two kinds, such as .webm audio or video.
 */
export function mimeTypeForName(name: string, kind?: 'audio' | 'image' | 'video'): SupportedMimeType | null {
  const ext = path.extname(name).toLowerCase().replace('.jpeg', '.jpg');
  const matches = (Object.entries(UPLOAD_TYPES) as Array<[SupportedMimeType, string]>).filter(([, extension]) => extension === ext);
  return (kind ? matches.find(([type]) => type.startsWith(`${kind}/`)) : matches[0])?.[0] ?? null;
}
