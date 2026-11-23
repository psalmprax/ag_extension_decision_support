import { Dialog as HeadlessDialog } from '@headlessui/react';
import { Download, Loader2, X } from 'lucide-react';
import type { Report } from '@/api/reportService';
import { Dialog } from '@/components/ui/Dialog';
import { PRIMARY_BUTTON } from '@/components/ui/controlStyles';
import { useLanguage } from '@/lib/LanguageContext';

interface ReportViewerProps {
  report: Report | null;
  content: string | null;
  isLoading: boolean;
  onClose: () => void;
  onDownload: (report: Report) => void;
}

/** A report's full text, with who wrote it and when, and its PDF. */
export function ReportViewer({ report, content, isLoading, onClose, onDownload }: ReportViewerProps) {
  const { t } = useLanguage();
  return (
    <Dialog open={report !== null} onClose={onClose} size="3xl">
      {report && (
        <div className="flex flex-col max-h-[85vh]">
          <header className="flex items-start gap-3 p-5 border-b border-slate-900/[0.08] dark:border-white/[0.08]">
            <div className="min-w-0 flex-1">
              <HeadlessDialog.Title className="text-lg font-medium text-slate-900 dark:text-white">{report.title}</HeadlessDialog.Title>
              <p className="mt-0.5 text-sm text-slate-500 dark:text-theme-text-muted">
                {[report.generatedAt ? new Date(report.generatedAt).toLocaleString() : null, report.createdBy].filter(Boolean).join(' · ')}
              </p>
            </div>
            <button type="button" onClick={() => onDownload(report)} className={PRIMARY_BUTTON}>
              <Download className="w-4 h-4" aria-hidden="true" />
              {t('ui_reports_page_download_pdf')}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label={t('common_close', { defaultValue: 'Close' })}
              className="h-10 w-10 inline-flex items-center justify-center rounded-md text-slate-500 hover:bg-slate-900/[0.05] dark:hover:bg-white/[0.06]"
            >
              <X className="w-[18px] h-[18px]" aria-hidden="true" />
            </button>
          </header>
          <div className="overflow-y-auto p-5">
            {isLoading ? (
              <p className="flex items-center gap-2 text-sm text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                {t('reports_loading', { defaultValue: 'Loading report…' })}
              </p>
            ) : content ? (
              <div className="whitespace-pre-line text-[15px] leading-relaxed text-slate-800 dark:text-theme-text-primary max-w-[70ch]">{content}</div>
            ) : (
              <p className="text-sm text-slate-600 dark:text-theme-text-muted">
                {t('reports_no_text', { defaultValue: 'This report has no text to show. The PDF may still hold it.' })}
              </p>
            )}
          </div>
        </div>
      )}
    </Dialog>
  );
}
