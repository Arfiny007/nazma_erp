export function CollectionSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="h-10 w-full max-w-sm rounded-lg bg-slate-200 dark:bg-slate-800" />
        <div className="h-4 w-40 rounded bg-slate-200 dark:bg-slate-800" />
      </div>
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-9 w-32 rounded-lg bg-slate-200 dark:bg-slate-800"
          />
        ))}
      </div>
      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="space-y-0 divide-y divide-slate-100 dark:divide-slate-800">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="flex gap-4 px-4 py-3">
              <div className="h-4 w-24 rounded bg-slate-200 dark:bg-slate-800" />
              <div className="h-4 w-32 rounded bg-slate-200 dark:bg-slate-800" />
              <div className="ml-auto h-4 w-20 rounded bg-slate-200 dark:bg-slate-800" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function CollectionWorkspaceSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-24 rounded-xl border border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900"
          />
        ))}
      </div>
      <div className="h-48 rounded-xl border border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900" />
      <div className="h-64 rounded-xl border border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900" />
    </div>
  );
}
