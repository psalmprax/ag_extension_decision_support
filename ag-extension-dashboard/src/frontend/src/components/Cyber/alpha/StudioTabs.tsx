import React from 'react';
import { motion } from 'framer-motion';
import { Zap, Cpu, Droplets, Eye, Sliders, Network, Radio } from 'lucide-react';
import { SoilNutrientHeatmapCanvas, type SoilProbeResult } from '../../canvas-ui/SoilNutrientHeatmapCanvas';
import { DiseaseSaliencyCanvas, type LesionDetectionZone } from '../../canvas-ui/DiseaseSaliencyCanvas';
import { AgroEcosystemCanvasScrubber } from '../../canvas-ui/AgroEcosystemCanvasScrubber';
import { RagKnowledgeGraphCanvas, type GraphNode } from '../../canvas-ui/RagKnowledgeGraphCanvas';
import { TelemetryRadarCanvas } from '../../canvas-ui/TelemetryRadarCanvas';
import type { CanvasViewType } from './rules';

/** Studio / Ops mode switcher for the co-pilot header. */
export const StudioTabSwitcher: React.FC<{
  active: 'copilot' | 'agent_ops';
  onSelect: (tab: 'copilot' | 'agent_ops') => void;
}> = ({ active, onSelect }) => (
  <div className="flex items-center bg-white/[0.04] p-1 rounded-xl border border-white/10">
    <button
      onClick={() => onSelect('copilot')}
      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
        active === 'copilot'
          ? 'bg-emerald-500 text-white shadow-md shadow-emerald-950/40'
          : 'text-white/50 hover:text-white'
      }`}
    >
      <Zap className="w-3.5 h-3.5" />
      <span>Co-Pilot Studio</span>
    </button>
    <button
      onClick={() => onSelect('agent_ops')}
      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
        active === 'agent_ops'
          ? 'bg-purple-600 text-white shadow-md shadow-purple-950/40'
          : 'text-white/50 hover:text-white'
      }`}
    >
      <Cpu className="w-3.5 h-3.5" />
      <span>Agent Fleet Ops</span>
    </button>
  </div>
);

/** Header strip shared by every canvas workbench panel. */
export const CanvasPanelHeader: React.FC<{ icon: React.ReactNode; title: string; hint: string; hintClass: string }> = ({ icon, title, hint, hintClass }) => (
  <div className="flex justify-between items-center text-xs pb-2 border-b border-white/5">
    <span className="font-bold text-white uppercase tracking-wider flex items-center gap-1.5">{icon}{title}</span>
    <span className={`text-xxs font-mono ${hintClass}`}>{hint}</span>
  </div>
);

/** Dynamic mounted canvas — renders the active spatial view and its selection detail card. */
export const CanvasWorkbench: React.FC<{
  view: CanvasViewType;
  selectedProbeResult: SoilProbeResult | null;
  onProbeSelect: (res: SoilProbeResult) => void;
  selectedLesionZone: LesionDetectionZone | null;
  onLesionZoneSelect: (z: LesionDetectionZone) => void;
  selectedGraphNode: GraphNode | null;
  onGraphNodeSelect: (n: GraphNode) => void;
  onDispatchSms: () => void;
}> = ({
  view,
  selectedProbeResult,
  onProbeSelect,
  selectedLesionZone,
  onLesionZoneSelect,
  selectedGraphNode,
  onGraphNodeSelect,
  onDispatchSms,
}) => (
  <>
    {view === 'soil_heatmap' && (
      <div className="space-y-3">
        <CanvasPanelHeader
          icon={<Droplets className="w-4 h-4 text-emerald-400" />}
          title="Spatial Soil Chemistry & pH Heatmap (0–15cm)"
          hint="Click cells to probe micro-nutrients"
          hintClass="text-emerald-400"
        />
        <SoilNutrientHeatmapCanvas interactive onProbeSelect={onProbeSelect} />
        {selectedProbeResult && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-between text-xs"
          >
            <div>
              <strong className="text-white">{selectedProbeResult.label}:</strong>{' '}
              <span className="font-mono text-emerald-400 font-bold">
                {selectedProbeResult.value} {selectedProbeResult.unit}
              </span>
              <p className="text-xxs text-white/60 mt-0.5">{selectedProbeResult.recommendation}</p>
            </div>
            <span
              className={`px-2 py-0.5 rounded text-xxs font-bold uppercase ${
                selectedProbeResult.status === 'optimal'
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'bg-amber-500/20 text-amber-400'
              }`}
            >
              {selectedProbeResult.status}
            </span>
          </motion.div>
        )}
      </div>
    )}

    {view === 'disease_saliency' && (
      <div className="space-y-3">
        <CanvasPanelHeader
          icon={<Eye className="w-4 h-4 text-rose-400" />}
          title="Neural Foliar Saliency & Pathology Scanner"
          hint="Wait for a real image analysis"
          hintClass="text-slate-500"
        />
        <DiseaseSaliencyCanvas onSelectZone={onLesionZoneSelect} />
        {selectedLesionZone && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-between text-xs"
          >
            <div>
              <strong className="text-rose-300">{selectedLesionZone.label}</strong>
              <p className="text-xxs text-white/60 mt-0.5">
                Confidence: {(selectedLesionZone.confidence * 100).toFixed(1)}% • Severity: {selectedLesionZone.severity}
              </p>
            </div>
            <button
              onClick={onDispatchSms}
              className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xxs font-bold shadow transition-all"
            >
              Dispatch Alert
            </button>
          </motion.div>
        )}
      </div>
    )}

    {view === 'agro_scrubber' && (
      <div className="space-y-3">
        <CanvasPanelHeader
          icon={<Sliders className="w-4 h-4 text-cyan-400" />}
          title="Agro-Ecosystem Phenology Scrubber (NASA POWER & NDVI)"
          hint="Drag scrubber to simulate growth phases"
          hintClass="text-cyan-400"
        />
        <div className="w-full h-[460px]">
          <AgroEcosystemCanvasScrubber showControls interactive className="w-full h-full" />
        </div>
      </div>
    )}

    {view === 'rag_graph' && (
      <div className="space-y-3">
        <CanvasPanelHeader
          icon={<Network className="w-4 h-4 text-purple-400" />}
          title="RAG Knowledge Citation & Ontology Mesh"
          hint="Click graph nodes to inspect excerpts"
          hintClass="text-purple-400"
        />
        <RagKnowledgeGraphCanvas onNodeSelect={onGraphNodeSelect} />
        {selectedGraphNode && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-xs"
          >
            <div className="flex items-center justify-between mb-1">
              <strong className="text-purple-300 font-bold">{selectedGraphNode.label}</strong>
              <span className="text-xxs font-mono text-white/40 uppercase">Category: {selectedGraphNode.category}</span>
            </div>
            <p className="text-xxs text-white/70 leading-relaxed">{selectedGraphNode.snippet}</p>
          </motion.div>
        )}
      </div>
    )}

    {view === 'telemetry_radar' && (
      <div className="space-y-3">
        <CanvasPanelHeader
          icon={<Radio className="w-4 h-4 text-emerald-400" />}
          title="Live Field Telemetry & Sensor Mesh Radar"
          hint="12 Active Transceivers"
          hintClass="text-emerald-400"
        />
        <div className="h-64 flex items-center justify-center">
          <TelemetryRadarCanvas />
        </div>
      </div>
    )}
  </>
);
