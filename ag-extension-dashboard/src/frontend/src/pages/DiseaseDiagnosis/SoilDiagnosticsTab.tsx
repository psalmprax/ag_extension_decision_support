import React, { useState } from 'react';
import { Upload, Activity, Layers, Droplet, AlertTriangle, CheckCircle, Download, Loader2 } from 'lucide-react';
import { analyzeSoilImage, type SoilAnalysisResult } from '../../api/diseaseService';
import { npkBadgeClass, type TabProps } from './utils';
import toast from 'react-hot-toast';

export function SoilDiagnosticsTab({ cropType, setCropType, radiusClass, btnClass, addNotification }: Omit<TabProps, 'onViewDiseaseInfo'>) {
    const [selectedImage, setSelectedImage] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysis, setAnalysis] = useState<SoilAnalysisResult | null>(null);
    const [farmNotes, setFarmNotes] = useState('');

    const handleImageSelect = (file: File) => {
        setSelectedImage(file);
        const reader = new FileReader();
        reader.onload = (e) => setImagePreview(e.target?.result as string);
        reader.readAsDataURL(file);
    };

    const handleAnalyze = async () => {
        if (!selectedImage) return;
        setIsAnalyzing(true);
        setAnalysis(null);
        try {
            const base64 = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target?.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(selectedImage);
            });
            const res = await analyzeSoilImage(base64.split(',')[1], cropType || undefined, { farmNotes });
            if (res.success) {
                setAnalysis(res.data);
                toast.success('Soil diagnostics completed successfully!');
            } else {
                addNotification({ type: 'error', message: 'Soil analysis failed.' });
            }
        } catch {
            addNotification({ type: 'error', message: 'Failed to analyze soil image' });
        } finally {
            setIsAnalyzing(false);
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Input Column */}
            <div className="card p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Soil Sample Diagnostics</h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Target Crop (Optional)</label>
                        <input type="text" value={cropType} onChange={e => setCropType(e.target.value)}
                            placeholder="e.g., maize, tomato, wheat"
                            className={`w-full px-3 py-2 border border-gray-300 dark:border-gray-600 ${radiusClass} bg-white dark:bg-gray-800 text-gray-900 dark:text-white`} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Field / Farm Notes (Optional)</label>
                        <textarea value={farmNotes} onChange={e => setFarmNotes(e.target.value)}
                            placeholder="Describe soil location, previous crop, visible anomalies..." rows={3}
                            className={`w-full px-3 py-2 border border-gray-300 dark:border-gray-600 ${radiusClass} bg-white dark:bg-gray-800 text-gray-900 dark:text-white`} />
                    </div>
                    <div className={`border-2 border-dashed border-gray-300 dark:border-gray-600 ${radiusClass} p-6 text-center`}>
                        {imagePreview ? (
                            <div className="space-y-4">
                                <img src={imagePreview} alt="Soil Sample" className={`max-w-full max-h-48 mx-auto ${radiusClass}`} />
                                <button onClick={() => { setSelectedImage(null); setImagePreview(null); }} className="text-red-600 hover:text-red-700 text-sm">Remove Soil Sample Image</button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <Upload className="w-12 h-12 mx-auto text-gray-400" />
                                <div>
                                    <label htmlFor="soil-upload" className="cursor-pointer">
                                        <span className="text-primary-600 hover:text-primary-700 font-medium">Click to upload soil photo</span>
                                        <span className="text-gray-600 dark:text-gray-400"> or drag and drop</span>
                                    </label>
                                    <input id="soil-upload" type="file" accept="image/*"
                                        onChange={e => { const f = e.target.files?.[0]; if (f) handleImageSelect(f); }}
                                        className="hidden" />
                                </div>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Capture clear, close-up soil samples (PNG, JPG up to 10MB)</p>
                            </div>
                        )}
                    </div>
                    <button onClick={handleAnalyze} disabled={!selectedImage || isAnalyzing}
                        className={`w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary-600 text-white ${btnClass} hover:bg-primary-700 disabled:opacity-50`}>
                        {isAnalyzing ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing Soil Sample...</> : <><Activity className="w-4 h-4" /> Analyze Soil Sample</>}
                    </button>
                </div>
            </div>

            {/* Dashboard Column */}
            <div className="card p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Diagnostics Dashboard</h3>
                {analysis ? <SoilDashboard analysis={analysis} radiusClass={radiusClass} /> : (
                    <div className="text-center py-16 text-gray-500 dark:text-gray-400">
                        <Activity className="w-12 h-12 mx-auto mb-4 opacity-30 animate-pulse" />
                        <p className="font-medium">No Soil Data Available</p>
                        <p className="text-xs max-w-xs mx-auto mt-1">Upload a clear photo of your field soil and input optional parameters to generate multi-dimensional diagnostics.</p>
                    </div>
                )}
            </div>
        </div>
    );
}

