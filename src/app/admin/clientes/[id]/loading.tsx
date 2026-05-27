import { Skeleton, SkeletonMetricCards } from "@/components/skeleton";

export default function Loading() {
  return (
    <div>
      <Skeleton className="h-4 w-32 mb-4" />

      <div className="bg-white rounded-2xl border border-cinza-claro p-8 mb-6">
        <Skeleton className="h-8 w-48 mb-2" />
        <Skeleton className="h-4 w-40" />
      </div>

      <SkeletonMetricCards />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-cinza-claro p-6 space-y-3">
          <Skeleton className="h-5 w-40 mb-3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
        <div className="bg-white rounded-2xl border border-cinza-claro p-6 space-y-3">
          <Skeleton className="h-5 w-32 mb-3" />
          <Skeleton className="h-20 w-full" />
        </div>
      </div>
    </div>
  );
}
