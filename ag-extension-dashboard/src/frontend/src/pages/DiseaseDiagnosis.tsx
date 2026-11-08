import React, { useState, useEffect } from 'react';
import {
  Activity,
  Camera,
  Layers,
  Search,
  Radio,
  Video,
} from 'lucide-react';
import { useLanguage } from '../lib/LanguageContext';
import { useThemeClasses } from '@/hooks/useThemeClasses';
import { useAppStore } from '../store/useAppStore';
import { getDiseaseInfo, getAllDiseases, type DiseaseInfo } from '../api/diseaseService';

// Import sub-components
import { SymptomDiagnosisTab } from './diagnostics/SymptomDiagnosisTab';
import { ImageAnalysisTab } from './diagnostics/ImageAnalysisTab';
import { SoilDiagnosticsTab } from './diagnostics/SoilDiagnosticsTab';
import { DiseaseLibraryTab } from './diagnostics/DiseaseLibraryTab';
import { DiseaseInfoModal } from './diagnostics/DiseaseInfoModal';
import { EdgeVisionScannerModal } from '@/components/EdgeVisionScannerModal';
import { VideoAnalysisTab } from './diagnostics/VideoAnalysisTab';

export function DiseaseDiagnosis() {
  const { t } = useLanguage();
  const { headingClass, radiusClass, btnClass } = useThemeClasses();
  const { addNotification } = useAppStore();

  // Shared State
  const [activeTab, setActiveTab] = useState<'symptoms' | 'image' | 'video' | 'soil' | 'library'>('image');
  const [cropType, setCropType] = useState('');

  // Disease Library State
  const [allDiseases, setAllDiseases] = useState<string[]>([]);

  // Modal State
  const [selectedDisease, setSelectedDisease] = useState<string | null>(null);
  const [diseaseInfo, setDiseaseInfo] = useState<DiseaseInfo | null>(null);
  const [isLoadingInfo, setIsLoadingInfo] = useState(false);
  const [showScannerModal, setShowScannerModal] = useState(false);

  // Load available diseases
  useEffect(() => {
    const loadDiseases = async () => {
      try {
        const res = await getAllDiseases();
        if (res.success) {
          setAllDiseases(res.data);
        }
      } catch (error) {
        console.error('Failed to load diseases:', error);
      }
    };
    loadDiseases();
  }, []);

  const handleViewDiseaseInfo = async (diseaseName: string) => {
    setSelectedDisease(diseaseName);
    setIsLoadingInfo(true);
    try {
      const res = await getDiseaseInfo(diseaseName);
      if (res.success) {
        setDiseaseInfo(res.data);
      }
    } catch (error) {
      console.error('Failed to load disease info:', error);
    } finally {
      setIsLoadingInfo(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'mild':
        return 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/30';
      case 'moderate':
        return 'text-amber-400 bg-amber-500/10 border border-amber-500/30';
      case 'severe':
        return 'text-rose-400 bg-rose-500/10 border border-rose-500/30';
      default:
        return 'text-sky-400 bg-sky-500/10 border border-sky-500/30';
    }
  };

  return (
    <div className="space-y-6">
        {/* Header & Live Status Telemetry Bar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-5 rounded-2xl bg-white/95 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 backdrop-blur-2xl shadow-sm dark:shadow-xl">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 dark:border-emerald-500/30 text-xs font-medium">
                <Radio className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                Crop Doctor &amp; Pathology
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Image, video and symptom assessment
              </span>
            </div>
            <h1 className={`text-2xl font-semibold text-slate-900 dark:text-white tracking-tight ${headingClass}`}>
              Crop Doctor &amp; Plant Pathology Clinic
            </h1>
            <p className="text-slate-600 dark:text-slate-400 text-xs mt-1">
              Upload a photo or video, or describe symptoms. Results require expert confirmation.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowScannerModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium shadow-sm transition-colors cursor-pointer"
            >
              <Camera className="w-4 h-4" />
              <span>Camera Scan Leaf</span>
            </button>
            <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 text-xs font-medium">
              <span>Analysis requires connectivity</span>
            </span>
          </div>
        </div>

        {/* Diagnostic Tabs */}
        <div className="p-1 rounded-lg bg-slate-100 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800/80 backdrop-blur-2xl shadow-sm dark:shadow-lg">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-1">
            {[
              { id: 'image', label: 'Leaf Image Analysis', icon: Camera, badge: 'Vision' },
              { id: 'video', label: 'Video Observations', icon: Video, badge: 'Vision' },
              { id: 'symptoms', label: 'Symptom Inference', icon: Activity, badge: 'Heuristic' },
              { id: 'soil', label: 'Soil Diagnostics', icon: Layers, badge: 'Chemistry' },
              { id: 'library', label: 'Pathology Library', icon: Search, badge: 'Reference' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as 'symptoms' | 'image' | 'video' | 'soil' | 'library')}
                className={`py-2.5 px-3 rounded-md font-medium text-xs flex flex-col sm:flex-row items-center justify-center gap-1.5 transition-colors ${
                  activeTab === tab.id
                    ? 'bg-white dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-slate-200 dark:border-emerald-500/40 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-900'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <tab.icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </div>
                <span className="text-[10px] font-mono text-slate-500 px-1.5 py-0.5 rounded bg-slate-200/80 dark:bg-slate-900 border border-slate-300/60 dark:border-white/5">
                  {tab.badge}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content Container */}
        <div className="backdrop-blur-2xl bg-white/95 dark:bg-slate-950/90 border border-slate-200 dark:border-slate-800/80 rounded-[4px] p-5 sm:p-6 shadow-sm dark:shadow-2xl text-slate-800 dark:text-slate-100">
          {activeTab === 'symptoms' && (
            <SymptomDiagnosisTab
              cropType={cropType}
              setCropType={setCropType}
              radiusClass={radiusClass}
              btnClass={btnClass}
              t={t}
              addNotification={
                addNotification as unknown as (n: { type: string; message: string }) => void
              }
              onViewDiseaseInfo={handleViewDiseaseInfo}
              getSeverityColor={getSeverityColor}
            />
          )}

          {activeTab === 'image' && (
            <ImageAnalysisTab
              cropType={cropType}
              setCropType={setCropType}
              radiusClass={radiusClass}
              btnClass={btnClass}
              t={t}
              addNotification={
                addNotification as unknown as (n: { type: string; message: string }) => void
              }
              getSeverityColor={getSeverityColor}
            />
          )}

          {activeTab === 'video' && <VideoAnalysisTab />}

          {activeTab === 'soil' && (
            <SoilDiagnosticsTab
              cropType={cropType}
              setCropType={setCropType}
              radiusClass={radiusClass}
              btnClass={btnClass}
              addNotification={
                addNotification as unknown as (n: { type: string; message: string }) => void
              }
            />
          )}

          {activeTab === 'library' && (
            <DiseaseLibraryTab
              allDiseases={allDiseases}
              radiusClass={radiusClass}
              onViewDiseaseInfo={handleViewDiseaseInfo}
            />
          )}
        </div>

        {/* Disease Info Modal */}
        <DiseaseInfoModal
          selectedDisease={selectedDisease}
          setSelectedDisease={setSelectedDisease}
          isLoadingInfo={isLoadingInfo}
          diseaseInfo={diseaseInfo}
          radiusClass={radiusClass}
        />

        {/* Offline Edge Camera Scanner Modal */}
        <EdgeVisionScannerModal
          isOpen={showScannerModal}
          onClose={() => setShowScannerModal(false)}
          defaultCrop={cropType || 'Maize'}
        />
      </div>
  );
}

export default DiseaseDiagnosis;
