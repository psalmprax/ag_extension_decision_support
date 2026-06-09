import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, User, Mail, MapPin, Shield, Save, Loader2 } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import { useAppStore } from '@/store/useAppStore';
import toast from 'react-hot-toast';
import apiClient from '@/api/client';

interface ProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose }) => {
    const { t } = useLanguage();
    const { user, setUser } = useAppStore();
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        region: '',
    });

    useEffect(() => {
        if (user && isOpen) {
            setFormData({
                firstName: user.firstName || '',
                lastName: user.lastName || '',
                email: user.email || '',
                region: user.region || '',
            });
            setIsEditing(false);
        }
    }, [user, isOpen]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const { data } = await apiClient.patch('/users/profile', formData);
            if (data.success) {
                setUser({ ...user!, ...formData });
                setIsEditing(false);
                toast.success('Profile updated successfully');
            }
        } catch (error) {
            console.error('Failed to update profile:', error);
            toast.error('Failed to update profile. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    if (!user) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[80]"
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="fixed inset-0 z-[90] flex items-center justify-center p-4"
                    >
                        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">
                            {/* Header */}
                            <div className="relative p-6 bg-gradient-to-br from-primary-500 to-primary-700 text-white">
                                <button
                                    onClick={onClose}
                                    className="absolute top-4 right-4 p-2 rounded-xl hover:bg-white/20 transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                                <div className="flex items-center gap-4">
                                    <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center text-2xl font-bold backdrop-blur-sm">
                                        {user.firstName?.[0]}{user.lastName?.[0]}
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold">{user.firstName} {user.lastName}</h2>
                                        <div className="flex items-center gap-2 mt-1">
                                            <Shield className="w-4 h-4 opacity-80" />
                                            <span className="text-sm opacity-90 capitalize">{user.role?.replace('_', ' ')}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Content */}
                            <div className="p-6 space-y-4">
                                <div className="space-y-3">
                                    <div>
                                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                            {t('common_first_name') || 'First Name'}
                                        </label>
                                        {isEditing ? (
                                            <input
                                                type="text"
                                                value={formData.firstName}
                                                onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                                                className="w-full mt-1 px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-primary-500 dark:text-white"
                                            />
                                        ) : (
                                            <div className="flex items-center gap-2 mt-1 p-2.5">
                                                <User className="w-4 h-4 text-gray-400" />
                                                <span className="text-gray-900 dark:text-white font-medium">{user.firstName}</span>
                                            </div>
                                        )}
                                    </div>

                                    <div>
                                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                            {t('common_last_name') || 'Last Name'}
                                        </label>
                                        {isEditing ? (
                                            <input
                                                type="text"
                                                value={formData.lastName}
                                                onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                                                className="w-full mt-1 px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-primary-500 dark:text-white"
                                            />
                                        ) : (
                                            <div className="flex items-center gap-2 mt-1 p-2.5">
                                                <User className="w-4 h-4 text-gray-400" />
                                                <span className="text-gray-900 dark:text-white font-medium">{user.lastName}</span>
                                            </div>
                                        )}
                                    </div>

                                    <div>
                                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                            Email
                                        </label>
                                        <div className="flex items-center gap-2 mt-1 p-2.5">
                                            <Mail className="w-4 h-4 text-gray-400" />
                                            <span className="text-gray-900 dark:text-white font-medium">{user.email}</span>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                            {t('common_region') || 'Region'}
                                        </label>
                                        {isEditing ? (
                                            <input
                                                type="text"
                                                value={formData.region}
                                                onChange={(e) => setFormData(prev => ({ ...prev, region: e.target.value }))}
                                                className="w-full mt-1 px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-primary-500 dark:text-white"
                                            />
                                        ) : (
                                            <div className="flex items-center gap-2 mt-1 p-2.5">
                                                <MapPin className="w-4 h-4 text-gray-400" />
                                                <span className="text-gray-900 dark:text-white font-medium">{user.region || 'Not set'}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
                                    {isEditing ? (
                                        <>
                                            <button
                                                onClick={() => setIsEditing(false)}
                                                className="flex-1 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                                            >
                                                {t('common_cancel') || 'Cancel'}
                                            </button>
                                            <button
                                                onClick={handleSave}
                                                disabled={isSaving}
                                                className="flex-1 py-2.5 bg-primary-600 text-white font-bold rounded-xl hover:bg-primary-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                                            >
                                                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                                {t('common_save') || 'Save'}
                                            </button>
                                        </>
                                    ) : (
                                        <button
                                            onClick={() => setIsEditing(true)}
                                            className="w-full py-2.5 bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 font-bold rounded-xl hover:bg-primary-100 dark:hover:bg-primary-900/40 transition-colors"
                                        >
                                            {t('common_edit') || 'Edit Profile'}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

export default ProfileModal;
