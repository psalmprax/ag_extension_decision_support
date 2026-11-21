import React, { useState } from 'react';
import {
  type GeoVertex,
  computeParcelMetrics,
  exportToGeoJsonPolygon,
  saveParcelOffline,
} from '../../services/parcelGeoService';
import { useLanguage } from '@/lib/LanguageContext';
import { saveBlob } from '@/lib/saveBlob';

interface ParcelPolygonDrawerProps {
  farmerId?: string;
  defaultCrop?: string;
  onSavePolygon?: (geojson: ReturnType<typeof exportToGeoJsonPolygon>) => void;
}

export const ParcelPolygonDrawer: React.FC<ParcelPolygonDrawerProps> = ({
  farmerId,
  defaultCrop = 'Maize',
  onSavePolygon,
}) => {
  const { t } = useLanguage();
  const [vertices, setVertices] = useState<GeoVertex[]>([]);
  const [parcelName, setParcelName] = useState('My Field Block 1');
  const [cropType, setCropType] = useState(defaultCrop);
  const [isRecording, setIsRecording] = useState(false);
  const [accuracyMsg, setAccuracyMsg] = useState<string | null>(null);

  const metrics = computeParcelMetrics(vertices);

  const handleCaptureCurrentGps = () => {
    if (!navigator.geolocation) {
      setAccuracyMsg('Geolocation is not supported by this browser/device.');
      return;
    }

    setIsRecording(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        const newVertex: GeoVertex = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          altitude: pos.coords.altitude || undefined,
          timestamp: new Date().toISOString(),
        };

        if (pos.coords.accuracy > 20) {
          setAccuracyMsg(`GPS accuracy is low (±${Math.round(pos.coords.accuracy)}m). Walk into open sky.`);
        } else {
          setAccuracyMsg(`Point added (accuracy ±${Math.round(pos.coords.accuracy)}m)`);
        }

        setVertices(prev => [...prev, newVertex]);
        setIsRecording(false);
      },
      err => {
        setAccuracyMsg(`GPS error: ${err.message}`);
        setIsRecording(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleClear = () => {
    setVertices([]);
    setAccuracyMsg(null);
  };

  const handleExportAndSave = () => {
    if (vertices.length < 3) return;

    const feature = exportToGeoJsonPolygon(vertices, {
      parcelName,
      farmerId,
      cropType,
    });

    saveParcelOffline(feature);
    if (onSavePolygon) onSavePolygon(feature);

    const blob = new Blob([JSON.stringify(feature, null, 2)], { type: 'application/geo+json' });
    saveBlob(blob, `${parcelName.toLowerCase().replace(/\s+/g, '_')}.geojson`);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
            {t('ui_parcel_polygon_drawer_field_boundary_polygon_acreage_trace')}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {t('ui_parcel_polygon_drawer_walk_the_perimeter_of_the_field_to_m')}
          </p>
        </div>
        <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 text-xs font-bold rounded-full">
          {t('ui_parcel_polygon_drawer_wgs_84_geodesic')}
        </span>
      </div>

      {/* Metrics Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-800">
        <div>
          <span className="text-xs text-gray-500 font-medium">{t('ui_parcel_polygon_drawer_measured_acreage')}</span>
          <p className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">
            {metrics.acres} <span className="text-xs font-normal text-gray-500">{t('ui_parcel_polygon_drawer_acres')}</span>
          </p>
        </div>
        <div>
          <span className="text-xs text-gray-500 font-medium">{t('ui_parcel_polygon_drawer_metric_area')}</span>
          <p className="text-xl font-extrabold text-gray-900 dark:text-white mt-1">
            {metrics.hectares} <span className="text-xs font-normal text-gray-500">ha</span>
          </p>
        </div>
        <div>
          <span className="text-xs text-gray-500 font-medium">{t('ui_parcel_polygon_drawer_perimeter')}</span>
          <p className="text-xl font-extrabold text-gray-900 dark:text-white mt-1">
            {metrics.perimeterMeters} <span className="text-xs font-normal text-gray-500">m</span>
          </p>
        </div>
        <div>
          <span className="text-xs text-gray-500 font-medium">{t('ui_parcel_polygon_drawer_boundary_vertices')}</span>
          <p className="text-xl font-extrabold text-slate-600 dark:text-slate-400 mt-1">
            {metrics.vertexCount}
          </p>
        </div>
      </div>

      {/* Form Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('ui_parcel_polygon_drawer_parcel_plot_name')}
          </label>
          <input
            type="text"
            value={parcelName}
            onChange={e => setParcelName(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg text-sm bg-white dark:bg-gray-800 dark:border-gray-600"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('ui_parcel_polygon_drawer_primary_crop')}
          </label>
          <input
            type="text"
            value={cropType}
            onChange={e => setCropType(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg text-sm bg-white dark:bg-gray-800 dark:border-gray-600"
          />
        </div>
      </div>

      {accuracyMsg && (
        <p className="text-xs text-amber-600 dark:text-amber-400 font-medium bg-amber-50 dark:bg-amber-950/20 p-2.5 rounded-lg border border-amber-200 dark:border-amber-800">
          {accuracyMsg}
        </p>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleCaptureCurrentGps}
          disabled={isRecording}
          className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl shadow transition"
        >
          {isRecording ? 'Capturing GPS Point...' : '+ Add GPS Boundary Vertex'}
        </button>

        <button
          type="button"
          onClick={handleExportAndSave}
          disabled={vertices.length < 3}
          className="py-3 px-5 bg-slate-600 hover:bg-slate-700 text-white text-sm font-semibold rounded-xl shadow disabled:opacity-50 transition"
        >
          {t('ui_parcel_polygon_drawer_export_geojson_save')}
        </button>

        <button
          type="button"
          onClick={handleClear}
          disabled={vertices.length === 0}
          className="py-3 px-4 border border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-xl transition"
        >
          {t('ui_parcel_polygon_drawer_clear_points')}
        </button>
      </div>

      {/* Vertex Table */}
      {vertices.length > 0 && (
        <div className="max-h-40 overflow-y-auto border border-gray-100 dark:border-gray-800 rounded-xl">
          <table className="min-w-full text-xs text-start">
            <thead className="bg-gray-50 dark:bg-gray-900 text-gray-500">
              <tr>
                <th className="p-2">#</th>
                <th className="p-2">{t('latitude')}</th>
                <th className="p-2">{t('longitude')}</th>
                <th className="p-2">{t('ui_parcel_polygon_drawer_accuracy')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {vertices.map((v, i) => (
                <tr key={i} className="hover:bg-gray-50/50 dark:hover:bg-gray-900/50">
                  <td className="p-2 font-medium">{i + 1}</td>
                  <td className="p-2 font-mono">{v.lat.toFixed(6)}</td>
                  <td className="p-2 font-mono">{v.lng.toFixed(6)}</td>
                  <td className="p-2 text-gray-400">±{v.accuracy ? Math.round(v.accuracy) : 5}m</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
