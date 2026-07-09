import { Skeleton, StatCardSkeleton, TableSkeleton } from "@/components/shared/loading-skeleton";

export function DealerStatementSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="animate-pulse space-y-4"
    >
      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <Skeleton className="mb-2 h-5 w-48" />
          <Skeleton className="h-3 w-72" />
        </div>
        <div className="grid gap-4 px-5 py-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-5 w-28" />
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-900/40">
        <div className="flex flex-wrap gap-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-9 w-36 rounded-lg" />
          ))}
        </div>
      </div>

      <StatCardSkeleton count={5} className="xl:grid-cols-5" />

      <TableSkeleton rows={8} columns={9} />
    </div>
  );
}

export function DealerStatementFiltersSkeleton() {
  return (
    <div
      aria-busy="true"
      className="animate-pulse rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-900/40"
    >
      <div className="flex flex-wrap gap-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-9 w-36 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

export function DealerStatementCardsSkeleton() {
  return <StatCardSkeleton count={5} className="xl:grid-cols-5" />;
}

export function DealerStatementTableSkeleton() {
  return <TableSkeleton rows={8} columns={9} />;
}
