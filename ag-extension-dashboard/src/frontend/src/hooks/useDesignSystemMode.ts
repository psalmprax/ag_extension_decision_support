import { useAppStore, AppState } from '@/store/useAppStore';

export function useDesignSystemMode() {
    const { designSystemMode, darkMode } = useAppStore((state: AppState) => ({
        designSystemMode: state.designSystemMode,
        darkMode: state.darkMode
    }));
    const isModern = designSystemMode === 'modern';
    
    const radiusClass = isModern ? 'rounded-2xl' : 'rounded-none';
    const panelClass = isModern 
        ? 'glass-panel shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] border-white/10' 
        : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-none';
    const headerOpacity = isModern ? 'bg-white/30 dark:bg-slate-950/30' : 'bg-white dark:bg-slate-950 border-b-2 border-slate-100 dark:border-slate-800';
    const btnClass = isModern 
        ? 'rounded-xl hover:scale-[1.02] active:scale-[0.98] hover:shadow-[0_0_20px_rgba(34,211,238,0.2)]' 
        : 'rounded-none border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 font-mono text-[10px] uppercase tracking-widest';
    const headingClass = isModern 
        ? `${darkMode ? 'text-transparent bg-clip-text bg-gradient-to-r from-white via-cyan-200 to-emerald-200 drop-shadow-[0_0_15px_rgba(34,211,238,0.4)]' : 'text-cyan-900'} font-black tracking-tighter`
        : 'text-slate-900 dark:text-white font-bold';
    const dataClass = isModern 
        ? `${darkMode ? 'text-cyan-400' : 'text-cyan-900'} font-black tracking-tighter drop-shadow-[0_0_8px_rgba(34,211,238,0.3)]`
        : 'text-slate-900 dark:text-white font-bold';
    const subtextClass = isModern 
        ? `${darkMode ? 'text-slate-400' : 'text-slate-600'}`
        : 'text-slate-500 dark:text-slate-400';
    const cardClass = `${panelClass} ${radiusClass} p-6 relative overflow-hidden transition-all duration-300 ${isModern ? 'hover:scale-[1.01] hover:shadow-2xl' : ''}`;

    return { 
        isModern, 
        radiusClass, 
        panelClass, 
        headerOpacity, 
        btnClass, 
        headingClass, 
        dataClass, 
        subtextClass,
        cardClass 
    };
}
