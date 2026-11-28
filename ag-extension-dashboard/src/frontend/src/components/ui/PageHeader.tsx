import React from 'react';
import { PAGE_DESCRIPTION, PAGE_TITLE } from './typography';
import { PhotoHeaderBand } from './PhotoHeaderBand';
import { PAGE_PHOTOS, type PagePhoto } from './pagePhotos';

interface PageHeaderProps {
  /** The page's menu label, so the title matches what was clicked. */
  title: React.ReactNode;
  /** The field photo behind the header. */
  photo: PagePhoto;
  /** One plain sentence on what the page is for. */
  description?: React.ReactNode;
  /** Short facts about the data on the page (e.g. "Last 30 days"), shown as quiet text. */
  meta?: React.ReactNode;
  /** Buttons and controls aligned to the right of the title. */
  actions?: React.ReactNode;
  /** Controls under the title on a solid strip: tabs, search, filters. */
  children?: React.ReactNode;
  className?: string;
}

/**
 * The one page title pattern: a field photo, the title, a plain description and actions on the
 * right. No icon tile, no status badge beside the title: a page states what it is and lets its
 * content carry the detail.
 */
export const PageHeader: React.FC<PageHeaderProps> = ({ title, photo, description, meta, actions, children, className }) => (
  <PhotoHeaderBand {...PAGE_PHOTOS[photo]} className={className} footer={children}>
    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className={PAGE_TITLE}>{title}</h1>
        {description && <p className={`mt-2 max-w-2xl ${PAGE_DESCRIPTION}`}>{description}</p>}
        {meta && <p className="mt-2 text-sm text-slate-600 dark:text-theme-text-muted">{meta}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
    </div>
  </PhotoHeaderBand>
);
