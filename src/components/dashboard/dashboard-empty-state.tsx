"use client";

import { EmptyState } from "@/components/shared/empty-state";

interface DashboardEmptyStateProps {
  title: string;
  description: string;
}

export function DashboardEmptyState({
  title,
  description,
}: DashboardEmptyStateProps) {
  return (
    <EmptyState
      title={title}
      description={description}
      className="rounded-xl border border-dashed border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
    />
  );
}
