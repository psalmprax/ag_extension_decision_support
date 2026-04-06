import React, { useState, useEffect } from 'react';
import {
    Search, Upload, Camera, Leaf, AlertTriangle,
    CheckCircle, XCircle, Loader2, RefreshCw,
    FileImage, Eye, Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '../lib/LanguageContext';
import { useAppStore } from '../store/useAppStore';
import {
    diagnoseFromSymptoms,
    getDiseaseInfo,
    getAllDiseases,
    analyzePlantImage,
    type DiseaseDiagnosis,
    type DiseaseInfo
} from '../api/diseaseService';
import toast from 'react-hot-toast';

export function DiseaseDiagnosis() {
    const { t } = useLanguage();
    const { addNotification } = useAppStore();

    // State
    const [activeTab, setActiveTab] = useState<'symptoms' | 'image'>('symptoms');
    const [symptoms, setSymptoms] = useState<string[]>([]);
    const [currentSymptom, setCurrentSymptom] = useState('');
    const [cropType, setCropType] = useState('');
    const [isDiagnosing, setIsDiagnosing] = useState(false);
    const [diagnosis, setDiagnosis] = useState<DiseaseDiagnosis[]>([]);
    const [allDiseases, setAllDiseases] = useState<string[]>([]);
    const [selectedDisease, setSelectedDisease] = useState<string | null>(null);
    const [diseaseInfo, setDiseaseInfo] = useState<DiseaseInfo | null>(null);
    const [isLoadingInfo, setIsLoadingInfo] = useState(false);

    // Image analysis state
    const [selectedImage, setSelectedImage] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
    const [imageAnalysis, setImageAnalysis] = useState<{
        overallHealth: string;
        diseases: DiseaseDiagnosis[];
        recommendations: string[];
    } | null>(null);

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

    const handleAddSymptom = () => {
        if (currentSymptom.trim() && !symptoms.includes(currentSymptom.trim())) {
            setSymptoms([...symptoms, currentSymptom.trim()]);
            setCurrentSymptom('');
        }
    };

    const handleRemoveSymptom = (symptom: string) => {
        setSymptoms(symptoms.filter(s => s !== symptom));
    };

    const handleDiagnose = async () => {
        if (symptoms.length === 0) return;

        setIsDiagnosing(true);
        setDiagnosis([]);
        try {
            const res = await diagnoseFromSymptoms(symptoms, cropType || undefined);
            if (res.success) {
                setDiagnosis(res.data);
            } else {
            addNotification({
                type: 'error',
                message: t('disease_diagnosis_failed_load')
            });
            }
        } catch (error) {
            console.error('Diagnosis error:', error);
                addNotification({
                    type: 'error',
                    message: t('disease_diagnosis_failed_diagnose')
                });
        } finally {
            setIsDiagnosing(false);
        }
    };

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

    const handleImageSelect = (file: File) => {
        setSelectedImage(file);
        const reader = new FileReader();
        reader.onload = (e) => {
            setImagePreview(e.target?.result as string);
        };
        reader.readAsDataURL(file);
    };

    const handleAnalyzeImage = async () => {
        if (!selectedImage) return;

        setIsAnalyzingImage(true);
        setImageAnalysis(null);
        try {
            // Convert file to base64
            const reader = new FileReader();
            reader.onload = async (e) => {
                const base64 = e.target?.result as string;
                const imageData = base64.split(',')[1]; // Remove data:image/jpeg;base64, prefix

                const res = await analyzePlantImage(imageData, cropType || undefined);
                if (res.success) {
                    setImageAnalysis(res.data);
                } else {
                    addNotification({
                        type: 'error',
                        message: t('disease_diagnosis_failed_analyze')
                    });
                }
            };
            reader.readAsDataURL(selectedImage);
        } catch (error) {
            console.error('Image analysis error:', error);
            addNotification({
                type: 'error',
                message: 'Failed to analyze image'
            });
        } finally {
            setIsAnalyzingImage(false);
        }
    };

    const getSeverityColor = (severity: string) => {
        switch (severity.toLowerCase()) {
            case 'mild': return 'text-green-600 bg-green-50 dark:bg-green-900/20';
            case 'moderate': return 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20';
            case 'severe': return 'text-red-600 bg-red-50 dark:bg-red-900/20';
            default: return 'text-gray-600 bg-gray-50 dark:bg-gray-900/20';
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('disease_diagnosis_title')}</h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">{t('disease_diagnosis_subtitle')}</p>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="card p-1">
                <div className="flex space-x-1">
                    <button
                        onClick={() => setActiveTab('symptoms')}
                        className={`flex-1 py-2 px-4 rounded-lg font-medium text-sm transition-all ${
                            activeTab === 'symptoms'
                                ? 'bg-primary-600 text-white shadow-lg'
                                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                        }`}
                    >
                        Symptom Diagnosis
                    </button>
                    <button
                        onClick={() => setActiveTab('image')}
                        className={`flex-1 py-2 px-4 rounded-lg font-medium text-sm transition-all ${
                            activeTab === 'image'
                                ? 'bg-primary-600 text-white shadow-lg'
                                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                        }`}
                    >
                        Image Analysis
                    </button>
                </div>
            </div>

            {/* Symptom Diagnosis Tab */}
            {activeTab === 'symptoms' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Input Section */}
                    <div className="card p-6">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('disease_diagnosis_symptom_diagnosis')}</h3>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Crop Type (Optional)
                                </label>
                                <input
                                    type="text"
                                    value={cropType}
                                    onChange={(e) => setCropType(e.target.value)}
                                    placeholder="e.g., maize, tomato, wheat"
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Add Symptoms
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={currentSymptom}
                                        onChange={(e) => setCurrentSymptom(e.target.value)}
                                        onKeyPress={(e) => e.key === 'Enter' && handleAddSymptom()}
                                        placeholder={t('disease_diagnosis_enter_symptom')}
                                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                    />
                                    <button
                                        onClick={handleAddSymptom}
                                        className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                                    >
                                        Add
                                    </button>
                                </div>
                            </div>

                            {/* Symptoms List */}
                            <div className="space-y-2">
                                {symptoms.map((symptom, index) => (
                                    <div key={index} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                        <span className="text-sm text-gray-900 dark:text-white">{symptom}</span>
                                        <button
                                            onClick={() => handleRemoveSymptom(symptom)}
                                            className="text-red-600 hover:text-red-700"
                                        >
                                            <XCircle className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>

                            <button
                                onClick={handleDiagnose}
                                disabled={symptoms.length === 0 || isDiagnosing}
                                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                            >
                                {isDiagnosing ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Diagnosing...
                                    </>
                                ) : (
                                    <>
                                        <Search className="w-4 h-4" />
                                        Diagnose Disease
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Results Section */}
                    <div className="card p-6">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('disease_diagnosis_diagnosis_results')}</h3>

                        {diagnosis.length > 0 ? (
                            <div className="space-y-4">
                                {diagnosis.map((result, index) => (
                                    <motion.div
                                        key={index}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <h4 className="font-semibold text-gray-900 dark:text-white">{result.disease}</h4>
                                            <div className={`px-2 py-1 rounded-full text-xs font-medium ${getSeverityColor(result.severity)}`}>
                                                {result.severity}
                                            </div>
                                        </div>
                                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                                            Confidence: {(result.confidence * 100).toFixed(1)}%
                                        </p>
                                        <p className="text-sm text-gray-900 dark:text-white mb-3">{result.description}</p>
                                        <button
                                            onClick={() => handleViewDiseaseInfo(result.disease)}
                                            className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                                        >
                                            View Details →
                                        </button>
                                    </motion.div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                                <Leaf className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                <p>No diagnosis results yet</p>
                                <p className="text-sm">Add symptoms and click diagnose</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Image Analysis Tab */}
            {activeTab === 'image' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Image Upload Section */}
                    <div className="card p-6">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('disease_diagnosis_image_analysis')}</h3>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Crop Type (Optional)
                                </label>
                                <input
                                    type="text"
                                    value={cropType}
                                    onChange={(e) => setCropType(e.target.value)}
                                    placeholder="e.g., maize, tomato, wheat"
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                />
                            </div>

                            {/* Image Upload */}
                            <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center">
                                {imagePreview ? (
                                    <div className="space-y-4">
                                        <img
                                            src={imagePreview}
                                            alt="Plant"
                                            className="max-w-full max-h-48 mx-auto rounded-lg"
                                        />
                                        <button
                                            onClick={() => {
                                                setSelectedImage(null);
                                                setImagePreview(null);
                                            }}
                                            className="text-red-600 hover:text-red-700 text-sm"
                                        >
                                            Remove Image
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <FileImage className="w-12 h-12 mx-auto text-gray-400" />
                                        <div>
                                            <label htmlFor="image-upload" className="cursor-pointer">
                                                <span className="text-primary-600 hover:text-primary-700 font-medium">Click to upload</span>
                                                <span className="text-gray-600 dark:text-gray-400"> or drag and drop</span>
                                            </label>
                                            <input
                                                id="image-upload"
                                                type="file"
                                                accept="image/*"
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file) handleImageSelect(file);
                                                }}
                                                className="hidden"
                                            />
                                        </div>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">PNG, JPG up to 10MB</p>
                                    </div>
                                )}
                            </div>

                            <button
                                onClick={handleAnalyzeImage}
                                disabled={!selectedImage || isAnalyzingImage}
                                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                            >
                                {isAnalyzingImage ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Analyzing...
                                    </>
                                ) : (
                                    <>
                                        <Camera className="w-4 h-4" />
                                        Analyze Image
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Analysis Results */}
                    <div className="card p-6">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('disease_diagnosis_analysis_results')}</h3>

                        {imageAnalysis ? (
                            <div className="space-y-4">
                                <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                                    <div className="flex items-center gap-2 mb-2">
                                        <CheckCircle className="w-5 h-5 text-green-600" />
                                        <h4 className="font-semibold text-green-800 dark:text-green-200">{t('disease_diagnosis_overall_health')}</h4>
                                    </div>
                                    <p className="text-green-700 dark:text-green-300">{imageAnalysis.overallHealth}</p>
                                </div>

                                {imageAnalysis.diseases.length > 0 && (
                                    <div>
                                        <h4 className="font-semibold text-gray-900 dark:text-white mb-3">{t('disease_diagnosis_detected_diseases')}</h4>
                                        <div className="space-y-3">
                                            {imageAnalysis.diseases.map((disease, index) => (
                                                <div key={index} className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <h5 className="font-medium text-gray-900 dark:text-white">{disease.disease}</h5>
                                                        <div className={`px-2 py-1 rounded-full text-xs font-medium ${getSeverityColor(disease.severity)}`}>
                                                            {disease.severity}
                                                        </div>
                                                    </div>
                                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                                        Confidence: {(disease.confidence * 100).toFixed(1)}%
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {imageAnalysis.recommendations.length > 0 && (
                                    <div>
                                        <h4 className="font-semibold text-gray-900 dark:text-white mb-3">{t('disease_diagnosis_recommendations')}</h4>
                                        <ul className="space-y-2">
                                            {imageAnalysis.recommendations.map((rec, index) => (
                                                <li key={index} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                                                    <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                                                    {rec}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                                <Camera className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                <p>No analysis results yet</p>
                                <p className="text-sm">Upload an image and click analyze</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Disease Info Modal */}
            {selectedDisease && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">{selectedDisease}</h3>
                                <button
                                    onClick={() => setSelectedDisease(null)}
                                    className="text-gray-400 hover:text-gray-600"
                                >
                                    <XCircle className="w-6 h-6" />
                                </button>
                            </div>

                            {isLoadingInfo ? (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
                                </div>
                            ) : diseaseInfo ? (
                                <div className="space-y-4">
                                    <div>
                                        <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Description</h4>
                                        <p className="text-gray-700 dark:text-gray-300">{diseaseInfo.description}</p>
                                    </div>

                                    <div>
                                        <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Symptoms</h4>
                                        <ul className="list-disc list-inside space-y-1 text-gray-700 dark:text-gray-300">
                                            {diseaseInfo.symptoms.map((symptom, index) => (
                                                <li key={index}>{symptom}</li>
                                            ))}
                                        </ul>
                                    </div>

                                    <div>
                                        <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Treatment</h4>
                                        <ul className="list-disc list-inside space-y-1 text-gray-700 dark:text-gray-300">
                                            {diseaseInfo.treatment.map((treatment, index) => (
                                                <li key={index}>{treatment}</li>
                                            ))}
                                        </ul>
                                    </div>

                                    <div>
                                        <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Prevention</h4>
                                        <ul className="list-disc list-inside space-y-1 text-gray-700 dark:text-gray-300">
                                            {diseaseInfo.prevention.map((prevent, index) => (
                                                <li key={index}>{prevent}</li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-gray-600 dark:text-gray-400">Failed to load disease information</p>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default DiseaseDiagnosis;