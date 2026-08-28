import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CheckCircle, AlertCircle, Info, ExternalLink } from 'lucide-react';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className = '' }) => {
  return (
    <div className={`markdown-content prose prose-slate dark:prose-invert max-w-none ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Style headers
          h1: ({ children }) => (
            <h1 className="text-2xl font-black uppercase tracking-tight mb-4 text-gray-900 dark:text-white">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-xl font-bold uppercase tracking-wide mt-6 mb-3 text-primary-600 dark:text-primary-400 border-l-4 border-primary-500 pl-3">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-lg font-bold mb-2 text-gray-800 dark:text-gray-200">{children}</h3>
          ),

          // Style paragraphs and lists
          p: ({ children }) => (
            <p className="mb-4 leading-relaxed text-gray-700 dark:text-gray-300 font-medium">
              {children}
            </p>
          ),
          ul: ({ children }) => (
            <ul className="list-disc pl-6 mb-6 space-y-2 text-gray-700 dark:text-gray-300 marker:text-primary-500">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal pl-6 mb-6 space-y-2 text-gray-700 dark:text-gray-300 marker:text-primary-500 marker:font-bold">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="pl-1 leading-relaxed">{children}</li>,

          // Style blockquotes as "Insights"
          blockquote: ({ children }) => (
            <div className="bg-primary-50 dark:bg-primary-900/10 border-l-4 border-primary-500 p-4 my-6 rounded-r-xl italic flex gap-3">
              <Info className="w-5 h-5 text-primary-500 flex-shrink-0 mt-1" />
              <div className="text-primary-900 dark:text-primary-100">{children}</div>
            </div>
          ),

          // Style tables (Important for agricultural data)
          table: ({ children }) => (
            <div className="overflow-x-auto my-6 border-2 border-gray-200 dark:border-gray-800 rounded-xl">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-gray-50 dark:bg-gray-900/50">{children}</thead>
          ),
          th: ({ children }) => (
            <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 border-t border-gray-100 dark:border-gray-800">
              {children}
            </td>
          ),

          // Support for checklists
          input: ({ checked }) => (
            <span className="inline-block mr-2">
              {checked ? (
                <CheckCircle className="w-4 h-4 text-green-500 inline" />
              ) : (
                <AlertCircle className="w-4 h-4 text-gray-400 inline" />
              )}
            </span>
          ),

          // Links
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary-500/10 hover:bg-primary-500/20 text-primary-600 dark:text-primary-400 rounded-lg no-underline font-black transition-all group/link"
            >
              <span>{children}</span>
              <ExternalLink className="w-3 h-3 group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5 transition-transform" />
            </a>
          ),

          // Code blocks
          code: props => {
            const {
              node: _node,
              inline,
              children,
              ...rest
            } = props as {
              node?: unknown;
              inline?: boolean;
              children?: React.ReactNode;
              [key: string]: unknown;
            };
            return inline ? (
              <code
                className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-primary-600 dark:text-primary-400 font-mono text-xs"
                {...rest}
              >
                {children}
              </code>
            ) : (
              <pre className="bg-gray-900 text-gray-100 p-6 rounded-xl overflow-x-auto font-mono text-sm border-2 border-primary-500/20 shadow-2xl my-6">
                <code {...rest}>{children}</code>
              </pre>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};
