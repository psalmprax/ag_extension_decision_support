import React, { useState } from 'react';
import { Search, ChevronRight, Loader2, X } from 'lucide-react';
import { Farmer } from '../../types/dashboard';
import { useLanguage } from '@/lib/LanguageContext';

interface GlobalSearchProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  showGlobalSearch: boolean;
  setShowGlobalSearch: (show: boolean) => void;
  isGlobalSearching: boolean;
  globalSearchResults: {
    type: string;
    items: { id: string; label: string; sublabel?: string }[];
  }[];
  handleGlobalSearch: (query: string) => void;
  setWeatherLocation: (loc: string) => void;
  addNotification: (n: { message: string; type: 'info' | 'warning' | 'error' | 'success' }) => void;
  farmers: Farmer[];
  handleOpenFarmerDetail: (farmer: Farmer) => void;
  setActiveTab: (tab: string) => void;
}

export const GlobalSearch: React.FC<GlobalSearchProps> = ({
  searchQuery,
  setSearchQuery,
  showGlobalSearch,
  setShowGlobalSearch,
  isGlobalSearching,
  globalSearchResults,
  handleGlobalSearch,
  setWeatherLocation,
  addNotification,
  farmers,
  handleOpenFarmerDetail,
  setActiveTab,
}) => {
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const { t } = useLanguage();

  const handleItemClick = (groupType: string, item: { id: string; label: string }) => {
    if (groupType === 'Farmers') {
      const farmer = farmers?.find((f: Farmer) => f.id === item.id);
      if (farmer) handleOpenFarmerDetail(farmer);
    } else if (groupType === 'Visits') {
      React.startTransition(() => setActiveTab('visits'));
    } else {
      React.startTransition(() => setActiveTab('knowledge'));
      setSearchQuery(item.label);
    }
    setShowGlobalSearch(false);
    setMobileSearchOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchQuery.trim() && globalSearchResults.length === 0) {
      setWeatherLocation(searchQuery);
      addNotification({ message: `Weather now showing for ${searchQuery}`, type: 'info' });
      setSearchQuery('');
      setShowGlobalSearch(false);
      setMobileSearchOpen(false);
    }
  };

  return (
    <div className="relative">
      {/* Mobile Search Icon Trigger */}
      <button
        onClick={() => setMobileSearchOpen(true)}
        className="sm:hidden p-2 rounded-lg text-slate-400 hover:text-white transition-colors"
        aria-label={t('common_search', { defaultValue: 'Search' })}
      >
        <Search className="w-4 h-4" />
      </button>

      {/* Mobile Full-Width Search Overlay */}
      {mobileSearchOpen && (
        <div className="sm:hidden fixed inset-x-0 top-0 h-16 bg-slate-950/95 backdrop-blur-2xl border-b border-white/10 px-3 flex items-center gap-2 z-[60] shadow-2xl">
          <Search className="w-4 h-4 text-emerald-400 shrink-0 ml-1" />
          <input
            type="text"
            autoFocus
            aria-label={t('common_search_placeholder', { defaultValue: 'Search system or location' })}
            placeholder={t('common_mobile_search_placeholder', { defaultValue: 'Search farmers, visits, knowledge...' })}
            className="flex-1 bg-transparent border-0 text-xs text-white placeholder-white/40 focus:outline-none"
            value={searchQuery}
            onChange={e => {
              setSearchQuery(e.target.value);
              handleGlobalSearch(e.target.value);
              if (e.target.value.trim()) setShowGlobalSearch(true);
            }}
            onKeyDown={handleKeyDown}
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                setShowGlobalSearch(false);
              }}
              className="p-1.5 text-white/40 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={() => {
              setMobileSearchOpen(false);
              setShowGlobalSearch(false);
            }}
            className="px-2.5 py-1 rounded-lg bg-white/[0.05] text-xs text-white/80 font-bold"
          >
            {t('common_cancel', { defaultValue: 'Cancel' })}
          </button>

          {/* Mobile Results Dropdown */}
          {showGlobalSearch && globalSearchResults.length > 0 && (
            <div className="absolute top-16 left-0 right-0 bg-slate-950 border-b border-white/10 shadow-2xl max-h-[60vh] overflow-y-auto z-50">
              {isGlobalSearching ? (
                <div className="p-4 text-center text-xs text-slate-400">
                  <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                  {t('common_searching', { defaultValue: 'Searching...' })}
                </div>
              ) : (
                globalSearchResults.map(group => (
                  <div key={group.type}>
                    <div className="px-4 pt-3 pb-1 text-xxs font-bold text-emerald-400 uppercase tracking-widest bg-slate-900/50">
                      {group.type}
                    </div>
                    {group.items.map(item => (
                      <button
                        key={item.id}
                        className="w-full px-4 py-2.5 text-left hover:bg-white/5 flex items-center gap-3 border-b border-white/[0.02]"
                        onClick={() => handleItemClick(group.type, item)}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-white truncate">{item.label}</p>
                          {item.sublabel && (
                            <p className="text-xxs text-slate-400 truncate">{item.sublabel}</p>
                          )}
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      </button>
                    ))}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* Desktop Search Input */}
      <div className="relative hidden sm:block">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
        <input
          type="text"
          aria-label={t('common_search_placeholder', { defaultValue: 'Search system or location' })}
          placeholder={t('common_search_placeholder', { defaultValue: 'Search system or location...' })}
          className="bg-white/5 border border-white/10 rounded-full pl-10 pr-4 py-1.5 text-xs focus:ring-1 focus:ring-primary-400 outline-none w-48 md:w-64 transition-all text-gray-900 dark:text-white"
          value={searchQuery}
          onChange={e => {
            setSearchQuery(e.target.value);
            handleGlobalSearch(e.target.value);
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (searchQuery.trim()) setShowGlobalSearch(true);
          }}
          onBlur={() => {
            setTimeout(() => setShowGlobalSearch(false), 200);
          }}
        />
        {showGlobalSearch && globalSearchResults.length > 0 && (
          <div className="absolute top-full mt-2 left-0 right-0 glass-panel rounded-xl shadow-2xl z-50 max-h-80 overflow-y-auto">
            {isGlobalSearching ? (
              <div className="p-4 text-center text-sm text-gray-500">
                <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                Searching...
              </div>
            ) : (
              globalSearchResults.map(group => (
                <div key={group.type}>
                  <div className="px-4 pt-3 pb-1 text-xxs font-bold text-gray-400 uppercase tracking-widest">
                    {group.type}
                  </div>
                  {group.items.map(item => (
                    <button
                      key={item.id}
                      className="w-full px-4 py-2.5 text-left hover:bg-white/5 flex items-center gap-3"
                      onClick={() => handleItemClick(group.type, item)}
                    >
                      <div className="flex-1">
                        <p className="text-sm font-bold text-gray-900 dark:text-white truncate">
                          {item.label}
                        </p>
                        {item.sublabel && (
                          <p className="text-xs text-slate-500 truncate">{item.sublabel}</p>
                        )}
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
    </div>
  );
};
