import { cn } from "@/lib/utils";

export type StatusVariant =
  | "approved"
  | "pending"
  | "overdue"
  | "draft"
  | "paid"
  | "partial";

interface StatusBadgeProps {
  label: string;
  variant: StatusVariant;
  className?: string;
}

const VARIANT_STYLES: Record<StatusVariant, string> = {
  approved:
    "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-950/50 dark:text-emerald-400 dark:ring-emerald-500/30",
  pending:
    "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-950/50 dark:text-amber-400 dark:ring-amber-500/30",
  overdue:
    "bg-rose-50 text-rose-700 ring-rose-600/20 dark:bg-rose-950/50 dark:text-rose-400 dark:ring-rose-500/30",
  draft:
    "bg-slate-100 text-slate-600 ring-slate-500/20 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-500/30",
  paid: "bg-brand-50 text-brand-700 ring-brand-600/20 dark:bg-brand-950/50 dark:text-brand-400 dark:ring-brand-500/30",
  partial:
    "bg-violet-50 text-violet-700 ring-violet-600/20 dark:bg-violet-950/50 dark:text-violet-400 dark:ring-violet-500/30",
};

export function StatusBadge({ label, variant, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        VARIANT_STYLES[variant],
        className,
      )}
    >
      {label}
    </span>
  );
}
