import React from 'react';
import { XCircle, Loader2 } from 'lucide-react';
import type { DiseaseInfo } from '../../api/diseaseService';

interface Props {
    selectedDisease: string | null;
    setSelectedDisease: (disease: string | null) => void;
    isLoadingInfo: boolean;
    diseaseInfo: DiseaseInfo | null;
    radiusClass: string;
}

export function DiseaseInfoModal({
    selectedDisease, setSelectedDisease, isLoadingInfo, diseaseInfo, radiusClass
}: Props) {
    if (!selectedDisease) return null;

    return (
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
    );
}
