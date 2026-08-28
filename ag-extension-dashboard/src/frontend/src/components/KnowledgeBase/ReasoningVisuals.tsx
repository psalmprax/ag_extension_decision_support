import React, { useState, useRef } from 'react';
import { CH_COLORS } from '@/lib/colors';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Zap,
  Play,
  Image as ImageIcon,
  ExternalLink,
  X,
  Maximize2,
} from 'lucide-react';
import { EMPTY_VISUALS, type Chart, type KPI, type MediaAsset, type VisualsData } from './types';
import { ChartTooltip } from '@/components/charts/ChartTooltip';
import { CHART_PALETTE } from '@/components/charts/chartConfig';

interface ReasoningVisualsProps {
  visuals: VisualsData;
  audio?: string; // Base64 or URL
}

const BarChartRenderer = ({ data }: { data: Array<Record<string, unknown>> }) => (
  <BarChart data={data}>
    <defs>
      <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="var(--color-chart-blue)" stopOpacity={1} />
        <stop offset="100%" stopColor="var(--color-primary-500)" stopOpacity={0.8} />
      </linearGradient>
    </defs>
    <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
    <XAxis
      dataKey="label"
      axisLine={false}
      tickLine={false}
      tick={{ fontSize: 10, fontWeight: 900, fill: 'var(--color-primary-500)' }}
    />
    <YAxis
      axisLine={false}
      tickLine={false}
      tick={{ fontSize: 10, fontWeight: 900, fill: 'var(--color-primary-500)' }}
    />
    <Tooltip cursor={{ fill: 'var(--color-outline)' }} content={<ChartTooltip />} />
    <Bar dataKey="value" fill="url(#barGradient)" radius={[6, 6, 0, 0]} barSize={32} />
  </BarChart>
);

const AreaChartRenderer = ({ data }: { data: Array<Record<string, unknown>> }) => (
  <AreaChart data={data}>
    <defs>
      <linearGradient id="colorArea" x1="0" y1="0" x2="0" y2="1">
        <stop offset="5%" stopColor="var(--color-chart-blue)" stopOpacity={0.4} />
        <stop offset="95%" stopColor="var(--color-chart-blue)" stopOpacity={0} />
      </linearGradient>
    </defs>
    <XAxis dataKey="label" hide />
    <YAxis hide />
    <Tooltip content={<ChartTooltip />} />
    <Area
      type="monotone"
      dataKey="value"
      stroke={CH_COLORS.blue}
      strokeWidth={4}
      fillOpacity={1}
      fill="url(#colorArea)"
      animationDuration={2000}
    />
  </AreaChart>
);

const PieChartRenderer = ({ data }: { data: Array<Record<string, unknown>> }) => (
  <PieChart>
    <Pie
      data={data}
      cx="50%"
      cy="50%"
      innerRadius={70}
      outerRadius={95}
      paddingAngle={8}
      dataKey="value"
      stroke="none"
    >
      {data.map((_, index) => (
        <Cell key={`cell-${index}`} fill={CHART_PALETTE[index % CHART_PALETTE.length]} />
      ))}
    </Pie>
    <Tooltip content={<ChartTooltip />} />
  </PieChart>
);

const LineChartRenderer = ({ data }: { data: Array<Record<string, unknown>> }) => (
  <LineChart data={data}>
    <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
    <XAxis dataKey="label" hide />
    <YAxis hide />
    <Tooltip content={<ChartTooltip />} />
    <Line
      type="monotone"
      dataKey="value"
      stroke={CH_COLORS.purple}
      strokeWidth={5}
      dot={{ r: 6, fill: CH_COLORS.purple, strokeWidth: 0 }}
      activeDot={{ r: 10, stroke: 'white', strokeWidth: 3 }}
      animationDuration={2500}
    />
  </LineChart>
);

