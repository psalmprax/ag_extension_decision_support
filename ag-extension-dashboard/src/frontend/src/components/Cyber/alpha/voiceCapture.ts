import toast from 'react-hot-toast';

/** Begin voice capture and hand the recorded blob to onReady; null when unsupported. */
export function getSupportedMimeType(): string {
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return '';
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/ogg', 'audio/wav'];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) return c;
  }
  return '';
}

export async function startVoiceCapture(onReady: (blob: Blob, mimeType: string) => Promise<void>): Promise<MediaRecorder | null> {
  if (!navigator.mediaDevices?.getUserMedia) {
    toast.error('Voice input unavailable in this browser');
    return null;
  }
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mimeType = getSupportedMimeType();
  const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = e => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  recorder.onstop = async () => {
    stream.getTracks().forEach(t => t.stop());
    const effectiveType = recorder.mimeType || mimeType || 'audio/webm';
    await onReady(new Blob(chunks, { type: effectiveType }), effectiveType);
  };
  recorder.start();
  return recorder;
}
