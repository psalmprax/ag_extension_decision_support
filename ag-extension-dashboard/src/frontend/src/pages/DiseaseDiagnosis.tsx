import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '../lib/LanguageContext';
import { useThemeClasses } from '@/hooks/useThemeClasses';
import { useAppStore } from '../store/useAppStore';
import { SymptomDiagnosisTab } from './DiseaseDiagnosis/SymptomDiagnosisTab';
import { ImageAnalysisTab } from './DiseaseDiagnosis/ImageAnalysisTab';
import { SoilDiagnosticsTab } from './DiseaseDiagnosis/SoilDiagnosticsTab';
import { DiseaseInfoModal } from './DiseaseDiagnosis/DiseaseInfoModal';

type Tab = 'symptoms' | 'image' | 'soil';

const TABS: { key: Tab; label: string }[] = [
    { key: 'symptoms', label: 'Symptom Diagnosis' },
    { key: 'image', label: 'Image Analysis' },
    { key: 'soil', label: 'Soil Diagnostics' },
];

export function DiseaseDiagnosis() {
    const { t } = useLanguage();
    const { headingClass, isModern, radiusClass, btnClass } = useThemeClasses();
    const { addNotification } = useAppStore();

    const [activeTab, setActiveTab] = useState<Tab>('symptoms');
    const [cropType, setCropType] = useState('');
    const [selectedDisease, setSelectedDisease] = useState<string | null>(null);

    const tabProps = { cropType, setCropType, radiusClass, btnClass, t, addNotification };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className={`text-2xl ${headingClass}`}>{isModern ? 'Pathological Diagnostics' : 'Disease Checker'}</h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">{t('disease_diagnosis_subtitle')}</p>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="card p-1">
                <div className="flex space-x-1">
                    {TABS.map(({ key, label }) => (
                        <button key={key} onClick={() => setActiveTab(key)}
                            className={`flex-1 py-2 px-4 ${radiusClass} font-medium text-sm transition-all ${
                                activeTab === key
                                    ? 'bg-primary-600 text-white shadow-lg'
                                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                            }`}>
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Tab Content */}
            <AnimatePresence mode="wait">
                <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
                    {activeTab === 'symptoms' && <SymptomDiagnosisTab {...tabProps} onViewDiseaseInfo={setSelectedDisease} />}
                    {activeTab === 'image' && <ImageAnalysisTab {...tabProps} />}
                    {activeTab === 'soil' && <SoilDiagnosticsTab {...tabProps} />}
                </motion.div>
            </AnimatePresence>

            {/* Disease Info Modal */}
            {selectedDisease && (
                <DiseaseInfoModal diseaseName={selectedDisease} radiusClass={radiusClass} onClose={() => setSelectedDisease(null)} />
            )}
        </div>
    );
}

export default DiseaseDiagnosis;
