import { cn } from "@/lib/utils";

interface DealerFormSectionProps {
  /** Section heading rendered in the card header. */
  title: string;
  /** Optional supporting copy shown beneath the heading. */
  description?: string;
  /** Form controls. They are laid out in a responsive grid. */
  children: React.ReactNode;
  /** Extra classes for the grid wrapper (e.g. to tweak column spans). */
  className?: string;
}

/**
 * Presentational shell for a logical group of dealer form fields.
 *
 * Fields are arranged in a single column on small screens and in two columns
 * from the `sm` breakpoint upward. Individual fields can opt into spanning the
 * full width with the `sm:col-span-2` utility.
 */
export function DealerFormSection({
  title,
  description,
  children,
  className,
}: DealerFormSectionProps) {
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
