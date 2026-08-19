import React, { useState, useEffect } from 'react';
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
  const [activeTab, setActiveTab] = useState<'symptoms' | 'image' | 'soil' | 'library'>('symptoms');
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
        return 'text-green-600 bg-green-50 dark:bg-green-900/20';
      case 'moderate':
        return 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20';
      case 'severe':
        return 'text-red-600 bg-red-50 dark:bg-red-900/20';
      default:
        return 'text-gray-600 bg-gray-50 dark:bg-gray-900/20';
    }
  };

  return (
    <PlanUpgradeGuard category="vision" featureName="Disease Checker">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className={`text-2xl ${headingClass}`}>Disease Checker</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              {t('disease_diagnosis_subtitle')}
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="card p-1">
          <div className="flex space-x-1">
            <button
              onClick={() => setActiveTab('symptoms')}
              className={`flex-1 py-2 px-4 ${radiusClass} font-medium text-sm transition-all ${
                activeTab === 'symptoms'
                  ? 'bg-primary-600 text-white shadow-lg'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              Symptom Diagnosis
            </button>
            <button
              onClick={() => setActiveTab('image')}
              className={`flex-1 py-2 px-4 ${radiusClass} font-medium text-sm transition-all ${
                activeTab === 'image'
                  ? 'bg-primary-600 text-white shadow-lg'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              Image Analysis
            </button>
            <button
              onClick={() => setActiveTab('soil')}
              className={`flex-1 py-2 px-4 ${radiusClass} font-medium text-sm transition-all ${
                activeTab === 'soil'
                  ? 'bg-primary-600 text-white shadow-lg'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              Soil Diagnostics
            </button>
            <button
              onClick={() => setActiveTab('library')}
              className={`flex-1 py-2 px-4 ${radiusClass} font-medium text-sm transition-all ${
                activeTab === 'library'
                  ? 'bg-primary-600 text-white shadow-lg'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              Disease Library
            </button>
          </div>
        </div>

        {/* Tab Content */}
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
