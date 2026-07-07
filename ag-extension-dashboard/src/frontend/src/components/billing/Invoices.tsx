import React from 'react';
import { Clock, Download, FileText, Receipt } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import { Badge } from '../ui/Badge';

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
      className="card p-0 bg-white dark:bg-gray-900 border-none shadow-2xl overflow-hidden group"
    >
      <div className="p-10 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/30">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-primary-500/10 rounded-2xl shadow-inner group-hover:bg-primary-500 transition-colors duration-500">
            <Receipt className="w-6 h-6 text-primary-500 group-hover:text-white" />
          </div>
          <div className="space-y-1">
            <h3
              id="invoices-title"
              className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter"
            >
              {t('billing_legacy_transactions')}
            </h3>
            <p className="text-xxs font-black text-gray-400 uppercase tracking-[0.2em]">
              {t('billing_transaction_archive')}
            </p>
          </div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50/30 dark:bg-gray-800/20">
              {[
                'billing_timeframe',
                'billing_evaluation',
                'billing_execution',
                'billing_download',
              ].map(h => (
                <th
                  key={h}
                  className="px-10 py-6 text-xxs font-black uppercase tracking-[0.2em] text-gray-400"
                >
                  {t(h)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {invoices.length > 0 ? (
              invoices.map(invoice => (
                <tr
                  key={invoice.id}
                  className="hover:bg-primary-50/30 dark:hover:bg-primary-900/10 transition-colors duration-300 group/row"
                >
                  <td className="px-10 py-6">
                    <div className="flex items-center gap-3">
                      <Clock className="w-4 h-4 text-gray-300 group-hover/row:text-primary-500" />
                      <span className="text-sm font-bold text-gray-600 dark:text-gray-300">
                        {new Date(invoice.created * 1000).toLocaleDateString()}
                      </span>
                    </div>
                  </td>
                  <td className="px-10 py-6 text-base font-black text-gray-900 dark:text-white">
                    {(invoice.amount_paid / 100).toLocaleString('en-US', {
                      style: 'currency',
                      currency: invoice.currency,
                    })}
                  </td>
                  <td className="px-10 py-6">
                    <Badge variant={invoice.status === 'paid' ? 'success' : 'warning'} size="sm">
                      <div
                        className={`w-1.5 h-1.5 rounded-full mr-1 ${invoice.status === 'paid' ? 'bg-green-500 shadow-[0_0_8px_var(--color-outline)]' : 'bg-yellow-500'}`}
                      />
                      {invoice.status === 'paid' ? t('billing_status_paid') : invoice.status}
                    </Badge>
                  </td>
                  <td className="px-10 py-6">
                    {invoice.invoice_pdf ? (
                      <a
                        href={invoice.invoice_pdf}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 text-primary-600 hover:text-gray-900 dark:hover:text-white font-black text-xs uppercase tracking-widest transition-all group/pdf"
                      >
                        <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg group-hover/pdf:bg-primary-600 group-hover/pdf:text-white transition-all">
                          <Download className="w-4 h-4" />
                        </div>
                        PDF
                      </a>
                    ) : (
                      <span className="text-gray-400 text-xs font-black uppercase tracking-widest">
                        {t('billing_unavailable')}
                      </span>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="px-10 py-20 text-center">
                  <div className="flex flex-col items-center gap-4 opacity-30">
                    <FileText className="w-12 h-12" />
                    <p className="font-black uppercase tracking-[0.3em] text-xs">
                      {t('billing_no_records')}
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
