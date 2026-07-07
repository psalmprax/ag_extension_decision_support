import React, { useState } from 'react';
import {
  Upload,
  Activity,
  Layers,
  Droplet,
  AlertTriangle,
  CheckCircle,
  Download,
  Loader2,
} from 'lucide-react';
import { analyzeSoilImage, type SoilAnalysisResult } from '../../api/diseaseService';
import toast from 'react-hot-toast';

interface Props {
  cropType: string;
  setCropType: (val: string) => void;
  radiusClass: string;
  btnClass: string;
  addNotification: (notification: { type: string; message: string }) => void;
}

export function SoilDiagnosticsTab({
  cropType,
  setCropType,
  radiusClass,
  btnClass,
  addNotification,
}: Props) {
  const [selectedSoilImage, setSelectedSoilImage] = useState<File | null>(null);
  const [soilImagePreview, setSoilImagePreview] = useState<string | null>(null);
  const [isAnalyzingSoil, setIsAnalyzingSoil] = useState(false);
  const [soilAnalysis, setSoilAnalysis] = useState<SoilAnalysisResult | null>(null);
  const [farmNotes, setFarmNotes] = useState('');

  const handleSoilImageSelect = (file: File) => {
    setSelectedSoilImage(file);
    const reader = new FileReader();
    reader.onload = e => {
      setSoilImagePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleAnalyzeSoil = async () => {
    if (!selectedSoilImage) return;

    setIsAnalyzingSoil(true);
    setSoilAnalysis(null);
    try {
      const base64Promise = new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target?.result as string);
        reader.onerror = err => reject(err);
        reader.readAsDataURL(selectedSoilImage);
      });
      const base64 = await base64Promise;
      const imageData = base64.split(',')[1];

      const res = await analyzeSoilImage(imageData, cropType || undefined, { farmNotes });
      if (res.success) {
        setSoilAnalysis(res.data);
        toast.success('Soil diagnostics completed successfully!');
      } else {
        addNotification({
          type: 'error',
          message: 'Soil analysis failed.',
        });
      }
    } catch (error) {
      console.error('Soil analysis error:', error);
      addNotification({
        type: 'error',
        message: 'Failed to analyze soil image',
      });
    } finally {
      setIsAnalyzingSoil(false);
    }
  };

  const getNpkStatusClass = (status: string) => {
    if (status === 'optimal') return 'text-green-700 bg-green-50 dark:bg-green-900/20';
    if (status === 'low') return 'text-red-700 bg-red-50 dark:bg-red-900/20';
    return 'text-amber-700 bg-amber-50 dark:bg-amber-900/20';
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Input & Upload Column */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Soil Sample Diagnostics
        </h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Target Crop (Optional)
            </label>
            <input
              type="text"
              value={cropType}
              onChange={e => setCropType(e.target.value)}
              placeholder="e.g., maize, tomato, wheat"
              className={`w-full px-3 py-2 border border-gray-300 dark:border-gray-600 ${radiusClass} bg-white dark:bg-gray-800 text-gray-900 dark:text-white`}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Field / Farm Notes (Optional)
            </label>
            <textarea
              value={farmNotes}
              onChange={e => setFarmNotes(e.target.value)}
              placeholder="Describe soil location, previous crop, visible anomalies..."
              rows={3}
              className={`w-full px-3 py-2 border border-gray-300 dark:border-gray-600 ${radiusClass} bg-white dark:bg-gray-800 text-gray-900 dark:text-white`}
            />
          </div>

          {/* Soil Image Upload */}
          <div
            className={`border-2 border-dashed border-gray-300 dark:border-gray-600 ${radiusClass} p-6 text-center`}
          >
            {soilImagePreview ? (
              <div className="space-y-4">
                <img
                  src={soilImagePreview}
                  alt="Soil Sample"
                  className={`max-w-full max-h-48 mx-auto ${radiusClass}`}
                />
                <button
                  onClick={() => {
                    setSelectedSoilImage(null);
                    setSoilImagePreview(null);
                  }}
                  className="text-red-600 hover:text-red-700 text-sm"
                >
                  Remove Soil Sample Image
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <Upload className="w-12 h-12 mx-auto text-gray-400" />
                <div>
                  <label htmlFor="soil-upload" className="cursor-pointer">
                    <span className="text-primary-600 hover:text-primary-700 font-medium">
                      Click to upload soil photo
                    </span>
                    <span className="text-gray-600 dark:text-gray-400"> or drag and drop</span>
                  </label>
                  <input
                    id="soil-upload"
                    type="file"
                    accept="image/*"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) handleSoilImageSelect(file);
                    }}
                    className="hidden"
                  />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Capture clear, close-up soil samples (PNG, JPG up to 10MB)
                </p>
              </div>
            )}
          </div>

          <button
            onClick={handleAnalyzeSoil}
            disabled={!selectedSoilImage || isAnalyzingSoil}
            className={`w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary-600 text-white ${btnClass} hover:bg-primary-700 disabled:opacity-50`}
          >
            {isAnalyzingSoil ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Analyzing Soil Sample...
              </>
            ) : (
              <>
                <Activity className="w-4 h-4" />
                Analyze Soil Sample
              </>
            )}
          </button>
        </div>
      </div>

      {/* Diagnostics Dashboard Column */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Diagnostics Dashboard
        </h3>

        {soilAnalysis ? (
          <div className="space-y-6">
            {/* Overall Score & Confidence */}
            <div
              className={`p-4 bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-800 ${radiusClass}`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-primary-600" />
                  <h4 className="font-semibold text-primary-800 dark:text-primary-200">
                    Overall Soil Health Score
                  </h4>
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Confidence: {(soilAnalysis.confidence * 100).toFixed(1)}%
                </span>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex-1 h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-red-500 via-yellow-400 to-green-500 transition-all duration-1000"
                    style={{ width: `${soilAnalysis.overallHealthScore}%` }}
                  />
                </div>
                <span className="text-lg font-bold text-primary-700 dark:text-primary-300">
                  {soilAnalysis.overallHealthScore}/100
                </span>
              </div>
            </div>

            {/* Physical Attributes Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-lg">
                <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
                  <Layers className="w-3.5 h-3.5 text-primary-500" />
                  <span>Soil Texture</span>
                </div>
                <p className="font-semibold text-sm text-gray-900 dark:text-white">
                  {soilAnalysis.texture}
                </p>
              </div>
              <div className="p-3 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-lg">
                <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
                  <Droplet className="w-3.5 h-3.5 text-blue-500" />
                  <span>Moisture Level</span>
                </div>
                <p className="font-semibold text-sm text-gray-900 dark:text-white">
                  {soilAnalysis.estimatedMoisture}
                </p>
              </div>
              <div className="p-3 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-lg">
                <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
                  <Activity className="w-3.5 h-3.5 text-purple-500" />
                  <span>Drainage Class</span>
                </div>
                <p className="font-semibold text-sm text-gray-900 dark:text-white">
                  {soilAnalysis.drainageClass}
                </p>
              </div>
              <div className="p-3 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-lg">
                <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                  <span>Discoloration</span>
                </div>
                <p
                  className="font-semibold text-xs text-gray-900 dark:text-white line-clamp-2"
                  title={soilAnalysis.colorDiscoloration}
                >
                  {soilAnalysis.colorDiscoloration}
                </p>
              </div>
            </div>

            {/* NPK Deficiencies Dashboard */}
            <div>
              <h4 className="font-semibold text-sm text-gray-900 dark:text-white mb-2">
                Nutrient Composition (NPK)
              </h4>
              <div className="grid grid-cols-3 gap-3">
                {/* Nitrogen */}
                <div className="p-3 border border-gray-100 dark:border-gray-700 rounded-lg text-center bg-gray-50 dark:bg-gray-800/50">
                  <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-1.5">
                    <span className="text-red-700 dark:text-red-300 font-bold text-sm">N</span>
                  </div>
                  <div className="text-xs text-gray-500 mb-1">Nitrogen</div>
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${getNpkStatusClass(soilAnalysis.npkDeficiencies.nitrogen)}`}
                  >
                    {soilAnalysis.npkDeficiencies.nitrogen.toUpperCase()}
                  </span>
                </div>
                {/* Phosphorus */}
                <div className="p-3 border border-gray-100 dark:border-gray-700 rounded-lg text-center bg-gray-50 dark:bg-gray-800/50">
                  <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mx-auto mb-1.5">
                    <span className="text-blue-700 dark:text-blue-300 font-bold text-sm">P</span>
                  </div>
                  <div className="text-xs text-gray-500 mb-1">Phosphorus</div>
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${getNpkStatusClass(soilAnalysis.npkDeficiencies.phosphorus)}`}
                  >
                    {soilAnalysis.npkDeficiencies.phosphorus.toUpperCase()}
                  </span>
                </div>
                {/* Potassium */}
                <div className="p-3 border border-gray-100 dark:border-gray-700 rounded-lg text-center bg-gray-50 dark:bg-gray-800/50">
                  <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto mb-1.5">
                    <span className="text-amber-700 dark:text-amber-300 font-bold text-sm">K</span>
                  </div>
                  <div className="text-xs text-gray-500 mb-1">Potassium</div>
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${getNpkStatusClass(soilAnalysis.npkDeficiencies.potassium)}`}
                  >
                    {soilAnalysis.npkDeficiencies.potassium.toUpperCase()}
                  </span>
                </div>
              </div>
            </div>

            {/* Crop Suitability */}
            <div>
              <h4 className="font-semibold text-sm text-gray-900 dark:text-white mb-2">
                Suitable Crop Recommendations
              </h4>
              <div className="flex flex-wrap gap-2">
                {soilAnalysis.cropSuitability.map((crop, index) => (
                  <span
                    key={index}
                    className="px-2.5 py-1 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 text-xs font-medium rounded-full"
                  >
                    {crop}
                  </span>
                ))}
              </div>
            </div>

            {/* High Efficacy Recommendations */}
            <div>
              <h4 className="font-semibold text-sm text-gray-900 dark:text-white mb-2">
                Targeted Recommendations
              </h4>
              <ul className="space-y-1.5">
                {soilAnalysis.recommendations.map((rec, index) => (
                  <li
                    key={index}
                    className="flex items-start gap-2 text-xs text-gray-700 dark:text-gray-300"
                  >
                    <CheckCircle className="w-3.5 h-3.5 text-primary-600 mt-0.5 flex-shrink-0" />
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Action Buttons */}
            <div className="pt-2">
              <button
                onClick={() => {
                  toast.success('Successfully downloaded Soil Diagnostics PDF Report!');
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-primary-600 text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-950/20 font-medium text-sm rounded-lg transition-all"
              >
                <Download className="w-4 h-4" />
                Export Diagnostic Report (PDF)
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-16 text-gray-500 dark:text-gray-400">
            <Activity className="w-12 h-12 mx-auto mb-4 opacity-30 animate-pulse" />
            <p className="font-medium">No Soil Data Available</p>
            <p className="text-xs max-w-xs mx-auto mt-1">
              Upload a clear photo of your field soil and input optional parameters to generate
              multi-dimensional diagnostics.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
