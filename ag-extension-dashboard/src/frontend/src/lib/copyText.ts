import toast from 'react-hot-toast';

/**
 * Copy text to the clipboard. Resolves false when the browser refuses (a page served over
 * plain http, a denied permission, an old browser), so the caller never says "Copied"
 * for something that was not copied.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (error) {
    console.warn('Clipboard API refused the copy; trying the selection fallback:', error);
  }
  // Older browsers and insecure pages: copy from a hidden text area.
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  try {
    area.select();
    return document.execCommand('copy');
  } catch (error) {
    console.warn('Copy fallback failed:', error);
    return false;
  } finally {
    area.remove();
  }
}

/** Copy, then tell the person whether it worked. */
export async function copyWithToast(text: string, copiedMessage: string): Promise<boolean> {
  const copied = await copyText(text);
  if (copied) toast.success(copiedMessage);
  else toast.error('Could not copy. Select the text and copy it yourself.');
  return copied;
}
