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
      className="backdrop-blur-xl bg-slate-900/60 border border-white/10 rounded-xl p-6 shadow-xl overflow-hidden relative"
    >
      <div className="flex flex-wrap justify-between items-center gap-4 pb-6 border-b border-white/10 relative z-10">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center shadow-lg shadow-emerald-950/40 text-emerald-400">
            <Receipt className="w-6 h-6" />
          </div>
          <div>
            <h3
              id="invoices-title"
              className="text-xl font-bold tracking-tight text-white"
            >
              {t('billing_legacy_transactions') || 'Billing & Receipt History'}
            </h3>
            <p className="text-xs text-white/60 mt-0.5">
              {t('billing_transaction_archive') || 'Audited Invoices & Direct Downloads'}
            </p>
          </div>
        </div>
      </div>
      <div className="overflow-x-auto rounded-xl border border-white/10 relative z-10 mt-6">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-white/[0.03] border-b border-white/10">
              {[
                'billing_timeframe',
                'billing_evaluation',
                'billing_execution',
                'billing_download',
              ].map(h => (
                <th
                  key={h}
                  className="px-6 py-4 text-xxs font-bold uppercase tracking-wider text-white/60"
                >
                  {t(h)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {invoices.length > 0 ? (
              invoices.map(invoice => (
                <tr
                  key={invoice.id}
                  className="hover:bg-white/[0.02] transition-colors duration-200"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2.5">
                      <Clock className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs font-mono text-white/80">
                        {new Date(invoice.created * 1000).toLocaleDateString()}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-xs font-bold text-white font-mono">
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
                        rel="noreferrer"
                        onClick={() => triggerHaptic('light')}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white/[0.03] hover:bg-white/10 text-white border border-white/10 text-xxs font-bold uppercase tracking-wider transition-all"
                      >
                        <Download className="w-3.5 h-3.5 text-emerald-400" />
                        <span>PDF</span>
                      </a>
                    ) : (
                      <span className="text-xxs text-white/40 uppercase tracking-widest italic">
                        {t('billing_no_pdf') || 'Unavailable'}
                      </span>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={4}
                  className="px-6 py-12 text-center text-xs text-white/40 font-semibold uppercase tracking-widest italic"
                >
                  <div className="flex flex-col items-center justify-center gap-2">
                    <FileText className="w-8 h-8 text-white/20" />
                    <span>{t('billing_no_invoices') || 'No audited invoices found for this account'}</span>
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
