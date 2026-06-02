"use client";

import { SearchX, Store } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { useLanguage } from "@/contexts/LanguageContext";

interface DealerEmptyStateProps {
  /** When true, renders the "no search results" variant instead of "no data". */
  searchActive: boolean;
  className?: string;
}

/**
 * Dealer-specific empty state. Distinguishes between an empty dealer book and a
 * search that returned no matches, since the two warrant different guidance.
 */
export function DealerEmptyState({
  searchActive,
  className,
}: DealerEmptyStateProps) {
  const { t } = useLanguage();

  if (searchActive) {
    return (
      <EmptyState
        icon={SearchX}
        title={t("dealers.empty.noResultsTitle")}
        description={t("dealers.empty.noResultsDescription")}
        className={className}
      />
    );
  }

  return (
    <EmptyState
      icon={Store}
      title={t("dealers.empty.title")}
      description={t("dealers.empty.description")}
      className={className}
    />
  );
}