const MediaAssetsSection = ({
  safeVisuals,
  setSelectedImage,
  getYoutubeEmbedUrl,
}: {
  safeVisuals: {
    images?: Array<{ url: string; caption?: string }>;
    videos?: Array<{ url: string; caption?: string }>;
    [key: string]: unknown;
  };
  setSelectedImage: (url: string) => void;
  getYoutubeEmbedUrl: (url: string) => string;
}) => {
  const images = (safeVisuals.images ?? []) as MediaAsset[];
  const videos = (safeVisuals.videos ?? []) as MediaAsset[];
  if (!(images.length > 0 || videos.length > 0)) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {images.map((img, idx) => (
        <motion.div
          key={`img-${idx}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/50 dark:bg-gray-900/40 p-4 rounded-xl border border-gray-100 dark:border-gray-700/50 backdrop-blur-xl group overflow-hidden cursor-pointer"
          onClick={() => setSelectedImage(img.url)}
        >
          <div className="relative aspect-video rounded-xl overflow-hidden mb-3">
            <img
              src={img.url}
              alt={img.caption ?? 'Agricultural insight'}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <div className="p-3 bg-white/20 backdrop-blur-md rounded-xl text-white">
                <Maximize2 className="w-6 h-6" />
              </div>
            </div>
            <div className="absolute top-3 left-3 px-3 py-1 bg-black/50 backdrop-blur-md rounded-full flex items-center gap-1.5 text-white text-xxs font-black uppercase tracking-widest">
              <ImageIcon className="w-3 h-3" />
              Image
            </div>
            <div className="absolute bottom-3 left-3 px-3 py-1 bg-primary-600/90 backdrop-blur-md rounded-full flex items-center gap-1.5 text-white text-xs font-black uppercase tracking-widest">
              <CheckCircle2 className="w-2.5 h-2.5" />
              Verified ALFA Asset
            </div>
          </div>
          {img.caption && (
            <p className="text-sm font-bold text-gray-600 dark:text-gray-400 px-2 flex items-center justify-between">
              <span>{img.caption}</span>
              <span className="text-xxs text-primary-500 uppercase font-black opacity-0 group-hover:opacity-100 transition-opacity">
                Click to Enlarge
              </span>
            </p>
          )}
        </motion.div>
      ))}
      {videos.map((vid, idx) => (
        <motion.div
          key={`vid-${idx}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/50 dark:bg-gray-900/40 p-4 rounded-xl border border-gray-100 dark:border-gray-700/50 backdrop-blur-xl group overflow-hidden"
        >
          <div className="relative aspect-video rounded-xl overflow-hidden mb-3 bg-black flex items-center justify-center shadow-inner">
            {' '}
            {vid.url && (vid.url.includes('youtube.com') || vid.url.includes('youtu.be')) ? (
              <iframe
                src={getYoutubeEmbedUrl(vid.url)}
                title={String(vid.caption ?? 'Video analysis')}
                className="w-full h-full border-none"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <>
                <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                  <Play className="w-12 h-12 text-white/80 group-hover:scale-110 transition-transform" />
                </div>
                <div className="absolute top-3 left-3 px-3 py-1 bg-black/50 backdrop-blur-md rounded-full flex items-center gap-1.5 text-white text-xxs font-black uppercase tracking-widest">
                  <Play className="w-3 h-3" />
                  External Video
                </div>
                <a
                  href={vid.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="absolute bottom-3 right-3 p-3 bg-primary-600 rounded-xl text-white shadow-xl transform active:scale-95 transition-all"
                >
                  <ExternalLink className="w-5 h-5" />
                </a>
              </>
            )}
            <div className="absolute bottom-3 left-3 px-3 py-1 bg-primary-600/90 backdrop-blur-md rounded-full flex items-center gap-1.5 text-white text-xs font-black uppercase tracking-widest pointer-events-none">
              <CheckCircle2 className="w-2.5 h-2.5" />
              Verified Source
            </div>
          </div>
          {vid.caption && (
            <p className="text-sm font-bold text-gray-600 dark:text-gray-400 px-2">{vid.caption}</p>
          )}
        </motion.div>
      ))}
    </div>
  );
};

const AudioSynthesisSection = ({
  audio,
  audioRef,
  isPlaying,
  togglePlayback,
  setIsPlaying,
}: {
  audio: string | undefined;
  audioRef: React.RefObject<HTMLAudioElement>;
  isPlaying: boolean;
  togglePlayback: () => void;
  setIsPlaying: (val: boolean) => void;
}) => {
  if (!audio) return null;
  return (
    <div className="p-8 bg-gradient-to-r from-primary-600 to-indigo-600 rounded-xl text-white overflow-hidden relative group shadow-2xl shadow-primary-500/20">
      <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-32 -mt-32 group-hover:scale-110 transition-transform"></div>
      <div className="relative flex flex-col md:flex-row items-center gap-8">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={togglePlayback}
          className="p-6 bg-white/20 backdrop-blur-md rounded-xl text-white hover:bg-white/30 transition-all shadow-xl"
        >
          <Zap className={`w-12 h-12 ${isPlaying ? 'animate-pulse fill-current' : 'fill-none'}`} />
        </motion.button>
        <div className="flex-1 text-center md:text-left">
          <h4 className="text-xxs font-black uppercase tracking-[0.3em] opacity-70 mb-2">
            ALFA Voice Synthesis
          </h4>
          <p className="text-xl font-bold leading-tight mb-4">
            Listen to the AI's synthesized expert recommendation.
          </p>
          <div className="flex items-center gap-4 justify-center md:justify-start">
            <div className="h-1 flex-1 bg-white/20 rounded-full overflow-hidden max-w-[200px]">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: isPlaying ? '100%' : '0%' }}
                transition={{ duration: 15, ease: 'linear' }}
                className="h-full bg-white"
              />
            </div>
            <span className="text-xxs font-black uppercase">
              {isPlaying ? 'Playing...' : 'Click to Play'}
            </span>
          </div>
        </div>
        <audio
          ref={audioRef}
          src={audio.startsWith('data:') ? audio : `data:audio/mp3;base64,${audio}`}
          onEnded={() => setIsPlaying(false)}
          className="hidden"
        />
      </div>
    </div>
  );
};

