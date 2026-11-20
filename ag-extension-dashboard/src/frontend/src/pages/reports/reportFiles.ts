import { downloadReportPdf, getReportContent, type Report } from '@/api/reportService';
import { saveBlob } from '@/lib/saveBlob';

/** Downloads a report as a PDF named after its title. */
export async function saveReportPdf(report: Pick<Report, 'id' | 'title'>): Promise<void> {
  saveBlob(await downloadReportPdf(report.id), `${report.title}.pdf`);
}

/** A report with its full text, which the list leaves out. */
export async function loadReport(id: string): Promise<{ report: Report; content: string | null }> {
  const res = await getReportContent(id);
  if (!res.success || !res.data) throw new Error('Report not found');
  const nested = res.data.data?.content;
  const content = res.data.content || (typeof nested === 'string' ? nested : null);
  return { report: res.data, content };
}

/** Whether a report has finished writing (older reports carry no status). */
export const isReportReady = (report: Pick<Report, 'status'>): boolean => !report.status || report.status === 'ready';
