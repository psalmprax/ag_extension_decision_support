import React, { useState } from 'react';
import { analyzeCropVideo, MAX_DIAGNOSIS_VIDEO_BYTES } from '../../api/diseaseService';

function readVideo(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string'
      ? resolve(reader.result)
      : reject(new Error('Could not read the video.'));
    reader.onerror = () => reject(new Error('Could not read the video.'));
    reader.onabort = () => reject(new Error('Reading the video was interrupted.'));
    reader.readAsDataURL(file);
  });
}

export function VideoAnalysisTab() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<{ analysis: string; framesAnalyzed: number } | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const selectFile = (selected?: File) => {
    setResult(null);
    setError('');
    if (!selected) {
      setFile(null);
    } else if (!['video/mp4', 'video/webm', 'video/quicktime'].includes(selected.type)) {
      setFile(null);
      setError('Choose an MP4, WebM or MOV video.');
    } else if (selected.size === 0 || selected.size > MAX_DIAGNOSIS_VIDEO_BYTES) {
      setFile(null);
      setError('Choose a non-empty video no larger than 30 MB.');
    } else {
      setFile(selected);
    }
  };

  const analyze = async () => {
    if (!file || loading) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      setResult(await analyzeCropVideo(await readVideo(file)));
    } catch (err) {
      console.error('Video observation failed:', err);
      setError('Video observations are unavailable. Check your connection and sign-in, then retry or contact an extension officer.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-5 rounded-lg bg-slate-900/80 border border-slate-800 space-y-4 text-slate-200">
      <h3 className="text-sm font-semibold">Video observations</h3>
      <p className="text-xs text-slate-300">
        Upload an MP4, WebM or MOV video up to 30 MB. Selected frames are sent to a configured AI provider.
        Observations are not a diagnosis; confirm concerns with a local expert before treatment.
      </p>
      <label htmlFor="diagnosis-video" className="block text-xs font-medium">Choose a plant video</label>
      <input id="diagnosis-video" type="file" accept="video/mp4,video/webm,video/quicktime" disabled={loading}
        onChange={event => selectFile(event.target.files?.[0])} className="block w-full text-xs" />
      {file && <p className="text-xs">Selected: {file.name}</p>}
      <button type="button" onClick={analyze} disabled={!file || loading}
        className="px-4 py-2 bg-emerald-600 rounded text-sm disabled:opacity-40">
        {loading ? 'Analyzing video...' : 'Analyze video'}
      </button>
      {error && <p role="alert" className="text-xs text-rose-300">{error}</p>}
      {result && (
        <section aria-label="Video observation results" className="space-y-2 border-t border-slate-700 pt-4">
          <h4 className="text-sm font-medium">Unverified observations from {result.framesAnalyzed} frame(s)</h4>
          <p className="text-xs whitespace-pre-wrap">{result.analysis}</p>
          <p className="text-xs text-amber-300">Not a diagnosis. Consult a qualified local expert before treatment.</p>
        </section>
      )}
    </div>
  );
}
