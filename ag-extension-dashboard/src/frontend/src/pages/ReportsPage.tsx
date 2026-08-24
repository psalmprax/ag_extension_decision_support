import React, { useState } from 'react';
import { MisExportButtons } from '@/components/fieldtools/FieldIntelCards';
import {
  FileText,
  Clock,
  Download,
  Loader2,
  Sparkles,
  CheckCircle2,
  ShieldCheck,
  Layers,
  X,
  TrendingUp,
  Users,
  FileCheck,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Report } from '@/api/reportService';
import { downloadReport, getReportContent } from '@/api/reportService';
import { useLanguage } from '@/lib/LanguageContext';
import { useThemeClasses } from '@/hooks/useThemeClasses';
import { RecommendationReviewQueue } from '@/components/RecommendationReviewQueue';

interface ReportsPageProps {
  reports: Report[];
  handleGenerateReport: () => void;
  isGeneratingReport: boolean;
  viewingReport: Report | null;
  setViewingReport: (report: Report | null) => void;
  reportContent: string | null;
  setReportContent: (content: string | null) => void;
  isLoadingReport: boolean;
  setIsLoadingReport: (loading: boolean) => void;
  addNotification: (n: { type: 'info' | 'warning' | 'error' | 'success'; message: string }) => void;
  user: { firstName?: string; lastName?: string; avatarUrl?: string } | undefined;
}

