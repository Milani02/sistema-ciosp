import { cn } from "../lib/cn";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton-shimmer rounded-lg bg-line", className)} />;
}

export function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 py-3">
      <Skeleton className="h-9 w-9 shrink-0 rounded-xl" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-3 w-2/5" />
        <Skeleton className="h-2.5 w-3/5" />
      </div>
    </div>
  );
}

export function SkeletonStat() {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <Skeleton className="mb-2.5 h-8 w-8 rounded-xl" />
      <Skeleton className="h-6 w-10" />
      <Skeleton className="mt-2 h-2.5 w-4/5" />
    </div>
  );
}
