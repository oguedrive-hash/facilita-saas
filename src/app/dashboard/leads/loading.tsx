import { SkeletonPageHeader, SkeletonTable, Skeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <div>
      <SkeletonPageHeader />

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 mb-6">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-24" />
        ))}
      </div>

      <SkeletonTable />
    </div>
  );
}
