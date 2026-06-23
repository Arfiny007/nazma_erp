import { cn } from "@/lib/utils";

interface OrderFormSectionProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  /** When true, body has no padding (used for full-bleed tables/grids). */
  flush?: boolean;
  className?: string;
}

/** Presentational card shell for a logical group of order-form fields. */
export function OrderFormSection({
  title,
  description,
  actions,
  children,
  flush,
  className,
}: OrderFormSectionProps) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <header className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800/80">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {title}
          </h2>
          {description && (
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {description}
            </p>
          )}
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </header>
      <div className={cn(flush ? "" : "p-5", className)}>{children}</div>
    </section>
  );
}
