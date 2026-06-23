import React from 'react';
import { Search, ChevronRight, Loader2 } from 'lucide-react';
import { Farmer } from '../../types/dashboard';

interface GlobalSearchProps {
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    showGlobalSearch: boolean;
    setShowGlobalSearch: (show: boolean) => void;
    isGlobalSearching: boolean;
    globalSearchResults: { type: string; items: { id: string; label: string; sublabel?: string }[] }[];
    handleGlobalSearch: (query: string) => void;
    setWeatherLocation: (loc: string) => void;
    addNotification: (n: { message: string; type: 'info' | 'warning' | 'error' | 'success' }) => void;
    farmers: Farmer[];
    handleOpenFarmerDetail: (farmer: Farmer) => void;
    setActiveTab: (tab: string) => void;
}

export const GlobalSearch: React.FC<GlobalSearchProps> = ({
    searchQuery, setSearchQuery, showGlobalSearch, setShowGlobalSearch,
    isGlobalSearching, globalSearchResults, handleGlobalSearch,
    setWeatherLocation, addNotification, farmers, handleOpenFarmerDetail, setActiveTab
}) => {
    return (
        <div className="relative hidden sm:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
            <input
                type="text"
                aria-label="Search system or location"
                placeholder="Search system or location..."
                className="bg-white/5 border border-white/10 rounded-full pl-10 pr-4 py-1.5 text-xs focus:ring-1 focus:ring-cyan-400 outline-none w-64 transition-all text-gray-900 dark:text-white"
                value={searchQuery}
                onChange={(e) => {
                    setSearchQuery(e.target.value);
                    handleGlobalSearch(e.target.value);
                }}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && searchQuery.trim() && globalSearchResults.length === 0) {
                        setWeatherLocation(searchQuery);
                        addNotification({ message: `Weather now showing for ${searchQuery}`, type: 'info' });
                        setSearchQuery('');
                        setShowGlobalSearch(false);
                    }
                }}
                onFocus={() => { if (searchQuery.trim()) setShowGlobalSearch(true); }}
                onBlur={() => { setTimeout(() => setShowGlobalSearch(false), 200); }}
            />
            {showGlobalSearch && globalSearchResults.length > 0 && (
                <div className="absolute top-full mt-2 left-0 right-0 glass-panel rounded-xl shadow-2xl z-50 max-h-80 overflow-y-auto">
                    {isGlobalSearching ? (
                        <div className="p-4 text-center text-sm text-gray-500">
                            <Loader2 className="w-4 h-4 animate-spin inline mr-2" />Searching...
                        </div>
                    ) : (
                        globalSearchResults.map((group) => (
                            <div key={group.type}>
                                <div className="px-4 pt-3 pb-1 text-xxs font-bold text-gray-400 uppercase tracking-widest">{group.type}</div>
                                {group.items.map((item) => (
                                    <button
                                        key={item.id}
                                        className="w-full px-4 py-2.5 text-left hover:bg-white/5 flex items-center gap-3"
                                        onClick={() => {
                                            if (group.type === 'Farmers') {
                                                const farmer = farmers?.find((f: Farmer) => f.id === item.id);
                                                if (farmer) handleOpenFarmerDetail(farmer);
                                            } else if (group.type === 'Visits') {
                                                React.startTransition(() => setActiveTab('visits'));
                                            } else {
                                                React.startTransition(() => setActiveTab('knowledge'));
                                                setSearchQuery(item.label);
                                            }
                                            setShowGlobalSearch(false);
                                        }}
                                    >
                                        <div className="flex-1">
                                            <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{item.label}</p>
                                            {item.sublabel && <p className="text-xs text-slate-500 truncate">{item.sublabel}</p>}
                                        </div>
                                        <ChevronRight className="w-4 h-4 text-slate-500" />
                                    </button>
                                ))}
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};
