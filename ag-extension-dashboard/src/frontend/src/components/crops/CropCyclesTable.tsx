import React from 'react';
import { Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { Field } from '@/api/fieldService';

interface CropCyclesTableProps {
  fields: Field[];
  handleDeleteCycle: (fieldId: string, cycleId: string) => void;
}

function getStatusClass(status: string): string {
  const map: Record<string, string> = {
    growing: 'bg-primary-500/10 text-primary-400 border border-primary-500/20',
    harvested: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
    failed: 'bg-red-500/10 text-red-400 border border-red-500/20',
  };
  return map[status] ?? 'bg-slate-800 text-slate-400';
}

function formatHarvestDate(cycle: { actualHarvestDate?: string | null; expectedHarvestDate?: string | null }): string {
  if (cycle.actualHarvestDate) return new Date(cycle.actualHarvestDate).toLocaleDateString();
  if (cycle.expectedHarvestDate) return `Est: ${new Date(cycle.expectedHarvestDate).toLocaleDateString()}`;
  return 'N/A';
}

function formatYield(yieldKg: number | null | undefined): string {
  if (yieldKg !== undefined && yieldKg !== null) return `${yieldKg.toLocaleString()} kg`;
  return 'In Progress';
}

export const CropCyclesTable: React.FC<CropCyclesTableProps> = ({
  fields,
  handleDeleteCycle,
}) => {
  return (
    <motion.div
      key="cycles-tab"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      className="bg-slate-900/60 border border-white/5 rounded-xl overflow-hidden shadow-2xl backdrop-blur-xl"
    >
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="border-b border-white/5 bg-slate-950/40 text-xxs uppercase tracking-wider font-black text-slate-500">
              <th className="p-4 pl-6">Sector Name</th>
              <th className="p-4">Crop Name</th>
              <th className="p-4">Variety</th>
              <th className="p-4">Growth Phase</th>
              <th className="p-4">Planting Date</th>
              <th className="p-4">Projected Harvest</th>
              <th className="p-4">Yield Output</th>
              <th className="p-4 pr-6 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {fields.flatMap(field =>
              (field.cropCycles || []).map(cycle => (
                <tr key={cycle.id} className="hover:bg-white/5 transition-colors group">
                  <td className="p-4 pl-6 font-bold text-slate-200">{field.name}</td>
                  <td className="p-4 font-semibold text-slate-100">{cycle.cropName}</td>
                  <td className="p-4 text-slate-400 font-mono text-xs">{cycle.variety || 'N/A'}</td>
                  <td className="p-4">
                    <span className={`px-2.5 py-1 rounded-full text-xxs font-black uppercase tracking-widest ${getStatusClass(cycle.status)}`}>
                      {cycle.status}
                    </span>
                  </td>
                  <td className="p-4 text-slate-400">
                    {cycle.plantingDate ? new Date(cycle.plantingDate).toLocaleDateString() : 'N/A'}
                  </td>
                  <td className="p-4 text-slate-400">{formatHarvestDate(cycle)}</td>
                  <td className="p-4 font-mono font-bold text-emerald-400">{formatYield(cycle.yieldKg)}</td>
                  <td className="p-4 pr-6 text-right">
                    <button
                      onClick={() => handleDeleteCycle(field.id, cycle.id)}
                      className="p-1.5 hover:bg-white/5 text-slate-500 hover:text-red-400 rounded-lg transition-colors"
                      title="Delete Cycle Record"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
};
