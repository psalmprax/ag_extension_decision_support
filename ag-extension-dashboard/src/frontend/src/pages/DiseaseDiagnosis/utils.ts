import type { DiseaseDiagnosis } from '../../api/diseaseService';

export const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
        case 'mild': return 'text-green-600 bg-green-50 dark:bg-green-900/20';
        case 'moderate': return 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20';
        case 'severe': return 'text-red-600 bg-red-50 dark:bg-red-900/20';
        default: return 'text-gray-600 bg-gray-50 dark:bg-gray-900/20';
    }
};

export const npkBadgeClass = (level: string) => {
    if (level === 'optimal') return 'text-green-700 bg-green-50 dark:bg-green-900/20';
    if (level === 'low') return 'text-red-700 bg-red-50 dark:bg-red-900/20';
    return 'text-amber-700 bg-amber-50 dark:bg-amber-900/20';
};

export interface TabProps {
    cropType: string;
    setCropType: (v: string) => void;
    radiusClass: string;
    btnClass: string;
    t: (key: string) => string;
    addNotification: (n: { type: 'info' | 'success' | 'warning' | 'error'; message: string }) => void;
    onViewDiseaseInfo: (name: string) => void;
}
