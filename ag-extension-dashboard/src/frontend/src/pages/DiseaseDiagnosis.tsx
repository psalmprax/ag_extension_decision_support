import React, { useState, useEffect } from 'react';
import {
  Activity,
  Camera,
  Layers,
  Search,
  Radio,
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
      <div className="space-y-8">
        {/* Header & Status Ribbons */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-xs font-mono font-bold uppercase tracking-widest text-emerald-400">
                AI Vision & Plant Pathology
              </span>
            </div>
            <h1 className={`text-3xl font-extrabold text-white tracking-tight ${headingClass}`}>
              Disease Checker
            </h1>
            <p className="text-white/60 text-sm mt-1">
              {t('disease_diagnosis_subtitle') ||
                'On-device leaf vision diagnosis, symptom inference, and localized bio-remedies.'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full backdrop-blur-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono">
              <Radio className="w-3.5 h-3.5" />
              <span>EDGE VISION READY</span>
            </span>
          </div>
        </div>

        {/* Diagnostic Tabs (KnockKnock Glassmorphic Bar) */}
        <div className="p-1.5 rounded-2xl backdrop-blur-xl bg-slate-900/70 border border-white/[0.08]">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5">
            {[
              { id: 'image', label: 'Image Analysis', icon: Camera },
              { id: 'symptoms', label: 'Symptom Diagnosis', icon: Activity },
              { id: 'soil', label: 'Soil Diagnostics', icon: Layers },
              { id: 'library', label: 'Disease Library', icon: Search },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as 'symptoms' | 'image' | 'soil' | 'library')}
                className={`py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                  activeTab === tab.id
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-lg shadow-emerald-950/20'
                    : 'text-white/50 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="backdrop-blur-xl bg-slate-900/60 border border-white/[0.08] rounded-3xl p-6 sm:p-8 shadow-2xl shadow-emerald-950/20">
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
      </div>
    </PlanUpgradeGuard>
  );
}

export default DiseaseDiagnosis;
