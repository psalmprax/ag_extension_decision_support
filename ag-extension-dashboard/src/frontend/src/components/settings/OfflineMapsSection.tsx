import { useState } from 'react';
import { Map as MapIcon, Download, Trash2 } from 'lucide-react';
import { prefetchDistrictTiles, getTileCacheSize, clearTileCache, estimateDownload } from '@/lib/offlineTiles';
import { useLanguage } from '@/lib/LanguageContext';

// Default country bbox (Malawi) — users can override with custom district bounds.
const DEFAULT_BBOX = { minLat: -17.2, minLng: 32.6, maxLat: -9.3, maxLng: 36.0 };

export function OfflineMapsSection() {
    const { t } = useLanguage();
    const [status, setStatus] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [bbox, setBbox] = useState(DEFAULT_BBOX);
    const [customMode, setCustomMode] = useState(false);
    const estimate = estimateDownload(bbox, 8, 12);

    const handlePrefetch = async () => {
        setBusy(true);
        setStatus('Downloading maps…');
        try {
            const result = await prefetchDistrictTiles(bbox, (done, total) =>
                setStatus(`Downloading maps… ${done}/${total}`)
            );
            setStatus(`Maps ready offline — ${result.downloaded} new, ${result.skipped} already saved (${result.total} total)`);
        } catch (error) {
            setStatus(error instanceof Error ? error.message : 'Download failed');
        } finally {
            setBusy(false);
        }
    };

    const handleClear = async () => {
        await clearTileCache();
        setStatus(`Offline maps cleared (${await getTileCacheSize()} tiles cached now)`);
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-white/[0.04] rounded-xl">
                <div className="flex items-center gap-3 min-w-0">
                    <MapIcon className="w-4 h-4 text-primary-500 shrink-0" />
                    <div className="min-w-0">
                        <p className="text-sm font-medium">{t('ui_settings_panel_offline_maps')}</p>
                        <p className="text-xs text-gray-400 truncate">
                            {customMode ? `Custom bbox, zoom 8–12 · ~${Math.round(estimate.approxKb / 1024)} MB` : `Country-wide tiles, zoom 8–12 · ~${Math.round(estimate.approxKb / 1024)} MB`}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                    <button
                        onClick={handlePrefetch}
                        disabled={busy}
                        className="p-2 rounded-xl bg-primary-500/10 text-primary-600 dark:text-primary-400 hover:bg-primary-500/20 disabled:opacity-50"
                        aria-label="Download offline maps"
                        title="Download offline maps"
                    >
                        <Download className="w-4 h-4" />
                    </button>
                    <button
                        onClick={handleClear}
                        className="p-2 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-500/10"
                        aria-label="Clear offline maps"
                        title="Clear offline maps"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            </div>
            <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
                    <input type="checkbox" checked={customMode} onChange={e => setCustomMode(e.target.checked)} className="rounded" /> {t('ui_offline_maps_section_custom_bbox')}
                </label>
            </div>
            {customMode && (
                <div className="grid grid-cols-2 gap-2">
                    {(['minLat','minLng','maxLat','maxLng'] as const).map(k => (
                        <label key={k} className="text-xs text-gray-500 flex flex-col gap-1">
                            {k}
                            <input type="number" step="0.1" value={bbox[k]} onChange={e => setBbox(prev => ({ ...prev, [k]: parseFloat(e.target.value) || prev[k] }))} className="px-2 py-1 rounded bg-white dark:bg-theme-bg-tertiary border border-gray-200 dark:border-white/[0.12] text-xs" />
                        </label>
                    ))}
                </div>
            )}
            {status && <p className="text-xs text-gray-500 dark:text-theme-text-muted" role="status">{status}</p>}
        </div>
    );
}
