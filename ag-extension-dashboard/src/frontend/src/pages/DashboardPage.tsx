import React from 'react';
import { motion } from 'framer-motion';
import {
    MessageSquare,
    MapPin,
    Sparkles,
    Users,
    Loader2,
} from 'lucide-react';
import { CardSkeleton } from '@/components/Skeleton';
import { FarmerMap } from '@/components/FarmerMap';
import { StatCard } from '../components/StatCard';
import { Farmer, DashboardData } from '../types/dashboard';
import { useLanguage } from '@/lib/LanguageContext';
import { useThemeClasses } from '@/hooks/useThemeClasses';

interface DashboardPageProps {
    dashboardData: DashboardData | undefined;
    isLoading: boolean;
    isOfficer: boolean;
    performanceData: { metrics?: { resolutionRate?: number; satisfactionScore?: number } } | undefined;
    effectiveFarmers: Farmer[];
    isMapExpanded: boolean;
    setIsMapExpanded: (expanded: boolean) => void;
    handleStartConversation: (farmer: Farmer, type: 'ai' | 'farmer') => void;
    handleOpenFarmerDetail: (farmer: Farmer) => void;
    user: { role?: string; firstName?: string } | undefined;
    addNotification: (n: { type: 'info' | 'warning' | 'error' | 'success'; message: string }) => void;
}

const DashboardHeader: React.FC<{ isModern: boolean; userName?: string; t: (key: string) => string; headingClass: string }> = ({ isModern, userName, t, headingClass }) => (
    <div className='mb-12'>
        <h1 className={`text-5xl font-black tracking-tighter font-headline mb-2 drop-shadow-[0_0_15px_var(--color-outline)] dark:drop-shadow-[0_0_15px_var(--color-outline)] ${headingClass}`}>
            {isModern ? 'Strategic Intelligence' : 'Operations Dashboard'}
        </h1>
        <p className='text-slate-400 font-headline font-medium text-lg'>
            {t('dashboard_welcome').replace('{name}', userName || 'Extension Officer')}
        </p>
    </div>
);

const DashboardStats: React.FC<{
    isLoading: boolean;
    dashboardData?: DashboardData;
    isOfficer: boolean;
    t: (key: string) => string;
    classes: Record<string, string | boolean>;
}> = ({ isLoading, dashboardData, isOfficer, t, classes }) => {
    if (isLoading) {
        return (
            <>
                <CardSkeleton />
                <CardSkeleton />
                <CardSkeleton />
                <CardSkeleton />
            </>
        );
    }
    if (!dashboardData) return null;
    return (
        <>
            <StatCard
                title={isOfficer ? "My Farmers" : t('stat_total_farmers')}
                value={dashboardData.overview.totalFarmers}
                change={dashboardData.trends.farmersGrowth}
                icon={Users}
                delay={0}
                {...classes}
            />
            <StatCard
                title={isOfficer ? "My Active Chats" : t('stat_active_conversations')}
                value={dashboardData.overview.activeConversations}
                change={dashboardData.trends.conversationsGrowth}
                icon={MessageSquare}
                delay={0.05}
                {...classes}
            />
            <StatCard
                title={isOfficer ? "My Visits (30d)" : t('stat_visits_this_month')}
                value={dashboardData.overview.visitsThisMonth}
                change={dashboardData.trends.visitsGrowth}
                icon={MapPin}
                delay={0.1}
                {...classes}
            />
            <StatCard
                title={isOfficer ? "Avg. Conversations" : t('stat_avg_satisfaction')}
                value={isOfficer ? dashboardData.overview.avgConversationsPerFarmer : `${dashboardData.overview.avgSatisfaction}/5`}
                change={isOfficer ? undefined : dashboardData.trends.satisfactionChange}
                icon={isOfficer ? MessageSquare : Sparkles}
                delay={0.15}
                {...classes}
            />
        </>
    );
};

const ActivePulseCard: React.FC<{ cardClass: string }> = ({ cardClass }) => (
    <div className={cardClass}>
        <div className="flex items-center gap-3 mb-6">
            <div className="w-2 h-2 bg-cyan-400 rounded-full animate-ping"></div>
            <h3 className="text-sm font-headline font-bold text-gray-900 dark:text-white uppercase tracking-widest">Active Pulse</h3>
        </div>
        <div className="space-y-4">
            {[
                { label: 'Sensor Node 04', status: 'Optimal', time: '2m ago' },
                { label: 'Drone Survey', status: 'In Progress', time: 'Active' },
                { label: 'Satellite Sync', status: 'Complete', time: '1h ago' }
            ].map((item, i) => (
                <div key={i} className="flex justify-between items-center border-b border-white/5 pb-3 last:border-0 last:pb-0">
                    <div>
                        <p className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-tight">{item.label}</p>
                        <p className="text-xxs text-slate-500">{item.time}</p>
                    </div>
                    <span className="text-xxs font-black text-cyan-400 uppercase">{item.status}</span>
                </div>
            ))}
        </div>
    </div>
);

