/**
 * Skeleton loader genérico — usado nos arquivos loading.tsx
 */

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse bg-cinza-claro rounded ${className}`}
      aria-hidden="true"
    />
  );
}

export function SkeletonPageHeader() {
  return (
    <div className="mb-8">
      <Skeleton className="h-10 w-48 mb-2" />
      <Skeleton className="h-4 w-72" />
    </div>
  );
}

export function SkeletonMetricCards({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-white rounded-2xl border border-cinza-claro p-5"
        >
          <Skeleton className="h-3 w-20 mb-2" />
          <Skeleton className="h-9 w-16" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="bg-white rounded-2xl border border-cinza-claro overflow-hidden">
      <div className="bg-offwhite border-b border-cinza-claro px-6 py-3">
        <Skeleton className="h-3 w-32" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="border-b border-cinza-claro last:border-0 px-6 py-4 flex items-center justify-between"
        >
          <div className="flex-1">
            <Skeleton className="h-4 w-40 mb-2" />
            <Skeleton className="h-3 w-32" />
          </div>
          <Skeleton className="h-6 w-24 mr-8" />
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
}
