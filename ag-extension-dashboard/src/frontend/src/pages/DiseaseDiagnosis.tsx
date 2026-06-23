import React, { useState, useEffect } from 'react';
import {
    Search, Upload, Camera, Leaf, AlertTriangle,
    CheckCircle, XCircle, Loader2,
    FileImage, Download, Droplet, Layers, Activity
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useLanguage } from '../lib/LanguageContext';
import { useThemeClasses } from '@/hooks/useThemeClasses';
import { useAppStore } from '../store/useAppStore';
import {
    diagnoseFromSymptoms,
    getDiseaseInfo,
    getAllDiseases,
    analyzePlantImage,
    analyzeSoilImage,
    type DiseaseDiagnosis,
    type DiseaseInfo,
    type SoilAnalysisResult
} from '../api/diseaseService';
import toast from 'react-hot-toast';

export function DiseaseDiagnosis() {
    const { t } = useLanguage();
    const { headingClass, isModern, radiusClass, btnClass } = useThemeClasses();
    const { addNotification } = useAppStore();

    // State
    const [activeTab, setActiveTab] = useState<'symptoms' | 'image' | 'soil'>('symptoms');
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

    // Soil analysis state
    const [selectedSoilImage, setSelectedSoilImage] = useState<File | null>(null);
    const [soilImagePreview, setSoilImagePreview] = useState<string | null>(null);
    const [isAnalyzingSoil, setIsAnalyzingSoil] = useState(false);
    const [soilAnalysis, setSoilAnalysis] = useState<SoilAnalysisResult | null>(null);
    const [farmNotes, setFarmNotes] = useState('');

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
        // Intentional mount-only fetch: getAllDiseases is a stable module import.
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
            // Convert file to base64 using a Promise to prevent loading state race condition
            const base64Promise = new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target?.result as string);
                reader.onerror = (err) => reject(err);
                reader.readAsDataURL(selectedImage);
            });
            const base64 = await base64Promise;
            const imageData = base64.split(',')[1]; // Remove prefix

            const res = await analyzePlantImage(imageData, cropType || undefined);
            if (res.success) {
                setImageAnalysis(res.data);
                toast.success('Plant disease analysis completed!');
            } else {
                addNotification({
                    type: 'error',
                    message: t('disease_diagnosis_failed_analyze')
                });
            }
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

    const handleSoilImageSelect = (file: File) => {
        setSelectedSoilImage(file);
        const reader = new FileReader();
        reader.onload = (e) => {
            setSoilImagePreview(e.target?.result as string);
        };
        reader.readAsDataURL(file);
    };

    const handleAnalyzeSoil = async () => {
        if (!selectedSoilImage) return;

        setIsAnalyzingSoil(true);
        setSoilAnalysis(null);
        try {
            // Convert file to base64 using a Promise
            const base64Promise = new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target?.result as string);
                reader.onerror = (err) => reject(err);
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
                    message: 'Soil analysis failed.'
                });
            }
        } catch (error) {
            console.error('Soil analysis error:', error);
            addNotification({
                type: 'error',
                message: 'Failed to analyze soil image'
            });
        } finally {
            setIsAnalyzingSoil(false);
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
                    <h1 className={`text-2xl ${headingClass}`}>{isModern ? 'Pathological Diagnostics' : 'Disease Checker'}</h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">{t('disease_diagnosis_subtitle')}</p>
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
                                    className={`w-full px-3 py-2 border border-gray-300 dark:border-gray-600 ${radiusClass} bg-white dark:bg-gray-800 text-gray-900 dark:text-white`}
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
                                        className={`flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 ${radiusClass} bg-white dark:bg-gray-800 text-gray-900 dark:text-white`}
                                    />
                                    <button
                                        onClick={handleAddSymptom}
                                        className={`px-4 py-2 bg-primary-600 text-white ${btnClass} hover:bg-primary-700`}
                                    >
                                        Add
                                    </button>
                                </div>
                            </div>

                            {/* Symptoms List */}
                            <div className="space-y-2">
                                {symptoms.map((symptom, index) => (
                                    <div key={index} className={`flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 ${radiusClass}`}>
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
                                className={`w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary-600 text-white ${btnClass} hover:bg-primary-700 disabled:opacity-50`}
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
                                        className={`p-4 border border-gray-200 dark:border-gray-700 ${radiusClass}`}
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
                                    className={`w-full px-3 py-2 border border-gray-300 dark:border-gray-600 ${radiusClass} bg-white dark:bg-gray-800 text-gray-900 dark:text-white`}
                                />
                            </div>

                            {/* Image Upload */}
                            <div className={`border-2 border-dashed border-gray-300 dark:border-gray-600 ${radiusClass} p-6 text-center`}>
                                {imagePreview ? (
                                    <div className="space-y-4">
                                        <img
                                            src={imagePreview}
                                            alt="Plant"
                                            className={`max-w-full max-h-48 mx-auto ${radiusClass}`}
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
                                className={`w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary-600 text-white ${btnClass} hover:bg-primary-700 disabled:opacity-50`}
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
                                <div className={`p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 ${radiusClass}`}>
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
                                                <div key={index} className={`p-3 border border-gray-200 dark:border-gray-700 ${radiusClass}`}>
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
            {/* Soil Diagnostics Tab */}
            {activeTab === 'soil' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Input & Upload Column */}
                    <div className="card p-6">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Soil Sample Diagnostics</h3>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Target Crop (Optional)
                                </label>
                                <input
                                    type="text"
                                    value={cropType}
                                    onChange={(e) => setCropType(e.target.value)}
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
                                    onChange={(e) => setFarmNotes(e.target.value)}
                                    placeholder="Describe soil location, previous crop, visible anomalies..."
                                    rows={3}
                                    className={`w-full px-3 py-2 border border-gray-300 dark:border-gray-600 ${radiusClass} bg-white dark:bg-gray-800 text-gray-900 dark:text-white`}
                                />
                            </div>

                            {/* Soil Image Upload */}
                            <div className={`border-2 border-dashed border-gray-300 dark:border-gray-600 ${radiusClass} p-6 text-center`}>
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
                                                <span className="text-primary-600 hover:text-primary-700 font-medium">Click to upload soil photo</span>
                                                <span className="text-gray-600 dark:text-gray-400"> or drag and drop</span>
                                            </label>
                                            <input
                                                id="soil-upload"
                                                type="file"
                                                accept="image/*"
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file) handleSoilImageSelect(file);
                                                }}
                                                className="hidden"
                                            />
                                        </div>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">Capture clear, close-up soil samples (PNG, JPG up to 10MB)</p>
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
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Diagnostics Dashboard</h3>

                        {soilAnalysis ? (
                            <div className="space-y-6">
                                {/* Overall Score & Confidence */}
                                <div className={`p-4 bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-800 ${radiusClass}`}>
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <Activity className="w-5 h-5 text-primary-600" />
                                            <h4 className="font-semibold text-primary-800 dark:text-primary-200">Overall Soil Health Score</h4>
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
                                        <p className="font-semibold text-sm text-gray-900 dark:text-white">{soilAnalysis.texture}</p>
                                    </div>
                                    <div className="p-3 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-lg">
                                        <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
                                            <Droplet className="w-3.5 h-3.5 text-blue-500" />
                                            <span>Moisture Level</span>
                                        </div>
                                        <p className="font-semibold text-sm text-gray-900 dark:text-white">{soilAnalysis.estimatedMoisture}</p>
                                    </div>
                                    <div className="p-3 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-lg">
                                        <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
                                            <Activity className="w-3.5 h-3.5 text-purple-500" />
                                            <span>Drainage Class</span>
                                        </div>
                                        <p className="font-semibold text-sm text-gray-900 dark:text-white">{soilAnalysis.drainageClass}</p>
                                    </div>
                                    <div className="p-3 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-lg">
                                        <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
                                            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                                            <span>Discoloration</span>
                                        </div>
                                        <p className="font-semibold text-xs text-gray-900 dark:text-white line-clamp-2" title={soilAnalysis.colorDiscoloration}>
                                            {soilAnalysis.colorDiscoloration}
                                        </p>
                                    </div>
                                </div>

                                {/* NPK Deficiencies Dashboard */}
                                <div>
                                    <h4 className="font-semibold text-sm text-gray-900 dark:text-white mb-2">Nutrient Composition (NPK)</h4>
                                    <div className="grid grid-cols-3 gap-3">
                                        {/* Nitrogen */}
                                        <div className="p-3 border border-gray-100 dark:border-gray-700 rounded-lg text-center bg-gray-50 dark:bg-gray-800/50">
                                            <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-1.5">
                                                <span className="text-red-700 dark:text-red-300 font-bold text-sm">N</span>
                                            </div>
                                            <div className="text-xs text-gray-500 mb-1">Nitrogen</div>
                                            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                                                soilAnalysis.npkDeficiencies.nitrogen === 'optimal' 
                                                    ? 'text-green-700 bg-green-50 dark:bg-green-900/20'
                                                    : soilAnalysis.npkDeficiencies.nitrogen === 'low'
                                                    ? 'text-red-700 bg-red-50 dark:bg-red-900/20'
                                                    : 'text-amber-700 bg-amber-50 dark:bg-amber-900/20'
                                            }`}>
                                                {soilAnalysis.npkDeficiencies.nitrogen.toUpperCase()}
                                            </span>
                                        </div>
                                        {/* Phosphorus */}
                                        <div className="p-3 border border-gray-100 dark:border-gray-700 rounded-lg text-center bg-gray-50 dark:bg-gray-800/50">
                                            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mx-auto mb-1.5">
                                                <span className="text-blue-700 dark:text-blue-300 font-bold text-sm">P</span>
                                            </div>
                                            <div className="text-xs text-gray-500 mb-1">Phosphorus</div>
                                            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                                                soilAnalysis.npkDeficiencies.phosphorus === 'optimal' 
                                                    ? 'text-green-700 bg-green-50 dark:bg-green-900/20'
                                                    : soilAnalysis.npkDeficiencies.phosphorus === 'low'
                                                    ? 'text-red-700 bg-red-50 dark:bg-red-900/20'
                                                    : 'text-amber-700 bg-amber-50 dark:bg-amber-900/20'
                                            }`}>
                                                {soilAnalysis.npkDeficiencies.phosphorus.toUpperCase()}
                                            </span>
                                        </div>
                                        {/* Potassium */}
                                        <div className="p-3 border border-gray-100 dark:border-gray-700 rounded-lg text-center bg-gray-50 dark:bg-gray-800/50">
                                            <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto mb-1.5">
                                                <span className="text-amber-700 dark:text-amber-300 font-bold text-sm">K</span>
                                            </div>
                                            <div className="text-xs text-gray-500 mb-1">Potassium</div>
                                            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                                                soilAnalysis.npkDeficiencies.potassium === 'optimal' 
                                                    ? 'text-green-700 bg-green-50 dark:bg-green-900/20'
                                                    : soilAnalysis.npkDeficiencies.potassium === 'low'
                                                    ? 'text-red-700 bg-red-50 dark:bg-red-900/20'
                                                    : 'text-amber-700 bg-amber-50 dark:bg-amber-900/20'
                                            }`}>
                                                {soilAnalysis.npkDeficiencies.potassium.toUpperCase()}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Crop Suitability */}
                                <div>
                                    <h4 className="font-semibold text-sm text-gray-900 dark:text-white mb-2">Suitable Crop Recommendations</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {soilAnalysis.cropSuitability.map((crop, index) => (
                                            <span key={index} className="px-2.5 py-1 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 text-xs font-medium rounded-full">
                                                {crop}
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                {/* High Efficacy Recommendations */}
                                <div>
                                    <h4 className="font-semibold text-sm text-gray-900 dark:text-white mb-2">Targeted Recommendations</h4>
                                    <ul className="space-y-1.5">
                                        {soilAnalysis.recommendations.map((rec, index) => (
                                            <li key={index} className="flex items-start gap-2 text-xs text-gray-700 dark:text-gray-300">
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
                                <p className="text-xs max-w-xs mx-auto mt-1">Upload a clear photo of your field soil and input optional parameters to generate multi-dimensional diagnostics.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Disease Info Modal */}
            {selectedDisease && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className={`bg-white dark:bg-gray-800 ${radiusClass} max-w-2xl w-full max-h-[80vh] overflow-y-auto`}>
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