const SupportEfficiencyCard: React.FC<{ performanceData?: { metrics?: { resolutionRate?: number, satisfactionScore?: number } }; t: (key: string) => string; cardClass: string }> = ({ performanceData, t, cardClass }) => {
    const resolutionRate = performanceData?.metrics?.resolutionRate ?? 0;
    const satisfactionScore = performanceData?.metrics?.satisfactionScore ?? 0;
    const satisfactionProgress = satisfactionScore * 20;

    return (
    <div className={`${cardClass} p-8`}>
        <h3 className="text-lg font-headline font-bold text-gray-900 dark:text-white mb-6">{t('analytics_support_efficiency')}</h3>
        {performanceData ? (
        <div className="space-y-6">
            {[
                { name: t('analytics_resolution_rate'), progress: resolutionRate, color: 'bg-cyan-400' },
                { name: t('analytics_satisfaction_score'), progress: satisfactionProgress, color: 'bg-purple-500' },
            ].map((item, i) => (
                <div key={i} className="space-y-2">
                    <div className="flex justify-between items-center">
                        <span className="text-sm font-bold text-slate-300">{item.name}</span>
                        <span className="text-xs font-black text-cyan-400">{Math.round(item.progress)}%</span>
                    </div>
                    <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${item.progress}%` }}
                            transition={{ duration: 1, delay: i * 0.1 }}
                            className={`h-full ${item.color} rounded-full shadow-[0_0_10px_var(--color-outline)]`}
                        />
                    </div>
                </div>
            ))}
        </div>
        ) : (
            <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
            </div>
        )}
    </div>
    );
};

const DashboardMapSection: React.FC<{
    effectiveFarmers: Farmer[];
    isMapExpanded: boolean;
    setIsMapExpanded: (expanded: boolean) => void;
    handleStartConversation: (farmer: Farmer, type: 'ai' | 'farmer') => void;
    handleOpenFarmerDetail: (farmer: Farmer) => void;
    user?: { role?: string; firstName?: string };
    t: (key: string) => string;
    cardClass: string;
    radiusClass: string;
}> = ({ effectiveFarmers, isMapExpanded, setIsMapExpanded, handleStartConversation, handleOpenFarmerDetail, user, t, cardClass, radiusClass }) => {
    return (
        <div className={`lg:col-span-2 ${cardClass} group`}>
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-headline font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-cyan-400" />
                    {t('stat_regional_distribution')}
                </h3>
                <div className="flex gap-2">
                    <span className={`px-2 py-1 bg-cyan-400/10 text-cyan-400 ${radiusClass} text-xxs font-bold uppercase tracking-widest border border-cyan-400/20`}>
                        {t('stat_kenya_overview') || "Kenya Overview"}
                    </span>
                </div>
            </div>

            <div className={`relative h-[400px] bg-slate-950/50 ${radiusClass} overflow-hidden border border-white/5 shadow-inner`}>
                <FarmerMap
                    height="400px"
                    isExternalExpanded={isMapExpanded}
                    onToggleExpand={setIsMapExpanded}
                    farmers={effectiveFarmers.map((f) => ({
                        id: f.id,
                        name: `${f.firstName} ${f.lastName}`,
                        lat: f.latitude || -1.2863,
                        lng: f.longitude || 36.8172,
                        crop: f.crops?.[0] || 'Maize',
                        region: f.region || 'Unknown',
                        size: f.farmSize || 0,
                        phone: f.phone,
                        yield: f.yield || 0
                    }))}
                    onFarmerClick={(farmerData) => {
                        if (user?.role === 'extension_officer' || user?.role === 'admin') {
                            React.startTransition(() => {});
                            const farmer = effectiveFarmers.find(f => f.id === farmerData.id) as Farmer;
                            if (farmer) handleStartConversation(farmer, 'farmer');
                        } else {
                            const farmer = effectiveFarmers.find(f => f.id === farmerData.id) as Farmer;
                            if (farmer) handleOpenFarmerDetail(farmer);
                        }
                    }}
                />

                {!isMapExpanded && (
                    <div className={`absolute bottom-4 left-4 right-4 flex justify-between items-center bg-slate-900/80 backdrop-blur-md p-3 ${radiusClass} border border-white/10`}>
                        <div className="flex gap-4">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-cyan-400 rounded-full"></div>
                                <span className="text-xxs font-bold text-slate-300 uppercase tracking-widest">{t('table_active')}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                                <span className="text-xxs font-bold text-slate-300 uppercase tracking-widest">{t('analytics_disease_alerts')}</span>
                            </div>
                        </div>
                        <button
                            onClick={() => setIsMapExpanded(true)}
                            className={`text-xxs font-black text-cyan-400 uppercase bg-cyan-400/10 px-3 py-1 ${radiusClass} border border-cyan-400/20 hover:bg-cyan-400/20 transition-colors`}
                        >
                            {t('viz_detail_view')}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export const DashboardPage: React.FC<DashboardPageProps> = ({
    dashboardData, isLoading, isOfficer, performanceData,
    effectiveFarmers, isMapExpanded, setIsMapExpanded,
    handleStartConversation, handleOpenFarmerDetail,
    user,
}) => {
    const { t } = useLanguage();
    const { isModern, cardClass, headingClass, dataClass, subtextClass, radiusClass } = useThemeClasses();

    return (
        <div className="animate-in fade-in duration-500">
            <DashboardHeader 
                isModern={isModern} 
                userName={user?.firstName} 
                t={t} 
                headingClass={headingClass} 
            />

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <DashboardStats 
                    isLoading={isLoading} 
                    dashboardData={dashboardData} 
                    isOfficer={isOfficer} 
                    t={t} 
                    classes={{ cardClass, headingClass, dataClass, subtextClass, isModern }} 
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                <DashboardMapSection 
                    effectiveFarmers={effectiveFarmers}
                    isMapExpanded={isMapExpanded}
                    setIsMapExpanded={setIsMapExpanded}
                    handleStartConversation={handleStartConversation}
                    handleOpenFarmerDetail={handleOpenFarmerDetail}
                    user={user}
                    t={t}
                    cardClass={cardClass}
                    radiusClass={radiusClass}
                />
                
                <div className="space-y-6">
                    <SupportEfficiencyCard 
                        performanceData={performanceData} 
                        t={t} 
                        cardClass={cardClass} 
                    />
                    <ActivePulseCard cardClass={cardClass} />
                </div>
            </div>
        </div>
    );
};
