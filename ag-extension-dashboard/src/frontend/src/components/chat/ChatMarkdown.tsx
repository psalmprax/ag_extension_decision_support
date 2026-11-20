import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * Markdown for chat bubbles. Model answers use **bold**, lists and short
 * headings; showing them as plain text left raw asterisks and hashes in every
 * reply. Sized for a bubble (unlike the page-level MarkdownRenderer). Raw HTML
 * is not rendered (react-markdown's default) and only http(s) links are kept.
 */
export function ChatMarkdown({ content }: { content: string }) {
  return (
    <div className="space-y-2 break-words">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="leading-relaxed">{children}</p>,
          strong: ({ children }) => <strong className="font-medium">{children}</strong>,
          h1: ({ children }) => <p className="font-medium">{children}</p>,
          h2: ({ children }) => <p className="font-medium">{children}</p>,
          h3: ({ children }) => <p className="font-medium">{children}</p>,
          ul: ({ children }) => <ul className="list-disc ps-4 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal ps-4 space-y-1">{children}</ol>,
          code: ({ children }) => <code className="rounded bg-black/5 px-1 font-mono dark:bg-white/10">{children}</code>,
          a: ({ href, children }) =>
            href && /^https?:\/\//i.test(href) ? (
              <a href={href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                {children}
              </a>
            ) : (
              <span>{children}</span>
            ),
          img: () => null,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
