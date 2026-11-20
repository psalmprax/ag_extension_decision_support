import React, { useState, useEffect } from 'react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import {
  Activity,
  Camera,
  Layers,
  Search,
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
import { DiagnosisHistoryPanel } from './diagnostics/DiagnosisHistoryPanel';
import { PageHeader } from '@/components/ui/PageHeader';
import { PRIMARY_BUTTON, tabButtonClass } from '@/components/ui/controlStyles';

export function DiseaseDiagnosis() {
  const online = useOnlineStatus();
  const { t } = useLanguage();
  const { radiusClass, btnClass } = useThemeClasses();
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
        return 'text-slate-400 bg-slate-500/10 border border-slate-500/30';
    }
  };

  return (
    <div className="space-y-6">
        <PageHeader
          title={t('ui_disease_diagnosis_crop_doctor_plant_pathology_clinic')}
          description={t('ui_disease_diagnosis_upload_a_photo_or_video_or_describe')}
          meta={
            <span role="status" className="inline-flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${online ? 'bg-emerald-600' : 'bg-amber-500'}`} aria-hidden="true" />
              {online
                ? t('diagnosis_online', { defaultValue: 'Online: analysis available' })
                : t('diagnosis_offline', { defaultValue: 'Offline: analysis needs a connection' })}
            </span>
          }
          actions={
            <button onClick={() => setShowScannerModal(true)} className={PRIMARY_BUTTON}>
              <Camera className="w-4 h-4" aria-hidden="true" />
              <span>{t('ui_disease_diagnosis_camera_scan_leaf')}</span>
            </button>
          }
        />

        {/* Diagnostic tabs */}
        <div className="flex items-center gap-1 overflow-x-auto" role="tablist">
          {[
            { id: 'image', label: t('diagnosis_tab_photo', { defaultValue: 'Leaf photo' }), icon: Camera },
            { id: 'video', label: t('diagnosis_tab_video', { defaultValue: 'Video' }), icon: Video },
            { id: 'symptoms', label: t('diagnosis_tab_symptoms', { defaultValue: 'Describe symptoms' }), icon: Activity },
            { id: 'soil', label: t('diagnosis_tab_soil', { defaultValue: 'Soil' }), icon: Layers },
            { id: 'library', label: t('diagnosis_tab_library', { defaultValue: 'Disease library' }), icon: Search },
          ].map(tab => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id as 'symptoms' | 'image' | 'video' | 'soil' | 'library')}
              className={tabButtonClass(activeTab === tab.id)}
            >
              <tab.icon className="w-4 h-4" aria-hidden="true" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab Content Container */}
        <div className="bg-white dark:bg-white/[0.03] border border-slate-900/[0.08] dark:border-white/[0.08] rounded-lg p-5 sm:p-6 text-slate-800 dark:text-slate-100">
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

        {/* Everything the signed-in account has concluded so far */}
        <DiagnosisHistoryPanel />

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