export const ReasoningVisuals: React.FC<ReasoningVisualsProps> = ({ visuals, audio }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Robust empty state initialization
  const safeVisuals = visuals || EMPTY_VISUALS;
  if (!visuals && !audio) return null;

  const togglePlayback = () => {
    if (!audioRef.current) return;
    try {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch(e => console.warn('Playback blocked:', e));
      }
      setIsPlaying(!isPlaying);
    } catch (e) {
      console.error('Audio playback error:', e);
    }
  };

  const getYoutubeEmbedUrl = (url: string) => {
    if (!url) return '';
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    if (match && match[2].length === 11) {
      return `https://www.youtube.com/embed/${match[2]}?autoplay=0&rel=0`;
    }
    return url;
  };

  const renderChart = (chart: Chart): React.ReactNode => {
    const { type, data, title } = chart;
    const chartData: Array<Record<string, unknown>> = data as unknown as Array<
      Record<string, unknown>
    >;

    return (
      <motion.div
        whileHover={{ y: -5 }}
        className="bg-white/40 dark:bg-gray-900/30 p-8 rounded-xl border border-white/20 dark:border-white/5 shadow-[0_20px_50px_var(--color-outline)] backdrop-blur-3xl h-[350px] flex flex-col group transition-all"
      >
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-500/20 rounded-xl text-primary-500">
              <TrendingUp className="w-5 h-5" />
            </div>
            <h3 className="text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-[0.2em]">
              {title}
            </h3>
          </div>
          <div className="w-2 h-2 bg-primary-500 rounded-full animate-pulse shadow-[0_0_10px_var(--color-outline)]"></div>
        </div>

        <div className="flex-1 w-full -ml-6">
          <ResponsiveContainer width="100%" height="100%">
            {type === 'bar' ? (
              <BarChartRenderer data={chartData} />
            ) : type === 'area' ? (
              <AreaChartRenderer data={chartData} />
            ) : type === 'pie' ? (
              <PieChartRenderer data={chartData} />
            ) : (
              <LineChartRenderer data={chartData} />
            )}
          </ResponsiveContainer>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="space-y-6 mt-8">
      {/* Audio Abstraction Layer */}
      <AudioSynthesisSection
        audio={audio}
        audioRef={audioRef}
        isPlaying={isPlaying}
        togglePlayback={togglePlayback}
        setIsPlaying={setIsPlaying}
      />

      {/* KPI Metrics Grid */}
      {safeVisuals.kpis && safeVisuals.kpis.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {safeVisuals.kpis.map((kpi: KPI, idx) => (
            <motion.div
              key={`kpi-${idx}`}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.1 }}
              className="p-5 bg-white shadow-lg shadow-gray-200/50 dark:bg-gray-800 dark:shadow-none border border-gray-100 dark:border-gray-700/50 rounded-xl flex flex-col items-center text-center gap-2 group hover:border-primary-500/50 transition-all cursor-default"
            >
              <div
                className={`p-2 rounded-xl mb-1 ${
                  kpi.status === 'good'
                    ? 'bg-green-100 text-green-600'
                    : kpi.status === 'warning'
                      ? 'bg-amber-100 text-amber-600'
                      : 'bg-rose-100 text-rose-600'
                }`}
              >
                {kpi.status === 'good' ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : kpi.status === 'warning' ? (
                  <AlertTriangle className="w-5 h-5" />
                ) : (
                  <AlertCircle className="w-5 h-5" />
                )}
              </div>
              <span className="text-xxs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                {kpi.label}
              </span>
              <span className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
                {kpi.value}
              </span>
            </motion.div>
          ))}
        </div>
      )}

      <MediaAssetsSection
        safeVisuals={safeVisuals as unknown as Record<string, unknown>}
        setSelectedImage={setSelectedImage}
        getYoutubeEmbedUrl={getYoutubeEmbedUrl}
      />

      {/* Charts Section */}
      {safeVisuals.charts && safeVisuals.charts.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {safeVisuals.charts.map((chart, idx) => (
            <motion.div
              key={`chart-${idx}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
            >
              {renderChart(chart)}
            </motion.div>
          ))}
        </div>
      )}

      {/* Lightbox Overlay */}
      <AnimatePresence>
        {selectedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-12 bg-gray-950/90 backdrop-blur-3xl"
            onClick={() => setSelectedImage(null)}
          >
            <motion.button
              className="absolute top-8 right-8 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
              onClick={() => setSelectedImage(null)}
            >
              <X className="w-8 h-8" />
            </motion.button>

            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-7xl max-h-full rounded-xl overflow-hidden shadow-[0_0_100px_var(--color-outline)] border border-white/10"
              onClick={e => e.stopPropagation()}
            >
              <img
                src={selectedImage}
                alt="Enlarged visualization"
                className="w-full h-auto max-h-[85vh] object-contain"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Insight Analysis Modeling (Only show if there's metrics or assets) */}
      {((safeVisuals.kpis && safeVisuals.kpis.length > 0) ||
        (safeVisuals.charts && safeVisuals.charts.length > 0) ||
        (safeVisuals.images && safeVisuals.images.length > 0) ||
        (safeVisuals.videos && safeVisuals.videos.length > 0)) && (
        <div className="p-8 bg-primary-600 rounded-xl text-white overflow-hidden relative group shadow-2xl shadow-primary-500/20">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-32 -mt-32 group-hover:scale-110 transition-transform"></div>
          <div className="relative flex items-center gap-6">
            <div className="p-4 bg-white/20 backdrop-blur-md rounded-xl">
              <Zap className="w-10 h-10 fill-current" />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-black uppercase tracking-[0.2em] opacity-70 mb-1">
                Expert Decision Insight
              </h4>
              <p className="text-lg font-bold leading-tight">
                {safeVisuals.kpis && safeVisuals.kpis.length > 0
                  ? `${safeVisuals.kpis.filter((k: KPI) => k.status === 'good').length} of ${safeVisuals.kpis.length} indicators performing optimally. Review recommendations below.`
                  : 'Multimodal analysis complete. Review the synthesized intelligence above.'}
              </p>
            </div>
            <div className="hidden md:block">
              <div className="px-6 py-2 bg-white text-primary-600 rounded-xl font-black shadow-xl shadow-black/10">
                ALFA v2.2
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
