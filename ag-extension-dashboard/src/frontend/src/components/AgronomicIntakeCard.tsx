import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Compass,
  MapPin,
  Layers,
  Droplets,
  Target,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
} from 'lucide-react';
import toast from 'react-hot-toast';

export interface AgronomicIntakeParams {
  zone?: string;
  soil?: string;
  irrigation?: string;
  goal?: string;
  customLocation?: string;
}

interface AgronomicIntakeCardProps {
  initialQuery: string;
  onApplyIntake: (enrichedQuery: string, params: AgronomicIntakeParams) => void;
  onBypass?: () => void;
  compact?: boolean;
}

const HARDINESS_ZONES = [
  { id: 'zone_3_4', label: 'Zone 3–4 (Cool / Short Season)', short: 'Zone 3–4' },
  { id: 'zone_5_6', label: 'Zone 5–6 (Temperate / Midwest)', short: 'Zone 5–6' },
  { id: 'zone_7_8', label: 'Zone 7–8 (Warm / Long Season)', short: 'Zone 7–8' },
  { id: 'zone_9_10', label: 'Zone 9–10 (Subtropical / Year-round)', short: 'Zone 9–10' },
  { id: 'tropical', label: 'Tropical (Bimodal Wet / Dry)', short: 'Tropical' },
];

const SOIL_TYPES = [
  { id: 'loam', label: 'Well-Drained Loam / Silt' },
  { id: 'clay', label: 'Heavy Clay / Poor Drainage' },
  { id: 'sand', label: 'Sandy / Rapid Drainage' },
  { id: 'acidic', label: 'Acidic Soil (pH < 5.5)' },
];

const IRRIGATION_TYPES = [
  { id: 'rainfed', label: 'Rainfed / Dryland' },
  { id: 'drip', label: 'Drip / Fertigation' },
  { id: 'sprinkler', label: 'Overhead Sprinkler / Pivot' },
];

const PRODUCTION_GOALS = [
  { id: 'commercial', label: 'Commercial Yield' },
  { id: 'smallholder', label: 'Smallholder Food Security' },
  { id: 'organic', label: 'Organic / Low-Input' },
];

// eslint-disable-next-line react-refresh/only-export-components
export function isAgronomicQueryAmbiguous(query: string): boolean {
  if (!query || query.trim().length < 4) return false;
  const q = query.toLowerCase();

  const isAgri = [
    'plant',
    'crop',
    'sow',
    'grow',
    'fertiliz',
    'spray',
    'blight',
    'rust',
    'pest',
    'variety',
    'cultivar',
    'yield',
    'season',
    'spring',
    'summer',
    'autumn',
    'fall',
    'winter',
    'seed',
    'harvest',
  ].some(term => q.includes(term));

  if (!isAgri) return false;

  const hasSpecificLocation = [
    'zone ',
    'county',
    'district',
    'state',
    'province',
    'lat',
    'lng',
    'ohio',
    'kenya',
    'ontario',
    'california',
    'texas',
    'iowa',
    'illinois',
    'indiana',
    'ghana',
    'nigeria',
    'tanzania',
    'uganda',
  ].some(loc => q.includes(loc));

  return !hasSpecificLocation;
}

