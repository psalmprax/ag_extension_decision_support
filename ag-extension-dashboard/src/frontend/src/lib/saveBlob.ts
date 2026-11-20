/**
 * Saves a blob as a file download. The object URL is released a moment later rather
 * than at once: some browsers (Safari, Firefox) start the download asynchronously and
 * fail if the URL is gone.
 */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
