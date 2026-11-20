import React, { useState } from 'react';
import { MisExportButtons } from '@/components/fieldtools/FieldIntelCards';
import {
  FileText,
  Clock,
  Download,
  Loader2,
  FilePlus,
  CheckCircle2,
  X,
  FileCheck,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Report } from '@/api/reportService';
import { downloadReportPdf, getReportContent } from '@/api/reportService';
import { PageHeader } from '@/components/ui/PageHeader';
import { PRIMARY_BUTTON } from '@/components/ui/controlStyles';
import { useLanguage } from '@/lib/LanguageContext';
import { useThemeClasses } from '@/hooks/useThemeClasses';
import { RecommendationReviewQueue } from '@/components/RecommendationReviewQueue';
import { formatLabel } from '@/lib/formatLabel';

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

async function saveBlobAsFile(blob: Blob, filename: string): Promise<void> {
  const url = window.URL.createObjectURL(blob);
  try {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
  } finally {
    window.URL.revokeObjectURL(url);
  }
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
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
      className="group relative p-6 rounded-xl backdrop-blur-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-white/[0.08] shadow-sm hover:border-emerald-500/30 hover:bg-slate-50/50 dark:hover:bg-slate-900/80 hover:shadow-md transition-colors cursor-pointer flex flex-col justify-between"
      onClick={handleOpenReport}
    >
      <div className="space-y-4">
        {/* Card Header & Status Ribbon */}
        <div className="flex justify-between items-start">
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-500/20 transition-colors">
            <FileText className="w-6 h-6" />
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium ${
                isReady
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                  : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isReady ? 'bg-emerald-500 dark:bg-emerald-400' : 'bg-amber-500 dark:bg-amber-400'
                }`}
              />
              {report.status || 'Ready'}
            </span>
          </div>
        </div>

        {/* Title and Summary */}
        <div>
          <h4 className="font-bold text-slate-900 dark:text-white text-base leading-snug group-hover:text-emerald-600 dark:group-hover:text-emerald-300 transition-colors capitalize line-clamp-1">
            {report.title}
          </h4>
          <p className="text-xs text-slate-600 dark:text-white/50 line-clamp-2 mt-1.5 leading-relaxed">
            {t('reports_description_prefix') || 'Agronomic operational intelligence synthesized for '}
            {report.title.toLowerCase()}
            {t('reports_description_suffix') || '.'}
          </p>
        </div>

        {/* Live cohort metric — derived from report metadata when available */}
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-white/[0.04] space-y-1.5">
          <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 dark:text-white/40">
            <span>{t('ui_reports_page_report_status')}</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-bold ">{formatLabel(report.status || 'ready')}</span>
          </div>
          <div className="text-[10px] font-mono text-slate-600 dark:text-white/50 truncate">
            {report.generatedAt ? new Date(report.generatedAt).toLocaleDateString() : '—'}
          </div>
        </div>
      </div>

      {/* Monospace Metadata Footer */}
      <div className="mt-6 pt-4 border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-slate-400 dark:text-white/40" />
          <span className="text-[10px] font-mono text-slate-500 dark:text-white/40 ">
            {new Date(report.generatedAt).toLocaleDateString()}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={e => {
              e.stopPropagation();
              downloadReportPdf(report.id)
              .then(blob => saveBlobAsFile(blob, `${report.title}.pdf`))
              .catch(() => addNotification({ type: 'error', message: 'Failed to download report PDF' }));
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
                alt={`${user?.firstName || 'User'} avatar`}
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
  const { btnClass, radiusClass } = useThemeClasses();
  const [filterQuery, setFilterQuery] = useState('');

  const filteredReports = reports.filter(r =>
    r.title.toLowerCase().includes(filterQuery.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <section className="mb-6" aria-label="Government MIS exports">
        <h2 className="text-sm text-slate-600 dark:text-slate-400 mb-2">{t('ui_reports_page_government_mis_exports_csv')}</h2>
        <MisExportButtons />
      </section>
      <PageHeader
        bare
        title={t('ui_reports_page_data_reports')}
        description={t('ui_reports_page_verified_field_synthesis_farmer_coho')}
        meta={
          reports.length > 0
            ? t('reports_summary', { count: reports.length, latest: reports[0]?.title ?? '', defaultValue: '{count} reports. Latest: {latest}' })
            : undefined
        }
        actions={
          <button onClick={handleGenerateReport} disabled={isGeneratingReport} className={PRIMARY_BUTTON}>
            {isGeneratingReport ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            ) : (
              <FilePlus className="w-4 h-4" aria-hidden="true" />
            )}
            {isGeneratingReport
              ? t('reports_generating') || 'Writing report'
              : t('reports_generate', { defaultValue: 'Write a report' })}
          </button>
        }
      />

      {/* Review Queue Component */}
      <RecommendationReviewQueue addNotification={addNotification} />

      {/* Filter / Search Bar */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-white/[0.06]">
        <div className="text-base font-medium text-slate-900 dark:text-white flex items-center gap-2">
          <span>{t('ui_reports_page_audit_log_archive')}</span>
          <span className="text-sm font-normal tabular-nums text-slate-500 dark:text-white/50">
            {t('ui_reports_page_available', { length: filteredReports.length })}
          </span>
        </div>
        <input
          type="text"
          placeholder="Filter reports by title..."
          value={filterQuery}
          onChange={e => setFilterQuery(e.target.value)}
          className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-950/80 border border-slate-300 dark:border-white/[0.08] text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-white/40 focus:outline-none focus:border-emerald-500/40"
        />
      </div>

      {/* Reports Grid */}
      {filteredReports.length === 0 ? (
        <div className="text-center py-16 backdrop-blur-xl bg-white dark:bg-slate-900/30 border border-slate-200 dark:border-white/[0.06] rounded-xl space-y-3">
          <FileText className="w-10 h-10 text-slate-400 dark:text-white/20 mx-auto" />
          <div className="text-sm font-bold text-slate-700 dark:text-white/60">{t('ui_reports_page_no_reports_found')}</div>
          <p className="text-xs text-slate-500 dark:text-white/40 max-w-sm mx-auto">
            {t('ui_reports_page_click_generate_ai_report_to_synthesi')}
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
              className="relative w-full max-w-5xl max-h-[90vh] backdrop-blur-xl bg-white dark:bg-slate-900/95 border border-slate-200 dark:border-white/[0.12] rounded-xl shadow-xl overflow-hidden flex flex-col z-10"
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-slate-200 dark:border-white/[0.08] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                    <FileCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">{viewingReport.title}</h3>
                    <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-white/50 font-mono mt-0.5">
                      <span>{t('ui_reports_page_date')} {new Date(viewingReport.generatedAt).toLocaleString()}</span>
                      <span>{t('ui_reports_page_status')} {viewingReport.status || 'READY'}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      downloadReportPdf(viewingReport.id)
                        .then(blob => saveBlobAsFile(blob, `${viewingReport.title}.pdf`))
                        .catch(() => addNotification({ type: 'error', message: 'Failed to download report PDF' }));
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs flex items-center gap-1.5 hover:bg-emerald-400 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{t('ui_reports_page_download_pdf')}</span>
                  </button>
                  <button
                    onClick={() => setViewingReport(null)}
                    className="p-2 rounded-xl text-slate-500 dark:text-white/60 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.08] transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Modal Body: Split Pane */}
              <div className="grid md:grid-cols-[1.3fr_1fr] flex-1 overflow-y-auto divide-y md:divide-y-0 md:divide-x divide-slate-200 dark:divide-white/[0.08]">
                {/* Left Pane: Report Document Content */}
                <div className="p-6 space-y-4">
                  <div className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {t('ui_reports_page_document_synthesis_observations')}
                  </div>
                  {isLoadingReport ? (
                    <div className="flex items-center justify-center py-20">
                      <Loader2 className="w-8 h-8 animate-spin text-emerald-600 dark:text-emerald-400" />
                    </div>
                  ) : (
                    <div className="prose prose-slate dark:prose-invert max-w-none text-xs sm:text-sm text-slate-800 dark:text-white/80 leading-relaxed space-y-3 font-sans">
                      {reportContent ? (
                        <div className="whitespace-pre-line bg-slate-50 dark:bg-slate-950/60 p-5 rounded-xl border border-slate-200 dark:border-white/[0.06] text-slate-800 dark:text-white/90">
                          {reportContent}
                        </div>
                      ) : (
                        <div className="p-5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-white/[0.06]">
                          <p className="font-semibold text-slate-800 dark:text-white">{t('ui_reports_page_report_content_unavailable')}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Right Pane: Telemetry Metrics & Action Breakdown */}
                <div className="p-6 bg-slate-50 dark:bg-slate-950/40 space-y-5">
                  <div className="text-xs font-mono font-bold text-slate-500 dark:text-white/50">
                    {t('ui_reports_page_telemetry_metadata_audit_trail')}
                  </div>

                  <div className="space-y-3">
                    <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-white/[0.06] shadow-sm space-y-1">
                      <div className="text-[10px] font-mono text-slate-500 dark:text-white/40 ">{t('ui_reports_page_dataset_integrity')}</div>
                      <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{t('ui_reports_page_isric_soilgrids_nasa_power_verified')}</span>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-white/[0.06] shadow-sm space-y-1">
                      <div className="text-[10px] font-mono text-slate-500 dark:text-white/40 ">{t('ui_reports_page_author_provenance')}</div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white">
                        {viewingReport.createdBy || `${user?.firstName || 'Extension'} ${user?.lastName || 'Officer'}`}
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-white/[0.06] shadow-sm space-y-1">
                      <div className="text-[10px] font-mono text-slate-500 dark:text-white/40 ">{t('ui_reports_page_export_formats')}</div>
                      <div className="flex gap-2 pt-1">
                        {['PDF', 'CSV', 'GeoJSON'].map(fmt => (
                          <span
                            key={fmt}
                            className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-white/70 border border-slate-200 dark:border-white/[0.06]"
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
