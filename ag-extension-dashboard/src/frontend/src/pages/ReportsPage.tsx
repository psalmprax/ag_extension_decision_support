import React from 'react';
import { FileText, Clock, Download, Loader2 } from 'lucide-react';
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
  radiusClass,
  btnClass,
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
  return (
    <div
      className="card group p-6 bg-theme-bg-card dark:bg-gray-800 border-gray-100 dark:border-gray-700 hover:border-primary-500 dark:hover:border-primary-400 transition-all cursor-pointer shadow-sm hover:shadow-xl"
      onClick={async () => {
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
      }}
    >
      <div className="flex justify-between items-start mb-6">
        <div
          className={`p-3 bg-gray-50 dark:bg-gray-700 ${radiusClass} group-hover:bg-primary-50 dark:group-hover:bg-primary-900/30 transition-colors`}
        >
          <FileText className="w-8 h-8 text-gray-400 group-hover:text-primary-600 dark:group-hover:text-primary-400" />
        </div>
        <span
          className={`px-2 py-1 ${radiusClass} text-xxs font-black uppercase tracking-widest ${
            report.status === 'ready'
              ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400'
              : 'bg-secondary-100 dark:bg-secondary-700 text-secondary-700 dark:text-secondary-400'
          }`}
        >
          {report.status}
        </span>
      </div>
      <h4 className="font-bold text-gray-900 dark:text-white text-lg leading-tight mb-2 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors capitalize">
        {report.title}
      </h4>
      <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mb-6 font-medium">
        {t('reports_description_prefix')}
        {report.title.toLowerCase()}
        {t('reports_description_suffix')}
      </p>
      <div className="flex items-center justify-between pt-4 border-t border-gray-50 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <Clock className="w-3 h-3 text-gray-400" />
          <span className="text-xxs font-bold text-gray-400 uppercase tracking-widest">
            {new Date(report.generatedAt).toLocaleDateString()}
          </span>
        </div>
        <div className="flex items-center gap-3">
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
            className={`p-1 px-2 text-xxs font-bold text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/30 ${btnClass} transition-colors flex items-center gap-1`}
          >
            <Download className="w-3 h-3" />
            {t('common_download') || 'PDF'}
          </button>
          <div className="flex -space-x-2">
            {report.createdBy === `${user?.firstName} ${user?.lastName}` && user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt=""
                className="w-6 h-6 rounded-full border-2 border-white dark:border-gray-800 object-cover"
              />
            ) : (
              <div className="w-6 h-6 rounded-full border-2 border-white dark:border-gray-800 bg-primary-500 flex items-center justify-center text-xs text-white font-bold">
                {report.createdBy
                  ? report.createdBy
                      .split(/[\s_]+/)
                      .map((s: string) => s[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase()
                  : `${user?.firstName?.[0] || ''}${user?.lastName?.[0] || ''}`}
              </div>
            )}
            {report.createdBy && (
              <span className="text-micro text-gray-500 dark:text-gray-400 font-medium self-center ml-1 truncate max-w-[80px]">
                {report.createdBy}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export const ReportsPage: React.FC<ReportsPageProps> = ({
  reports,
  handleGenerateReport,
  isGeneratingReport,
  viewingReport: _viewingReport,
  setViewingReport,
  reportContent: _reportContent,
  setReportContent,
  isLoadingReport: _isLoadingReport,
  setIsLoadingReport,
  addNotification,
  user,
}) => {
  const { t } = useLanguage();
  const { headingClass, btnClass, radiusClass } = useThemeClasses();

  return (
    <div>
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className={`text-3xl font-bold ${headingClass}`}>Data Reports</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 font-medium">
            Operational audit logs and data exports
          </p>
        </div>
        <button
          onClick={handleGenerateReport}
          disabled={isGeneratingReport}
          className={`px-6 py-3 bg-primary-600 hover:bg-primary-700 shadow-primary-500/20 shadow-lg ${btnClass} transition-all flex items-center gap-2`}
        >
          {isGeneratingReport ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <FileText className="w-4 h-4" />
          )}
          {isGeneratingReport
            ? t('reports_generating') || 'Generating...'
            : t('reports_generate_new')}
        </button>
      </div>
      <RecommendationReviewQueue addNotification={addNotification} />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {reports.map((report: Report) => (
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
    </div>
  );
};
