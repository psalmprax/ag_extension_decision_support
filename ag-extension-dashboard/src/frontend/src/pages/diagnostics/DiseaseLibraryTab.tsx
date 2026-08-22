import React, { useState } from 'react';
import { Search, Loader2, Leaf, BookOpen, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';

interface Props {
  allDiseases: string[];
  radiusClass: string;
  onViewDiseaseInfo: (disease: string) => void;
}

export function DiseaseLibraryTab({ allDiseases, radiusClass: _radiusClass, onViewDiseaseInfo }: Props) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredDiseases = allDiseases.filter(d =>
    d.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-5 rounded-[4px] bg-slate-900/80 border border-slate-800 space-y-5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <BookOpen className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-black text-white uppercase tracking-wider">
              Pathology Encyclopedia & Protocols
            </h3>
          </div>
          <p className="text-[11px] font-mono text-slate-400">
            Browse FAO and National Extension verified pathology dossiers, bio-remedies, and preventative schedules.
          </p>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search plant pathogen or crop..."
            className="w-full md:w-72 pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-[3px] text-xs text-white placeholder-slate-600 focus:border-emerald-500/60 font-mono transition-all"
          />
        </div>
      </div>

      {allDiseases.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredDiseases.map((disease, index) => (
            <motion.div
              key={disease}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
              onClick={() => onViewDiseaseInfo(disease)}
              className="p-3.5 rounded-[4px] bg-slate-950 border border-slate-800 hover:border-emerald-500/40 hover:bg-slate-900/80 transition-all cursor-pointer group shadow-lg shadow-black/40 flex items-center justify-between"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-[3px] bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 group-hover:scale-105 transition-transform">
                  <Leaf className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-bold text-white group-hover:text-emerald-300 transition-colors truncate">
                    {disease}
                  </h4>
                  <span className="text-[9px] font-mono text-slate-500 uppercase tracking-wider">
                    VERIFIED PROTOCOL
                  </span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-emerald-400 transition-colors shrink-0" />
            </motion.div>
          ))}

          {filteredDiseases.length === 0 && (
            <div className="col-span-full text-center py-12 text-slate-500">
              <p className="text-xs font-bold uppercase tracking-wider">No matching pathology dossiers</p>
              <p className="text-[10px] font-mono mt-1">Try a different crop or disease keyword</p>
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
        </div>
      )}
    </div>
  );
}
