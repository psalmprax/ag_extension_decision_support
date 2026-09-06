import React, { useState, useEffect } from 'react';
import {
  Activity,
  Camera,
  Layers,
  Search,
  Radio,
  Sparkles,
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

import { PlanUpgradeGuard } from '@/components/PlanUpgradeGuard';

export function DiseaseDiagnosis() {
  const { t } = useLanguage();
  const { headingClass, radiusClass, btnClass } = useThemeClasses();
  const { addNotification } = useAppStore();

  // Shared State
  const [activeTab, setActiveTab] = useState<'symptoms' | 'image' | 'soil' | 'library'>('image');
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
    <PlanUpgradeGuard category="vision" featureName="Disease Checker">
      <div className="space-y-6">
        {/* Header & Live Status Telemetry Bar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-5 rounded-[4px] bg-slate-950/80 border border-emerald-500/20 backdrop-blur-2xl shadow-xl shadow-emerald-950/30">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-[3px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-mono font-black uppercase tracking-wider">
                <Radio className="w-3 h-3 animate-pulse text-emerald-400" />
                NEURAL PATHOLOGY HUD
              </span>
              <span className="text-[11px] font-mono text-slate-400">
                EDGE VISION + MULTIMODAL LLM
              </span>
            </div>
            <h1 className={`text-2xl font-black text-white tracking-tight uppercase ${headingClass}`}>
              Crop & Soil Pathology Suite
            </h1>
            <p className="text-slate-400 text-xs mt-1">
              {t('disease_diagnosis_subtitle') ||
                'On-device leaf vision diagnosis, symptom inference, and localized bio-remedies.'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowScannerModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white text-xs font-mono font-bold shadow-md shadow-emerald-950/40 transition-all cursor-pointer"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>OFFLINE CAMERA SCANNER</span>
            </button>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] bg-slate-900 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-bold shadow-md shadow-emerald-950/40">
              <Sparkles className="w-3.5 h-3.5" />
              <span>OFFLINE READY</span>
            </span>
          </div>
        </div>

        {/* Diagnostic Tabs (KnockKnock 4px Precision Bar) */}
        <div className="p-1 rounded-[4px] bg-slate-950/80 border border-slate-800/80 backdrop-blur-2xl shadow-lg">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-1">
            {[
              { id: 'image', label: 'Leaf Image Analysis', icon: Camera, badge: 'VISION' },
              { id: 'symptoms', label: 'Symptom Inference', icon: Activity, badge: 'EXPERT' },
              { id: 'soil', label: 'Soil Diagnostics', icon: Layers, badge: 'CHEMISTRY' },
              { id: 'library', label: 'Pathology Library', icon: Search, badge: 'FAO DB' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as 'symptoms' | 'image' | 'soil' | 'library')}
                className={`py-2.5 px-3 rounded-[3px] font-bold text-xs flex flex-col sm:flex-row items-center justify-center gap-1.5 transition-all ${
                  activeTab === tab.id
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-md shadow-emerald-950/40'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <tab.icon className="w-3.5 h-3.5" />
                  <span className="uppercase tracking-wider">{tab.label}</span>
                </div>
                <span className="text-[8px] font-mono font-black text-slate-500 uppercase tracking-widest px-1 py-0.2 rounded bg-slate-950/60 border border-white/5">
                  {tab.badge}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content Container */}
        <div className="backdrop-blur-2xl bg-slate-950/90 border border-slate-800/80 rounded-[4px] p-5 sm:p-6 shadow-2xl shadow-emerald-950/30 text-slate-100">
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
    </PlanUpgradeGuard>
  );
}

export default DiseaseDiagnosis;
