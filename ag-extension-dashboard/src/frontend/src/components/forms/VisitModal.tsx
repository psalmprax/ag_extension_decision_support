import React, { useState, useEffect } from 'react';
import { X, MapPin, Calendar, FileText, User } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import { useAppStore } from '@/store/useAppStore';
import { fetchFarmers } from '@/api/farmerService';
import { createVisit } from '@/api/visitService';
import toast from 'react-hot-toast';

interface Farmer {
    id: string;
    firstName: string;
    lastName: string;
    phone?: string;
    region?: string;
    village?: string;
}

interface VisitModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export const VisitModal: React.FC<VisitModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const { t } = useLanguage();
    const { user } = useAppStore();
    const [loading, setLoading] = useState(false);
    const [farmers, setFarmers] = useState<Farmer[]>([]);
    const [loadingFarmers, setLoadingFarmers] = useState(false);
    const [formData, setFormData] = useState({
        farmerId: '',
        type: 'routine',
        scheduledAt: '',
        notes: '',
        farmerSearch: ''
    });

    useEffect(() => {
        if (isOpen) {
            loadFarmers();
        }
    }, [isOpen]);

    const loadFarmers = async () => {
        setLoadingFarmers(true);
        try {
            const data = await fetchFarmers();
            if (data.success && data.data?.farmers) {
                setFarmers(data.data.farmers);
            }
        } catch (error) {
            console.error('Failed to fetch farmers:', error);
        } finally {
            setLoadingFarmers(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.farmerId || !formData.scheduledAt) return;

        setLoading(true);
        try {
            const data = await createVisit({
                farmer_id: formData.farmerId,
                visit_type: formData.type,
                scheduled_at: new Date(formData.scheduledAt).toISOString(),
                notes: formData.notes
            });

            if (data.success) {
                onSuccess();
                onClose();
                setFormData({
                    farmerId: '',
                    type: 'routine',
                    scheduledAt: '',
                    notes: '',
                    farmerSearch: ''
                });
            } else {
                toast.error(t('visit_create_failed'));
            }
        } catch (error) {
            console.error('Failed to create visit:', error);
            toast.error(t('visit_create_failed'));
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative w-full max-w-lg bg-white dark:bg-gray-800 rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900/30 rounded-xl flex items-center justify-center">
                            <MapPin className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                                {t('visit_create_title') || 'Schedule New Visit'}
                            </h2>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                {t('visit_create_subtitle') || 'Book a visit with a farmer'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* Farmer Selection */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                            <User className="w-4 h-4 inline mr-1" />
                            {t('visit_select_farmer') || 'Select Farmer'} *
                        </label>
                        <div className="relative">
                            <input
                                type="text"
                                value={formData.farmerSearch || ''}
                                onChange={(e) => setFormData({ ...formData, farmerSearch: e.target.value })}
                                placeholder={loadingFarmers ? (t('common_loading') || 'Loading...') : (t('visit_select_farmer_placeholder') || 'Search farmer...')}
                                disabled={loadingFarmers}
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            />
                            {formData.farmerSearch && !formData.farmerId && (
                                <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                                    {farmers
                                        .filter(f =>
                                            `${f.firstName} ${f.lastName}`.toLowerCase().includes(formData.farmerSearch!.toLowerCase()) ||
                                            (f.region || '').toLowerCase().includes(formData.farmerSearch!.toLowerCase()) ||
                                            (f.phone || '').includes(formData.farmerSearch!)
                                        )
                                        .slice(0, 10)
                                        .map(farmer => (
                                            <button
                                                key={farmer.id}
                                                type="button"
                                                onClick={() => setFormData({ ...formData, farmerId: farmer.id, farmerSearch: `${farmer.firstName} ${farmer.lastName}` })}
                                                className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-600 text-sm"
                                            >
                                                <span className="font-medium text-gray-900 dark:text-white">{farmer.firstName} {farmer.lastName}</span>
                                                <span className="text-gray-500 dark:text-gray-400 ml-2">— {farmer.region}</span>
                                            </button>
                                        ))
                                    }
                                    {farmers.filter(f =>
                                        `${f.firstName} ${f.lastName}`.toLowerCase().includes(formData.farmerSearch!.toLowerCase())
                                    ).length === 0 && (
                                        <div className="px-4 py-2 text-sm text-gray-500">No farmers found</div>
                                    )}
                                </div>
                            )}
                            {formData.farmerId && (
                                <div className="mt-2 flex items-center gap-2">
                                    <span className="text-xs text-primary-600 dark:text-primary-400 font-medium">
                                        Selected: {formData.farmerSearch}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, farmerId: '', farmerSearch: '' })}
                                        className="text-xs text-gray-400 hover:text-gray-600"
                                    >
                                        Change
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Visit Type */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                            <FileText className="w-4 h-4 inline mr-1" />
                            {t('visit_type_label') || 'Visit Type'}
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                            {[
                                { value: 'routine', label: t('visit_type_routine') || 'Routine' },
                                { value: 'follow_up', label: t('visit_type_followup') || 'Follow-up' },
                                { value: 'new_registration', label: t('visit_type_new') || 'New Farmer' },
                                { value: 'query', label: t('visit_type_query') || 'Query' },
                                { value: 'emergency', label: t('visit_type_emergency') || 'Emergency' }
                            ].map((type) => (
                                <button
                                    key={type.value}
                                    type="button"
                                    onClick={() => setFormData({ ...formData, type: type.value })}
                                    className={`px-3 py-2 rounded-xl text-sm font-medium transition-all ${formData.type === type.value
                                        ? 'bg-primary-600 text-white shadow-lg shadow-primary-500/25'
                                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                                        }`}
                                >
                                    {type.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Date & Time */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                            <Calendar className="w-4 h-4 inline mr-1" />
                            {t('visit_date_time') || 'Date & Time'} *
                        </label>
                        <input
                            type="datetime-local"
                            value={formData.scheduledAt}
                            onChange={(e) => setFormData({ ...formData, scheduledAt: e.target.value })}
                            required
                            min={new Date().toISOString().slice(0, 16)}
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        />
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                            <FileText className="w-4 h-4 inline mr-1" />
                            {t('visit_notes') || 'Notes'} ({(t('common_optional') || 'Optional')})
                        </label>
                        <textarea
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            rows={3}
                            placeholder={t('visit_notes_placeholder') || "Add any notes about this visit..."}
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                        />
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        >
                            {t('common_cancel')}
                        </button>
                        <button
                            type="submit"
                            disabled={loading || !formData.farmerId || !formData.scheduledAt}
                            className="flex-1 px-4 py-3 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-semibold shadow-lg shadow-primary-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    {t('common_loading')}
                                </>
                            ) : (
                                <>
                                    <MapPin className="w-4 h-4" />
                                    {t('visit_schedule') || 'Schedule Visit'}
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default VisitModal;
