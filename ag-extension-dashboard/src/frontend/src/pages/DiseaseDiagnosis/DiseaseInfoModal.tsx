import React, { useState, useEffect } from 'react';
import { Loader2, XCircle } from 'lucide-react';
import { getDiseaseInfo, type DiseaseInfo } from '../../api/diseaseService';

interface Props {
    diseaseName: string;
    radiusClass: string;
    onClose: () => void;
}

export function DiseaseInfoModal({ diseaseName, radiusClass, onClose }: Props) {
    const [diseaseInfo, setDiseaseInfo] = useState<DiseaseInfo | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        setIsLoading(true);
        getDiseaseInfo(diseaseName)
            .then(res => { if (!cancelled && res.success) setDiseaseInfo(res.data); })
            .catch(() => {})
            .finally(() => { if (!cancelled) setIsLoading(false); });
        return () => { cancelled = true; };
    }, [diseaseName]);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className={`bg-white dark:bg-gray-800 ${radiusClass} max-w-2xl w-full max-h-[80vh] overflow-y-auto`}>
                <div className="p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xl font-semibold text-gray-900 dark:text-white">{diseaseName}</h3>
                        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                            <XCircle className="w-6 h-6" />
                        </button>
                    </div>

                    {isLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
                        </div>
                    ) : diseaseInfo ? (
                        <div className="space-y-4">
                            <Section title="Description" items={[diseaseInfo.description]} />
                            <Section title="Symptoms" items={diseaseInfo.symptoms} />
                            <Section title="Treatment" items={diseaseInfo.treatment} />
                            <Section title="Prevention" items={diseaseInfo.prevention} />
                        </div>
                    ) : (
                        <p className="text-gray-600 dark:text-gray-400">Failed to load disease information</p>
                    )}
                </div>
            </div>
        </div>
    );
}

const Section = ({ title, items }: { title: string; items: string[] }) => (
    <div>
        <h4 className="font-semibold text-gray-900 dark:text-white mb-2">{title}</h4>
        {items.length === 1 ? (
            <p className="text-gray-700 dark:text-gray-300">{items[0]}</p>
        ) : (
            <ul className="list-disc list-inside space-y-1 text-gray-700 dark:text-gray-300">
                {items.map((item, i) => <li key={i}>{item}</li>)}
            </ul>
        )}
    </div>
);
