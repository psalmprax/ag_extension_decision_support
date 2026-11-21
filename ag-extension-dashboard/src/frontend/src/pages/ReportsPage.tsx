import React, { useState } from 'react';
import { FilePlus, Loader2, Search } from 'lucide-react';
import type { Report } from '@/api/reportService';
import { PageHeader } from '@/components/ui/PageHeader';
import { PRIMARY_BUTTON } from '@/components/ui/controlStyles';
import { RecommendationReviewQueue } from '@/components/RecommendationReviewQueue';
import { useLanguage } from '@/lib/LanguageContext';
import { GovernmentExports } from './reports/GovernmentExports';
import { ReportCard } from './reports/ReportCard';
import { ReportViewer } from './reports/ReportViewer';
import { loadReport, saveReportPdf } from './reports/reportFiles';

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
  user?: { firstName?: string; lastName?: string; avatarUrl?: string };
}

/**
 * Written reports on the user's field work, the AI answers waiting for review, and the
 * CSV exports national extension systems import.
 */
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
}) => {
  const { t } = useLanguage();
  const [filterQuery, setFilterQuery] = useState('');
  const query = filterQuery.trim().toLowerCase();
  const filteredReports = query ? reports.filter(r => r.title.toLowerCase().includes(query)) : reports;
  const showError = (message: string) => addNotification({ type: 'error', message });

  const openReport = async (report: Report) => {
    setViewingReport(report);
    setReportContent(null);
    setIsLoadingReport(true);
    try {
      const loaded = await loadReport(report.id);
      setViewingReport(loaded.report);
      setReportContent(loaded.content);
    } catch {
      showError(t('reports_open_failed', { defaultValue: 'The report could not be opened. Try again.' }));
      setViewingReport(null);
    } finally {
      setIsLoadingReport(false);
    }
  };

  const downloadReport = (report: Report) => {
    saveReportPdf(report).catch(() => showError(t('reports_pdf_failed', { defaultValue: 'The PDF could not be downloaded. Try again.' })));
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('ui_reports_page_data_reports')}
        description={t('ui_reports_page_verified_field_synthesis_farmer_coho')}
        meta={
          reports.length > 0
            ? t('reports_summary', { count: reports.length, latest: reports[0]?.title ?? '', defaultValue: '{count} reports. Latest: {latest}' })
            : undefined
        }
        actions={
          <button onClick={handleGenerateReport} disabled={isGeneratingReport} className={PRIMARY_BUTTON}>
            {isGeneratingReport ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <FilePlus className="w-4 h-4" aria-hidden="true" />}
            {isGeneratingReport ? t('reports_generating') : t('reports_generate', { defaultValue: 'Write a report' })}
          </button>
        }
      />

      <section
        aria-labelledby="written-reports"
        className="bg-white dark:bg-white/[0.03] border border-slate-900/[0.08] dark:border-white/[0.08] rounded-lg"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-slate-900/[0.08] dark:border-white/[0.08]">
          <h2 id="written-reports" className="text-base font-medium text-slate-900 dark:text-white">
            {t('reports_list_title', { defaultValue: 'Written reports' })}
            <span className="ms-2 text-sm font-normal tabular-nums text-slate-500 dark:text-slate-400">{filteredReports.length}</span>
          </h2>
          {reports.length > 0 && (
            <label className="relative">
              <span className="sr-only">{t('reports_filter_label', { defaultValue: 'Find a report by title' })}</span>
              <Search className="w-4 h-4 absolute start-2.5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input
                type="search"
                value={filterQuery}
                onChange={e => setFilterQuery(e.target.value)}
                placeholder={t('reports_filter_placeholder', { defaultValue: 'Find by title' })}
                className="h-9 w-56 max-w-full ps-8 pe-3 rounded-md bg-white dark:bg-white/[0.03] border border-slate-900/[0.12] dark:border-white/[0.12] text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </label>
          )}
        </div>
        {filteredReports.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
              {reports.length ? t('reports_none_match', { defaultValue: 'No report title matches that search.' }) : t('ui_reports_page_no_reports_found')}
            </p>
            {!reports.length && (
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('ui_reports_page_click_generate_ai_report_to_synthesi')}</p>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-slate-900/[0.06] dark:divide-white/[0.06]">
            {filteredReports.map(report => (
              <ReportCard key={report.id} report={report} onOpen={openReport} onDownload={downloadReport} />
            ))}
          </ul>
        )}
      </section>

      <RecommendationReviewQueue addNotification={addNotification} />

      <GovernmentExports onError={showError} />

      <ReportViewer
        report={viewingReport}
        content={reportContent}
        isLoading={isLoadingReport}
        onClose={() => setViewingReport(null)}
        onDownload={downloadReport}
      />
    </div>
  );
};

export default ReportsPage;
