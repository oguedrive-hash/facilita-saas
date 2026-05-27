import { SkeletonPageHeader, SkeletonMetricCards } from "@/components/skeleton";

export default function Loading() {
  return (
    <div>
      <SkeletonPageHeader />
      <SkeletonMetricCards />
      <div className="bg-white rounded-2xl border border-cinza-claro p-10">
        <div className="space-y-3">
          <div className="h-4 bg-cinza-claro rounded animate-pulse w-full" />
          <div className="h-4 bg-cinza-claro rounded animate-pulse w-3/4" />
        </div>
      </div>
    </div>
  );
}
