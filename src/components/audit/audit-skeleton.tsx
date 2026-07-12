export function AuditSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-64 rounded-lg bg-slate-200 dark:bg-slate-800" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className="h-24 rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
          />
        ))}
      </div>
      <div className="h-24 rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900" />
      <div className="h-96 rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900" />
    </div>
  );
}
