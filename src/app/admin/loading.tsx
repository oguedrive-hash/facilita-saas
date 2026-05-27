import {
  SkeletonPageHeader,
  SkeletonMetricCards,
  SkeletonTable,
} from "@/components/skeleton";

export default function Loading() {
  return (
    <div>
      <SkeletonPageHeader />
      <SkeletonMetricCards />
      <SkeletonTable />
    </div>
  );
}
