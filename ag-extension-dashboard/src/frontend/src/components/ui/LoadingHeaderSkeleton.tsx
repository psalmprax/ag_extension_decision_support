/**
 * LoadingHeaderSkeleton — Shared loading-state UI used by feature pages (Agents,
 * EmailWorkflows, MCPTools, Memory, Telemetry, SystemHealth). Renders an h1 title,
 * a description paragraph, and a 4-column animate-pulse grid placeholder.
 *
 * Use as the early-return for an `isLoading` flag at the top of a page component.
 * Replaces an inline 22-line block that was duplicated across 6 page files
 * (cleared via the agent-helper audit-compliance dup:b4d1a326 fingerprint).
 */
interface LoadingHeaderSkeletonProps {
  title: string;
  description: string;
}

export function LoadingHeaderSkeleton({ title, description }: LoadingHeaderSkeletonProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{title}</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">{description}</p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="card p-6 animate-pulse">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
                <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
              </div>
              <div className="h-12 w-12 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
