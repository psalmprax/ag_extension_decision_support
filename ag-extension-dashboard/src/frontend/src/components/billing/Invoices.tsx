import React from 'react';
import { Clock, Download, FileText, Receipt } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import { Badge } from '../ui/Badge';
import { triggerHaptic } from '@/lib/haptics';

interface Invoice {
  id: string;
  created: number;
  amount_paid: number;
  currency: string;
  status: string;
  invoice_pdf: string | null;
}

interface InvoicesProps {
  invoices: Invoice[];
}

export const Invoices: React.FC<InvoicesProps> = ({ invoices }) => {
  const { t } = useLanguage();

  return (
    <section
      aria-labelledby="invoices-title"
      className="p-8 lg:p-10 backdrop-blur-2xl bg-slate-950/90 dark:bg-slate-950/95 border border-emerald-500/25 shadow-2xl overflow-hidden group relative"
      style={{ borderRadius: 'var(--radius-card, 1.25rem)' }}
    >
      <div className="absolute top-0 right-0 w-72 h-72 bg-emerald-500/10 rounded-full blur-[90px] pointer-events-none" />
      <div className="flex flex-wrap justify-between items-center gap-4 pb-6 border-b border-slate-800 relative z-10">
        <div className="flex items-center gap-4">
          <div className="p-3.5 bg-emerald-500/15 border border-emerald-500/30 rounded-2xl shadow-inner text-emerald-400">
            <Receipt className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3
              id="invoices-title"
              className="text-xl font-black text-white uppercase tracking-tight"
            >
              {t('billing_legacy_transactions') || 'Billing & Receipt History'}
            </h3>
            <p className="text-xxs font-bold text-emerald-400 uppercase tracking-[0.2em]">
              {t('billing_transaction_archive') || 'Audited Invoices & Direct Downloads'}
            </p>
          </div>
        </div>
      </div>
      <div className="overflow-x-auto relative z-10 mt-4">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-900/60 border-b border-slate-800">
              {[
                'billing_timeframe',
                'billing_evaluation',
                'billing_execution',
                'billing_download',
              ].map(h => (
                <th
                  key={h}
                  className="px-6 py-4 text-xxs font-black uppercase tracking-[0.2em] text-slate-400"
                >
                  {t(h)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80">
            {invoices.length > 0 ? (
              invoices.map(invoice => (
                <tr
                  key={invoice.id}
                  className="hover:bg-slate-900/50 transition-colors duration-200 group/row"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2.5">
                      <Clock className="w-4 h-4 text-slate-500 group-hover/row:text-emerald-400 transition-colors" />
                      <span className="text-xs font-mono text-slate-300">
                        {new Date(invoice.created * 1000).toLocaleDateString()}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm font-black text-white font-mono">
                    {(invoice.amount_paid / 100).toLocaleString('en-US', {
                      style: 'currency',
                      currency: invoice.currency,
                    })}
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant={invoice.status === 'paid' ? 'success' : 'warning'} size="sm">
                      <div
                        className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                          invoice.status === 'paid'
                            ? 'bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse'
                            : 'bg-yellow-400'
                        }`}
                      />
                      {invoice.status === 'paid' ? t('billing_status_paid') || 'PAID' : invoice.status}
                    </Badge>
                  </td>
                  <td className="px-6 py-4">
                    {invoice.invoice_pdf ? (
                      <a
                        href={invoice.invoice_pdf}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => triggerHaptic('light')}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold transition-all group/pdf"
                      >
                        <Download className="w-3.5 h-3.5 group-hover/pdf:scale-110 transition-transform" />
                        PDF
                      </a>
                    ) : (
                      <span className="text-slate-500 text-xs font-mono">
                        {t('billing_unavailable') || 'Unavailable'}
                      </span>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="px-6 py-16 text-center">
                  <div className="flex flex-col items-center gap-3 opacity-40">
                    <FileText className="w-10 h-10 text-slate-500" />
                    <p className="font-black uppercase tracking-[0.25em] text-xxs text-slate-400">
                      {t('billing_no_records') || 'No transaction records found'}
                    </p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
};
