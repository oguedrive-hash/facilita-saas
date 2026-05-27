import { SkeletonPageHeader, Skeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <div>
      <SkeletonPageHeader />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3">
          <Skeleton className="h-5 w-40 mb-4" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="bg-white rounded-xl border border-cinza-claro p-4 space-y-2"
            >
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-40" />
            </div>
          ))}
        </div>
        <div className="space-y-2">
          <Skeleton className="h-5 w-32 mb-4" />
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className="bg-white rounded-xl border border-cinza-claro p-4 space-y-2"
            >
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
