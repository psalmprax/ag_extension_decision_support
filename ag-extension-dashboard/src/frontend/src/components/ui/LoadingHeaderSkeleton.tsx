import { PageHeader } from './PageHeader';
import type { PagePhoto } from './pagePhotos';

/**
 * LoadingHeaderSkeleton — the loading state of a feature page (Agents, EmailWorkflows, MCPTools,
 * Memory, Telemetry, SystemHealth): the page's own header, so the title does not change when the
 * data arrives, over a 4-column animate-pulse placeholder.
 *
 * Use as the early-return for an `isLoading` flag at the top of a page component.
 */
interface LoadingHeaderSkeletonProps {
  title: string;
  description: string;
  photo: PagePhoto;
}

export function LoadingHeaderSkeleton({ title, description, photo }: LoadingHeaderSkeletonProps) {
  return (
    <div className="space-y-6" aria-busy="true">
      <PageHeader photo={photo} title={title} description={description} />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="card p-6 animate-pulse">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <div className="h-4 bg-gray-200 dark:bg-white/[0.08] rounded w-20"></div>
                <div className="h-8 bg-gray-200 dark:bg-white/[0.08] rounded w-16"></div>
              </div>
              <div className="h-12 w-12 bg-gray-200 dark:bg-white/[0.08] rounded-xl"></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