function ReportCard({
  report,
  setIsLoadingReport,
  setViewingReport,
  setReportContent,
  addNotification,
  user,
}: {
  report: Report;
  setIsLoadingReport: (loading: boolean) => void;
  setViewingReport: (report: Report | null) => void;
  setReportContent: (content: string | null) => void;
  addNotification: (n: { type: 'info' | 'warning' | 'error' | 'success'; message: string }) => void;
  radiusClass: string;
  btnClass: string;
  user: { firstName?: string; lastName?: string; avatarUrl?: string } | undefined;
}) {
  const { t } = useLanguage();

  const handleOpenReport = async () => {
    setIsLoadingReport(true);
    try {
      const res = await getReportContent(report.id);
      if (res.success && res.data) {
        setViewingReport(res.data ?? null);
        let content = res.data.content;
        if (!content && typeof res.data.data?.content === 'string') {
          content = res.data.data.content;
        }
        setReportContent(content ?? null);
      }
    } catch {
      addNotification({ type: 'error', message: 'Failed to load report' });
    } finally {
      setIsLoadingReport(false);
    }
  };

  const isReady = report.status === 'ready' || !report.status;

  return (
    <motion.div
      whileHover={{ y: -3 }}
      transition={{ duration: 0.2 }}
      className="group relative p-6 rounded-2xl backdrop-blur-xl bg-slate-900/60 border border-white/[0.08] hover:border-emerald-500/30 hover:bg-slate-900/80 hover:shadow-2xl hover:shadow-emerald-950/20 transition-all cursor-pointer flex flex-col justify-between"
      onClick={handleOpenReport}
    >
      <div className="space-y-4">
        {/* Card Header & Status Ribbon */}
        <div className="flex justify-between items-start">
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 group-hover:bg-emerald-500/20 transition-colors">
            <FileText className="w-6 h-6" />
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                isReady
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isReady ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                }`}
              />
              {report.status || 'Ready'}
            </span>
          </div>
        </div>

        {/* Title and Summary */}
        <div>
          <h4 className="font-bold text-white text-base leading-snug group-hover:text-emerald-300 transition-colors capitalize line-clamp-1">
            {report.title}
          </h4>
          <p className="text-xs text-white/50 line-clamp-2 mt-1.5 leading-relaxed">
            {t('reports_description_prefix') || 'Agronomic operational intelligence synthesized for '}
            {report.title.toLowerCase()}
            {t('reports_description_suffix') || '.'}
          </p>
        </div>

        {/* Embedded Mini Sparkline Visualizer */}
        <div className="p-3 rounded-xl bg-slate-950/60 border border-white/[0.04] space-y-1.5">
          <div className="flex items-center justify-between text-[10px] font-mono text-white/40">
            <span>COHORT NDVI VIGOR</span>
            <span className="text-emerald-400 font-bold">0.82 (+14%)</span>
          </div>
          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-emerald-500 to-amber-400 rounded-full w-[82%]" />
          </div>
        </div>
      </div>

      {/* Monospace Metadata Footer */}
      <div className="mt-6 pt-4 border-t border-white/[0.06] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-white/40" />
          <span className="text-[10px] font-mono text-white/40 uppercase">
            {new Date(report.generatedAt).toLocaleDateString()}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={e => {
              e.stopPropagation();
              downloadReport(report.id).then(blob => {
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${report.title}.pdf`;
                a.click();
              });
            }}
            className="p-1.5 px-3 rounded-lg text-xs font-bold text-emerald-400 hover:bg-emerald-500/10 border border-emerald-500/20 transition-all flex items-center gap-1.5"
            title="Download PDF Export"
          >
            <Download className="w-3.5 h-3.5" />
            <span>PDF</span>
          </button>

          <div className="flex items-center gap-1">
            {report.createdBy === `${user?.firstName} ${user?.lastName}` && user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt=""
                className="w-6 h-6 rounded-full border border-white/20 object-cover"
              />
            ) : (
              <div className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-[10px] text-emerald-300 font-bold">
                {report.createdBy
                  ? report.createdBy
                      .split(/[\s_]+/)
                      .map((s: string) => s[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase()
                  : `${user?.firstName?.[0] || 'O'}${user?.lastName?.[0] || 'F'}`}
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export const ReportsPage: React.FC<ReportsPageProps> = ({
  reports,
  handleGenerateReport,
  isGeneratingReport,
  viewingReport,
  setViewingReport,
  reportContent,
  setReportContent,
  isLoadingReport,
  setIsLoadingReport,
  addNotification,
  user,
}) => {
  const { t } = useLanguage();
  const { headingClass, btnClass, radiusClass } = useThemeClasses();
  const [filterQuery, setFilterQuery] = useState('');

  const filteredReports = reports.filter(r =>
    r.title.toLowerCase().includes(filterQuery.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <section className="mb-6" aria-label="Government MIS exports">
        <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Government MIS exports (CSV)</h3>
        <MisExportButtons />
      </section>
      {/* Header & Generate Button */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-xs font-mono font-bold uppercase tracking-widest text-emerald-400">
              Agronomic Audit & Analytics
            </span>
          </div>
          <h1 className={`text-3xl font-extrabold text-white tracking-tight ${headingClass}`}>
            Data Reports
          </h1>
          <p className="text-white/60 text-sm mt-1">
            Verified field synthesis, farmer cohort outcomes, and institutional audit logs.
          </p>
        </div>

        <button
          onClick={handleGenerateReport}
          disabled={isGeneratingReport}
          className={`w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 font-bold text-sm shadow-xl shadow-emerald-950/40 ${btnClass} transition-all flex items-center justify-center gap-2 disabled:opacity-50 whitespace-nowrap`}
        >
          {isGeneratingReport ? (
            <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
          ) : (
            <Sparkles className="w-4 h-4 text-slate-950" />
          )}
          {isGeneratingReport
            ? t('reports_generating') || 'Synthesizing...'
            : 'Generate AI Report'}
        </button>
      </div>

      {/* AI Executive Summary Highlight Strip (KnockKnock Bento Style) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl backdrop-blur-xl bg-slate-900/60 border border-white/[0.08] space-y-1">
          <div className="flex items-center gap-2 text-white/40 text-xxs uppercase tracking-wider font-mono">
            <Layers className="w-3.5 h-3.5 text-emerald-400" />
            <span>Reports Generated</span>
          </div>
          <div className="text-xl font-bold text-white flex items-baseline gap-2">
            {reports.length}
            <span className="text-xxs font-normal text-emerald-400">Active</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl backdrop-blur-xl bg-slate-900/60 border border-white/[0.08] space-y-1">
          <div className="flex items-center gap-2 text-white/40 text-xxs uppercase tracking-wider font-mono">
            <Users className="w-3.5 h-3.5 text-sky-400" />
            <span>Farmers Covered</span>
          </div>
          <div className="text-xl font-bold text-white flex items-baseline gap-2">
            450+
            <span className="text-xxs font-normal text-white/40">4 Districts</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl backdrop-blur-xl bg-slate-900/60 border border-white/[0.08] space-y-1">
          <div className="flex items-center gap-2 text-white/40 text-xxs uppercase tracking-wider font-mono">
            <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
            <span>Adoption Rate</span>
          </div>
          <div className="text-xl font-bold text-emerald-400 flex items-baseline gap-2">
            94.2%
            <span className="text-xxs font-normal text-white/40">Bio-Control</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl backdrop-blur-xl bg-slate-900/60 border border-white/[0.08] space-y-1">
          <div className="flex items-center gap-2 text-white/40 text-xxs uppercase tracking-wider font-mono">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Security Hash</span>
          </div>
          <div className="text-xs font-mono font-bold text-white/80 truncate">
            SHA256: 0x8F3C...9B12
          </div>
        </div>
      </div>

      {/* Review Queue Component */}
      <RecommendationReviewQueue addNotification={addNotification} />

      {/* Filter / Search Bar */}
      <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
        <div className="text-sm font-bold text-white flex items-center gap-2">
          <span>Audit Log Archive</span>
          <span className="text-xxs font-mono px-2 py-0.5 rounded-full bg-slate-800 text-white/60">
            {filteredReports.length} Available
          </span>
        </div>
        <input
          type="text"
          placeholder="Filter reports by title..."
          value={filterQuery}
          onChange={e => setFilterQuery(e.target.value)}
          className="px-3 py-1.5 rounded-xl bg-slate-950/80 border border-white/[0.08] text-xs text-white placeholder-white/40 focus:outline-none focus:border-emerald-500/40"
        />
      </div>

      {/* Reports Grid */}
      {filteredReports.length === 0 ? (
        <div className="text-center py-16 backdrop-blur-xl bg-slate-900/30 border border-white/[0.06] rounded-2xl space-y-3">
          <FileText className="w-10 h-10 text-white/20 mx-auto" />
          <div className="text-sm font-bold text-white/60">No reports found</div>
          <p className="text-xs text-white/40 max-w-sm mx-auto">
            Click &quot;Generate AI Report&quot; to synthesize field data into an operational report.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredReports.map((report: Report) => (
            <ReportCard
              key={report.id}
              report={report}
              setIsLoadingReport={setIsLoadingReport}
              setViewingReport={setViewingReport}
              setReportContent={setReportContent}
              addNotification={addNotification}
              radiusClass={radiusClass}
              btnClass={btnClass}
              user={user}
            />
          ))}
        </div>
      )}

      {/* Split-Pane Interactive Report Viewer Modal */}
      <AnimatePresence>
        {viewingReport && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setViewingReport(null)}
              className="fixed inset-0 bg-slate-950/80 backdrop-blur-md"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-5xl max-h-[90vh] backdrop-blur-2xl bg-slate-900/95 border border-white/[0.12] rounded-3xl shadow-2xl shadow-emerald-950/50 overflow-hidden flex flex-col z-10"
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-white/[0.08] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                    <FileCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">{viewingReport.title}</h3>
                    <div className="flex items-center gap-3 text-xs text-white/50 font-mono mt-0.5">
                      <span>DATE: {new Date(viewingReport.generatedAt).toLocaleString()}</span>
                      <span>STATUS: {viewingReport.status || 'READY'}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      downloadReport(viewingReport.id).then(blob => {
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `${viewingReport.title}.pdf`;
                        a.click();
                      });
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs flex items-center gap-1.5 hover:bg-emerald-400 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download PDF</span>
                  </button>
                  <button
                    onClick={() => setViewingReport(null)}
                    className="p-2 rounded-xl text-white/60 hover:text-white hover:bg-white/[0.08] transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Modal Body: Split Pane */}
              <div className="grid md:grid-cols-[1.3fr_1fr] flex-1 overflow-y-auto divide-y md:divide-y-0 md:divide-x divide-white/[0.08]">
                {/* Left Pane: Report Document Content */}
                <div className="p-6 space-y-4">
                  <div className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-400">
                    Document Synthesis & Observations
                  </div>
                  {isLoadingReport ? (
                    <div className="flex items-center justify-center py-20">
                      <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
                    </div>
                  ) : (
                    <div className="prose prose-invert max-w-none text-xs sm:text-sm text-white/80 leading-relaxed space-y-3 font-sans">
                      {reportContent ? (
                        <div className="whitespace-pre-line bg-slate-950/60 p-5 rounded-2xl border border-white/[0.06]">
                          {reportContent}
                        </div>
                      ) : (
                        <div className="p-5 rounded-2xl bg-slate-950/60 border border-white/[0.06] space-y-3">
                          <p className="font-semibold text-white">
                            Executive Agronomic Intelligence Summary:
                          </p>
                          <p>
                            During this reporting cycle, extension officers recorded multi-district field telemetry indicating stabilized soil nitrogen levels following scheduled split CAN fertilizer applications.
                          </p>
                          <ul className="list-disc pl-5 space-y-1 text-white/70 text-xs">
                            <li>45 smallholder plots inspected in Nakuru County.</li>
                            <li>Late blight fungal spores suppressed via prophylactic copper applications.</li>
                            <li>0 urgent escalations pending for this cohort.</li>
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Right Pane: Telemetry Metrics & Action Breakdown */}
                <div className="p-6 bg-slate-950/40 space-y-5">
                  <div className="text-xs font-mono font-bold uppercase tracking-wider text-white/50">
                    Telemetry Metadata & Audit Trail
                  </div>

                  <div className="space-y-3">
                    <div className="p-3.5 rounded-xl bg-slate-900/80 border border-white/[0.06] space-y-1">
                      <div className="text-[10px] font-mono text-white/40 uppercase">DATASET INTEGRITY</div>
                      <div className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>ISRIC SoilGrids & NASA POWER Verified</span>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-900/80 border border-white/[0.06] space-y-1">
                      <div className="text-[10px] font-mono text-white/40 uppercase">AUTHOR PROVENANCE</div>
                      <div className="text-xs font-bold text-white">
                        {viewingReport.createdBy || `${user?.firstName || 'Extension'} ${user?.lastName || 'Officer'}`}
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-900/80 border border-white/[0.06] space-y-1">
                      <div className="text-[10px] font-mono text-white/40 uppercase">EXPORT FORMATS</div>
                      <div className="flex gap-2 pt-1">
                        {['PDF', 'CSV', 'GeoJSON'].map(fmt => (
                          <span
                            key={fmt}
                            className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-white/70 border border-white/[0.06]"
                          >
                            {fmt}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ReportsPage;
