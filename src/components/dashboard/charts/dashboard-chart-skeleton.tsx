export function DashboardChartSkeleton() {
  return (
    <div className="animate-pulse space-y-3 rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="h-4 w-40 rounded bg-slate-200 dark:bg-slate-700" />
      <div className="h-[180px] rounded-lg bg-slate-100 dark:bg-slate-800/60" />
    </div>
  );
}
