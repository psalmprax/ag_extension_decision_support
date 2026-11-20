import { Download, FileText } from 'lucide-react';
import type { Report } from '@/api/reportService';
import { formatLabel } from '@/lib/formatLabel';
import { useLanguage } from '@/lib/LanguageContext';
import { isReportReady } from './reportFiles';

interface ReportCardProps {
  report: Report;
  onOpen: (report: Report) => void;
  onDownload: (report: Report) => void;
}

const dateFormat = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

/** One report in the list: its title, when and by whom it was written, and a PDF download. */
export function ReportCard({ report, onOpen, onDownload }: ReportCardProps) {
  const { t } = useLanguage();
  const ready = isReportReady(report);
  const written = report.generatedAt ? dateFormat.format(new Date(report.generatedAt)) : null;

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <FileText className="w-[18px] h-[18px] text-slate-400 dark:text-slate-500 shrink-0" aria-hidden="true" />
      <button type="button" onClick={() => onOpen(report)} className="min-w-0 flex-1 text-left group">
        <span className="block text-sm font-medium text-slate-900 dark:text-white truncate group-hover:underline">{report.title}</span>
        <span className="block text-sm text-slate-500 dark:text-slate-400 truncate">
          {[written, report.createdBy, ready ? null : formatLabel(report.status ?? '')].filter(Boolean).join(' · ')}
        </span>
      </button>
      <button
        type="button"
        onClick={() => onDownload(report)}
        disabled={!ready}
        aria-label={t('reports_download_named', { title: report.title, defaultValue: 'Download {title} as PDF' })}
        className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-900/[0.05] dark:hover:bg-white/[0.06] disabled:opacity-40 transition-colors"
      >
        <Download className="w-4 h-4" aria-hidden="true" />
        PDF
      </button>
    </li>
  );
}
