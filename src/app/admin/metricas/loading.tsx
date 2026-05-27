import { SkeletonPageHeader, SkeletonMetricCards } from "@/components/skeleton";

export default function Loading() {
  return (
    <div>
      <SkeletonPageHeader />
      <SkeletonMetricCards count={5} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="bg-white rounded-2xl border border-cinza-claro p-6 space-y-3"
          >
            <div className="h-5 bg-cinza-claro rounded animate-pulse w-40 mb-3" />
            <div className="h-3 bg-cinza-claro rounded animate-pulse w-full" />
            <div className="h-3 bg-cinza-claro rounded animate-pulse w-3/4" />
            <div className="h-3 bg-cinza-claro rounded animate-pulse w-5/6" />
          </div>
        ))}
      </div>
    </div>
  );
}
