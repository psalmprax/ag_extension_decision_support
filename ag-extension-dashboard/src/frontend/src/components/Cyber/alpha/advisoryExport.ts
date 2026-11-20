import toast from 'react-hot-toast';
import type { ChatMessageItem } from './response';
import { latestAdvisoryText } from './response';
import { saveBlob } from '@/lib/saveBlob';

/** Downloads the latest real advisory as a PDF factsheet. The greeting is not an advisory. */
export async function exportAdvisoryPdf(messages: ChatMessageItem[]): Promise<void> {
  const lastAnswer = latestAdvisoryText(messages);
  if (!lastAnswer) {
    toast.error('No advisory to export — ask a question first');
    return;
  }
  try {
    const { generateReport, downloadReportPdf } = await import('@/api/reportService');
    const lastQuestion = messages.findLast(m => m.sender === 'user')?.text;
    const gen = await generateReport(
      'knowledge_factsheet',
      `Advisory: ${(lastQuestion || lastAnswer).slice(0, 80)}`,
      undefined,
      { content: lastAnswer, question: lastQuestion }
    );
    const reportId = (gen as { data?: { id?: string } })?.data?.id || (gen as { id?: string })?.id;
    if (!reportId) throw new Error('No report id');
    const blob = await downloadReportPdf(reportId);
    saveBlob(blob, `co-pilot-${Date.now()}.pdf`);
    toast.success('Prescription PDF downloaded');
  } catch (e) {
    toast.error((e as Error).message || 'PDF export failed');
  }
}
