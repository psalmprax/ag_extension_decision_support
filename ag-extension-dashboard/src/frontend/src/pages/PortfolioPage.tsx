import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Users,
    Send,
    FileText,
    Trash2,
    X,
} from 'lucide-react';
import { Farmer } from '../types/dashboard';
import { useLanguage } from '@/lib/LanguageContext';
import { useThemeClasses } from '@/hooks/useThemeClasses';

interface PortfolioPageProps {
    effectiveFarmers: Farmer[];
    selectedFarmers: Set<string>;
    handleSelectFarmer: (id: string, checked: boolean) => void;
    handleOpenFarmerDetail: (farmer: Farmer) => void;
    showBulkSmsComposer: boolean;
    setShowBulkSmsComposer: (show: boolean) => void;
    bulkSmsMessage: string;
    setBulkSmsMessage: (msg: string) => void;
    handleBulkSMS: () => void;
    handleBulkExport: () => void;
    handleBulkDelete: () => void;
    setSelectedFarmers: (farmers: Set<string>) => void;
}

export const PortfolioPage: React.FC<PortfolioPageProps> = ({
    effectiveFarmers, selectedFarmers, handleSelectFarmer, handleOpenFarmerDetail,
    showBulkSmsComposer, setShowBulkSmsComposer, bulkSmsMessage, setBulkSmsMessage,
    handleBulkSMS, handleBulkExport, handleBulkDelete, setSelectedFarmers,
}) => {
    const { t } = useLanguage();
    const { isModern, headingClass, btnClass, radiusClass } = useThemeClasses();

    return (
        <div>
            <div className="mb-8">
                <h1 className={`text-3xl ${headingClass}`}>
                    {isModern ? 'Human Capital Network' : 'Client Portfolio'}
                </h1>
                <p className="text-gray-500 dark:text-gray-400 mt-1 font-medium">{t('portfolio_subtitle')}</p>
            </div>
            {selectedFarmers.size > 0 && (
                <div className={`mb-4 p-4 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 ${radiusClass}`}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2">
                                <Users className="w-5 h-5 text-primary-600" />
                                <span className="font-bold text-primary-800 dark:text-primary-200">
                                    {selectedFarmers.size} farmer{selectedFarmers.size !== 1 ? 's' : ''} selected
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setShowBulkSmsComposer(!showBulkSmsComposer)}
                                className={`px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-bold ${btnClass} transition-colors flex items-center gap-2`}
                            >
                                <Send className="w-4 h-4" />
                                Send SMS
                            </button>
                            <button
                                onClick={handleBulkExport}
                                className={`px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold ${btnClass} transition-colors flex items-center gap-2`}
                            >
                                <FileText className="w-4 h-4" />
                                Export CSV
                            </button>
                            <button
                                onClick={handleBulkDelete}
                                className={`px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-bold ${btnClass} transition-colors flex items-center gap-2`}
                            >
                                <Trash2 className="w-4 h-4" />
                                Delete
                            </button>
                            <button
                                onClick={() => setSelectedFarmers(new Set())}
                                className={`px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 text-sm font-bold ${btnClass} transition-colors`}
                            >
                                Clear Selection
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showBulkSmsComposer && selectedFarmers.size > 0 && (
                <div className={`mb-4 p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 ${radiusClass} shadow-sm`}>
                    <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                            Compose SMS for {selectedFarmers.size} farmer{selectedFarmers.size !== 1 ? 's' : ''}
                        </h4>
                        <button onClick={() => setShowBulkSmsComposer(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                            <X className="w-4 h-4 text-gray-400" />
                        </button>
                    </div>
                    <textarea
                        value={bulkSmsMessage}
                        onChange={(e) => setBulkSmsMessage(e.target.value)}
                        placeholder="Type your message here... (leave empty for default message)"
                        rows={3}
                        className={`w-full px-4 py-3 ${radiusClass} border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 resize-none text-sm`}
                    />
                    <div className="flex items-center justify-between mt-3">
                        <span className="text-xs text-gray-400">{bulkSmsMessage.length}/160 characters</span>
                        <button
                            onClick={handleBulkSMS}
                            className={`px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-bold ${btnClass} transition-colors flex items-center gap-2`}
                        >
                            <Send className="w-4 h-4" />
                            Send to {selectedFarmers.size} farmer{selectedFarmers.size !== 1 ? 's' : ''}
                        </button>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 p-2">
                <AnimatePresence>
                    {effectiveFarmers.map((farmer: Farmer, idx: number) => (
                        <motion.div
                            layout
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                            transition={{ duration: 0.4, type: "spring", bounce: 0.3, delay: Math.min(idx * 0.05, 0.5) }}
                            key={farmer.id}
                            className="card glass p-6 hover:shadow-2xl transition-all duration-300 relative group flex flex-col justify-between"
                            onClick={() => handleOpenFarmerDetail(farmer)}
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center gap-4">
                                    <div className={`w-12 h-12 ${radiusClass} bg-gradient-to-br from-primary-500 to-blue-500 shadow-lg shadow-primary-500/20 flex flex-shrink-0 items-center justify-center text-white font-black text-lg`}>
                                        {farmer.firstName?.[0]}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-gray-900 dark:text-white text-lg leading-tight truncate">{farmer.firstName} {farmer.lastName}</h3>
                                        <p className="text-xs text-gray-400 dark:text-gray-500 font-medium">#{farmer.id.slice(0, 8)}</p>
                                    </div>
                                </div>
                                <div className="pt-1 pr-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 focus-within:opacity-100" onClick={(e) => e.stopPropagation()}>
                                    <input
                                        type="checkbox"
                                        checked={selectedFarmers.has(farmer.id)}
                                        onChange={(e) => handleSelectFarmer(farmer.id, e.target.checked)}
                                        className={`w-5 h-5 ${radiusClass} border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer`}
                                    />
                                </div>
                            </div>

                            <div className="flex-1 space-y-4 my-2">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-xxs font-black uppercase tracking-widest text-gray-400 mb-1">{t('table_region_village')}</p>
                                        <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 truncate">{farmer.region}</p>
                                        <p className="text-xs text-gray-500 truncate">{farmer.village}</p>
                                    </div>
                                    <div>
                                        <p className="text-xxs font-black uppercase tracking-widest text-gray-400 mb-1">{t('table_farm_size')}</p>
                                        <p className="text-sm font-bold text-gray-800 dark:text-gray-100">{farmer.farmSize} <span className="text-xs text-gray-500 font-medium tracking-normal">ha</span></p>
                                    </div>
                                </div>

                                <div className="flex flex-wrap gap-1.5 min-h-[30px]">
                                    {farmer.crops?.map((crop: string) => (
                                        <span key={crop} className={`px-2.5 py-1 bg-gray-100/50 dark:bg-gray-800 text-primary-600 dark:text-primary-300 ${radiusClass} text-xxs font-bold uppercase tracking-tight border border-gray-200 dark:border-gray-700 shadow-sm`}>
                                            {crop}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-white/10 flex justify-between items-center">
                                <span className="px-3 py-1 bg-green-500/10 text-green-600 dark:text-green-400 rounded-full text-xxs font-black uppercase tracking-widest shadow-inner shadow-green-500/20">{t('table_active')}</span>
                                <div className="flex -space-x-2">
                                    <div className="w-6 h-6 rounded-full bg-blue-100 border-2 border-white dark:border-gray-800 flex items-center justify-center text-xxs font-bold text-blue-600">SMS</div>
                                </div>
                            </div>

                            {selectedFarmers.has(farmer.id) && (
                                <div className="absolute top-6 right-6" onClick={(e) => e.stopPropagation()}>
                                    <input
                                        type="checkbox"
                                        checked={selectedFarmers.has(farmer.id)}
                                        onChange={(e) => handleSelectFarmer(farmer.id, e.target.checked)}
                                        className={`w-5 h-5 ${radiusClass} border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer`}
                                    />
                                </div>
                            )}
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </div>
    );
};
