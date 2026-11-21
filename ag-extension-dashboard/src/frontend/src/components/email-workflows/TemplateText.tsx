import React from 'react';

/**
 * Template text with its {{variables}} marked as code, so a reader sees which parts are
 * filled in when the email is sent rather than reading them as broken text.
 */
export function TemplateText({ text }: { text: string }) {
  const parts = text.split(/(\{\{\s*\w+\s*\}\})/);
  return (
    <>
      {parts.map((part, index) =>
        /^\{\{\s*\w+\s*\}\}$/.test(part) ? (
          <code key={index} className="px-1 rounded-[2px] bg-gray-100 dark:bg-gray-800 text-[0.9em]">
            {part.replace(/[{}\s]/g, '')}
          </code>
        ) : (
          <React.Fragment key={index}>{part}</React.Fragment>
        ),
      )}
    </>
  );
}