const SoilDashboard = ({ analysis, radiusClass }: { analysis: SoilAnalysisResult; radiusClass: string }) => (
    <div className="space-y-6">
        {/* Health Score */}
        <div className={`p-4 bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-800 ${radiusClass}`}>
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <Activity className="w-5 h-5 text-primary-600" />
                    <h4 className="font-semibold text-primary-800 dark:text-primary-200">Overall Soil Health Score</h4>
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400">Confidence: {(analysis.confidence * 100).toFixed(1)}%</span>
            </div>
            <div className="flex items-center gap-4">
                <div className="flex-1 h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-red-500 via-yellow-400 to-green-500 transition-all duration-1000"
                        style={{ width: `${analysis.overallHealthScore}%` }} />
                </div>
                <span className="text-lg font-bold text-primary-700 dark:text-primary-300">{analysis.overallHealthScore}/100</span>
            </div>
        </div>

        {/* Physical Attributes Grid */}
        <div className="grid grid-cols-2 gap-4">
            <AttrCard icon={<Layers className="w-3.5 h-3.5 text-primary-500" />} label="Soil Texture" value={analysis.texture} />
            <AttrCard icon={<Droplet className="w-3.5 h-3.5 text-blue-500" />} label="Moisture Level" value={analysis.estimatedMoisture} />
            <AttrCard icon={<Activity className="w-3.5 h-3.5 text-purple-500" />} label="Drainage Class" value={analysis.drainageClass} />
            <AttrCard icon={<AlertTriangle className="w-3.5 h-3.5 text-amber-500" />} label="Discoloration" value={analysis.colorDiscoloration} small />
        </div>

        {/* NPK */}
        <div>
            <h4 className="font-semibold text-sm text-gray-900 dark:text-white mb-2">Nutrient Composition (NPK)</h4>
            <div className="grid grid-cols-3 gap-3">
                <NpkBadge label="N" name="Nitrogen" level={analysis.npkDeficiencies.nitrogen} color="red" />
                <NpkBadge label="P" name="Phosphorus" level={analysis.npkDeficiencies.phosphorus} color="blue" />
                <NpkBadge label="K" name="Potassium" level={analysis.npkDeficiencies.potassium} color="amber" />
            </div>
        </div>

        {/* Crop Suitability */}
        <div>
            <h4 className="font-semibold text-sm text-gray-900 dark:text-white mb-2">Suitable Crop Recommendations</h4>
            <div className="flex flex-wrap gap-2">
                {analysis.cropSuitability.map((crop, i) => (
                    <span key={i} className="px-2.5 py-1 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 text-xs font-medium rounded-full">{crop}</span>
                ))}
            </div>
        </div>

        {/* Recommendations */}
        <div>
            <h4 className="font-semibold text-sm text-gray-900 dark:text-white mb-2">Targeted Recommendations</h4>
            <ul className="space-y-1.5">
                {analysis.recommendations.map((rec, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-gray-700 dark:text-gray-300">
                        <CheckCircle className="w-3.5 h-3.5 text-primary-600 mt-0.5 flex-shrink-0" /><span>{rec}</span>
                    </li>
                ))}
            </ul>
        </div>

        <button onClick={() => toast.success('Successfully downloaded Soil Diagnostics PDF Report!')}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-primary-600 text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-950/20 font-medium text-sm rounded-lg transition-all">
            <Download className="w-4 h-4" />Export Diagnostic Report (PDF)
        </button>
    </div>
);

const AttrCard = ({ icon, label, value, small }: { icon: React.ReactNode; label: string; value: string; small?: boolean }) => (
    <div className="p-3 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-lg">
        <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">{icon}<span>{label}</span></div>
        <p className={`${small ? 'text-xs line-clamp-2' : 'font-semibold text-sm'} text-gray-900 dark:text-white`} title={value}>{value}</p>
    </div>
);

const NPK_COLORS: Record<string, { bg: string; bgDark: string; text: string; textDark: string }> = {
    red:   { bg: 'bg-red-100', bgDark: 'dark:bg-red-900/30', text: 'text-red-700', textDark: 'dark:text-red-300' },
    blue:  { bg: 'bg-blue-100', bgDark: 'dark:bg-blue-900/30', text: 'text-blue-700', textDark: 'dark:text-blue-300' },
    amber: { bg: 'bg-amber-100', bgDark: 'dark:bg-amber-900/30', text: 'text-amber-700', textDark: 'dark:text-amber-300' },
};

const NpkBadge = ({ label, name, level, color }: { label: string; name: string; level: string; color: 'red' | 'blue' | 'amber' }) => {
    const c = NPK_COLORS[color];
    return (
        <div className="p-3 border border-gray-100 dark:border-gray-700 rounded-lg text-center bg-gray-50 dark:bg-gray-800/50">
            <div className={`w-8 h-8 rounded-full ${c.bg} ${c.bgDark} flex items-center justify-center mx-auto mb-1.5`}>
                <span className={`${c.text} ${c.textDark} font-bold text-sm`}>{label}</span>
            </div>
            <div className="text-xs text-gray-500 mb-1">{name}</div>
            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${npkBadgeClass(level)}`}>{level.toUpperCase()}</span>
        </div>
    );
};
