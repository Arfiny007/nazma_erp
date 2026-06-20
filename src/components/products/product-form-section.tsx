import { cn } from "@/lib/utils";

interface ProductFormSectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * Presentational shell for a logical group of product form fields.
 * Fields are arranged in a single column on small screens and two columns
 * from the `sm` breakpoint upward.
 */
export function ProductFormSection({
  title,
  description,
  children,
  className,
}: ProductFormSectionProps) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <header className="border-b border-slate-100 px-5 py-4 dark:border-slate-800/80">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          {title}
        </h2>
        {description && (
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {description}
          </p>
        )}
      </header>
      <div
        className={cn(
          "grid grid-cols-1 gap-x-6 gap-y-5 p-5 sm:grid-cols-2",
          className,
        )}
      >
        {children}
      </div>
    </section>
  );
}