export const AgronomicIntakeCard: React.FC<AgronomicIntakeCardProps> = ({
  initialQuery,
  onApplyIntake,
  onBypass,
  compact = false,
}) => {
  const [selectedZone, setSelectedZone] = useState<string>('Zone 5–6 (Temperate / Midwest)');
  const [selectedSoil, setSelectedSoil] = useState<string>('Well-Drained Loam / Silt');
  const [selectedIrrigation, setSelectedIrrigation] = useState<string>('Rainfed / Dryland');
  const [selectedGoal, setSelectedGoal] = useState<string>('Commercial Yield');
  const [customLocation, setCustomLocation] = useState<string>('');
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  const handleAutoGPS = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser.');
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        setIsLocating(false);
        const { latitude, longitude } = pos.coords;
        setCustomLocation(`Lat: ${latitude.toFixed(3)}, Lng: ${longitude.toFixed(3)}`);
        toast.success(`Acquired GPS coordinates: ${latitude.toFixed(2)}, ${longitude.toFixed(2)}`);
      },
      () => {
        setIsLocating(false);
        toast('Location permission not granted. Select your growing zone manually.');
      },
      { timeout: 8000 }
    );
  };

  const handleApply = () => {
    const locPart = customLocation.trim() ? customLocation.trim() : selectedZone;
    const enrichedQuery = `${initialQuery} [Agronomic Context: Location/Zone=${locPart}, Soil=${selectedSoil}, Water=${selectedIrrigation}, Goal=${selectedGoal}]`;
    onApplyIntake(enrichedQuery, {
      zone: selectedZone,
      soil: selectedSoil,
      irrigation: selectedIrrigation,
      goal: selectedGoal,
      customLocation: customLocation.trim() || undefined,
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      className={`rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-slate-900 shadow-sm overflow-hidden ${
        compact ? 'p-3 text-xs' : 'p-4'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-white/[0.06]">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0">
            <SlidersHorizontal className="w-3.5 h-3.5" />
          </div>
          <div>
            <h4 className="text-xs font-medium text-slate-900 dark:text-slate-100">
              Agronomic precision intake
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Select your farm profile to get exact planting windows, frost dates, and tested cultivars.
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsExpanded(prev => !prev)}
          className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
          aria-label={isExpanded ? 'Collapse intake form' : 'Expand intake form'}
        >
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="pt-3 space-y-3"
          >
            {/* 1. Growing Zone / Location */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <Compass className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                  1. Growing zone / climate band:
                </label>
                <button
                  onClick={handleAutoGPS}
                  disabled={isLocating}
                  className="text-[10px] text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 flex items-center gap-1 font-medium transition-colors"
                >
                  <MapPin className="w-3 h-3 text-slate-400" />
                  {isLocating ? 'Acquiring GPS...' : 'Auto-detect GPS'}
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {HARDINESS_ZONES.map(zone => {
                  const active = selectedZone === zone.label;
                  return (
                    <button
                      key={zone.id}
                      onClick={() => setSelectedZone(zone.label)}
                      className={`text-[11px] px-2.5 py-1 rounded-md border transition-colors font-medium ${
                        active
                          ? 'bg-slate-900 border-slate-900 text-white dark:bg-white dark:border-white dark:text-slate-950 shadow-sm'
                          : 'bg-slate-100 border-slate-200/80 text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 dark:bg-slate-800/60 dark:border-white/[0.06] dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800'
                      }`}
                    >
                      {zone.short}
                    </button>
                  );
                })}
              </div>

              {customLocation && (
                <div className="mt-1 text-[10px] text-slate-600 dark:text-slate-400 flex items-center gap-1 font-mono">
                  <MapPin className="w-2.5 h-2.5 text-slate-400" /> Selected GPS: {customLocation}
                </div>
              )}
            </div>

            {/* 2. Soil Texture & Drainage */}
            <div>
              <label className="text-[11px] font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1 mb-1.5">
                <Layers className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                2. Soil texture & condition:
              </label>
              <div className="flex flex-wrap gap-1.5">
                {SOIL_TYPES.map(soil => {
                  const active = selectedSoil === soil.label;
                  return (
                    <button
                      key={soil.id}
                      onClick={() => setSelectedSoil(soil.label)}
                      className={`text-[11px] px-2.5 py-1 rounded-md border transition-colors font-medium ${
                        active
                          ? 'bg-slate-900 border-slate-900 text-white dark:bg-white dark:border-white dark:text-slate-950 shadow-sm'
                          : 'bg-slate-100 border-slate-200/80 text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 dark:bg-slate-800/60 dark:border-white/[0.06] dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800'
                      }`}
                    >
                      {soil.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. Water Management & Production Goal */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="text-[11px] font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1 mb-1.5">
                  <Droplets className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                  3. Water supply:
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {IRRIGATION_TYPES.map(irr => {
                    const active = selectedIrrigation === irr.label;
                    return (
                      <button
                        key={irr.id}
                        onClick={() => setSelectedIrrigation(irr.label)}
                        className={`text-[10px] px-2 py-1 rounded-md border transition-colors font-medium ${
                          active
                            ? 'bg-slate-900 border-slate-900 text-white dark:bg-white dark:border-white dark:text-slate-950 shadow-sm'
                            : 'bg-slate-100 border-slate-200/80 text-slate-600 hover:text-slate-900 dark:bg-slate-800/60 dark:border-white/[0.06] dark:text-slate-400 dark:hover:text-slate-200'
                        }`}
                      >
                        {irr.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="text-[11px] font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1 mb-1.5">
                  <Target className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                  4. Production goal:
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {PRODUCTION_GOALS.map(goal => {
                    const active = selectedGoal === goal.label;
                    return (
                      <button
                        key={goal.id}
                        onClick={() => setSelectedGoal(goal.label)}
                        className={`text-[10px] px-2 py-1 rounded-md border transition-colors font-medium ${
                          active
                            ? 'bg-slate-900 border-slate-900 text-white dark:bg-white dark:border-white dark:text-slate-950 shadow-sm'
                            : 'bg-slate-100 border-slate-200/80 text-slate-600 hover:text-slate-900 dark:bg-slate-800/60 dark:border-white/[0.06] dark:text-slate-400 dark:hover:text-slate-200'
                        }`}
                      >
                        {goal.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Action Bar */}
            <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-100 dark:border-white/[0.06]">
              {onBypass && (
                <button
                  onClick={onBypass}
                  className="text-[11px] text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors font-medium"
                >
                  Search general overview &rarr;
                </button>
              )}
              <div className="flex-1" />
              <button
                onClick={handleApply}
                className="px-3.5 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs flex items-center gap-1.5 transition-colors active:scale-[0.98]"
              >
                <ArrowRight className="w-3.5 h-3.5" />
                Generate Precision Advice
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
